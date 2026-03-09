# AI Support Agent — Project CLAUDE.md

> Project-specific rules. Global rules live in `~/.claude/CLAUDE.md`.

---

## Project Overview

Multi-tenant AI customer support SaaS. Next.js 16 App Router + Prisma + Neon PostgreSQL.
Deployed on Vercel. Auth via NextAuth v5 (email/password + email verification).

---

## Stack & Key Libraries

| Purpose    | Library              | Notes                                                                                                                 |
| ---------- | -------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Framework  | Next.js 16           | App Router only — no pages/ directory                                                                                 |
| Styling    | Tailwind CSS v4      | No v3 syntax (`theme()` calls)                                                                                        |
| Auth       | NextAuth v5 beta     | `src/auth.ts` + `src/auth.config.ts`                                                                                  |
| DB ORM     | Prisma 7             | Client at `src/lib/db.ts` — dynamic import for edge compat                                                            |
| DB         | Neon PostgreSQL      | pgvector enabled; `prisma migrate dev` (local), `prisma migrate deploy` (prod) — 6 migrations in `prisma/migrations/` |
| LLM        | Vercel AI SDK + Groq | `ai` package v6                                                                                                       |
| Embeddings | Google Gemini        | `text-embedding-004`, 768 dims                                                                                        |
| Payments   | Stripe               | Checkout + webhook at `/api/stripe/`                                                                                  |
| Email      | Resend               | Falls back to console.log in dev when `RESEND_API_KEY` unset                                                          |
| Testing    | Vitest 4             | `pnpm test` — 93 tests; config in `vitest.config.ts`                                                                  |

---

## Critical Architecture Decisions

### Prisma + Edge Runtime (Turbopack)

**Problem**: Static Prisma import crashes Turbopack workers.
**Fix**: `src/lib/db.ts` uses dynamic `import()` inside an async singleton factory.

```typescript
// ✅ Correct — dynamic import in db.ts
let prismaInstance: PrismaClient | null = null;
async function getInstance() {
  if (!prismaInstance) {
    const { PrismaClient } = await import("@/generated/prisma");
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}
```

**Never** switch back to a static top-level `import { PrismaClient }` — it will crash.

**Generated client** (`src/generated/prisma/`) is gitignored (~10MB WASM binaries). It's regenerated automatically by `prisma generate` which runs as the first step of `vercel.json` `buildCommand`. In local dev, run `pnpm prisma generate` after schema changes.

### Multi-tenant Data Isolation

Every Prisma query on tenant data **must** include `orgId` from `session.user.orgId`.

```typescript
// ✅ Correct — always scope by orgId
const orders = await prisma.order.findMany({ where: { orgId } });

// ❌ Wrong — leaks across tenants
const orders = await prisma.order.findMany();
```

### TOCTOU-Safe Mutations

Use `updateMany` / `deleteMany` with `orgId` in the `where` clause. Never `findFirst` + `update`.

```typescript
// ✅ Atomic auth + mutation
await prisma.product.updateMany({ where: { id, orgId }, data: { ... } });

// ❌ TOCTOU race — two round-trips
const p = await prisma.product.findFirst({ where: { id, orgId } });
await prisma.product.update({ where: { id }, data: { ... } });
```

### Decimal Price Fields

`Product.price`, `Order.totalPrice`, `OrderItem.unitPrice` are `Decimal(10,2)`.
Always call `.toNumber()` before serializing to JSON:

```typescript
price: product.price.toNumber(), // ✅
price: product.price,            // ❌ serializes as string "99.99"
```

---

## File Conventions

### API Routes (`src/app/api/`)

- Auth guard first: `if (!session?.user?.orgId) return 401`
- Rate limiting on auth/sensitive endpoints via `src/lib/rate-limit.ts`
- Zod validation on all POST/PATCH bodies — return generic `"Invalid input"` on failure (don't leak Zod schema)
- Use `logError()` from `src/lib/error-logger.ts` (not `console.error`)
- Audit log only on mutations (POST/PUT/PATCH/DELETE), not GET

### AI Tools (`src/lib/ai/tools/`)

- Factory pattern: `createXxxTool(orgId: string)` — all queries scoped to orgId
- Access exported via `src/lib/ai/tools/index.ts`
- Plan-based tool gating: check `org.plan` before enabling `checkInventory` / `createTicket`

### Components

- Server Components by default — only `'use client'` when using hooks or browser APIs
- `src/components/ui/` — shadcn/ui primitives (don't edit)
- `src/components/dashboard/` — dashboard-specific components
- `src/components/landing/` — public marketing page components
- `src/components/auth/` — login/register forms

### Environment Variables

| Variable                       | Required | Notes                                |
| ------------------------------ | -------- | ------------------------------------ |
| `DATABASE_URL`                 | Yes      | Neon connection string               |
| `AUTH_SECRET`                  | Yes      | `openssl rand -base64 32`            |
| `AUTH_URL` / `NEXTAUTH_URL`    | Yes      | Base URL                             |
| `NEXT_PUBLIC_APP_URL`          | Yes      | Used for widget iframe src           |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes      | Gemini embeddings                    |
| `GROQ_API_KEY`                 | Yes      | LLM                                  |
| `RESEND_API_KEY`               | No       | Falls back to console log            |
| `STRIPE_SECRET_KEY`            | No       | Billing features disabled without it |
| `NEXT_PUBLIC_DEMO_API_KEY`     | No       | Enables live demo on landing page    |

---

## Development Commands

```bash
pnpm dev           # Dev server (Turbopack)
pnpm build         # Production build
pnpm test          # 93 Vitest tests
pnpm lint          # ESLint
pnpm type-check    # tsc --noEmit
pnpm format        # Prettier --write
pnpm prisma studio        # DB GUI
pnpm prisma migrate dev   # Create + apply migration (local dev)
pnpm prisma migrate deploy # Apply pending migrations (production/CI)
```

---

## Test Conventions

- Test files in `src/__tests__/` mirroring `src/` structure
- Pure logic → no mocks; Prisma-dependent → `vi.mock("@/lib/db", ...)`
- Use `vi.resetAllMocks()` (not `clearAllMocks`) in `beforeEach` when tests use `mockResolvedValueOnce`
- Decimal fields: use `const decimal = (n: number) => ({ toNumber: () => n })` stub

---

## Known Gotchas

1. **Turbopack + Prisma**: Static import = crash. Always use the `db.ts` singleton. See #8723.
2. **NextAuth v5 beta**: `auth()` returns `null` in some edge routes — always null-check `session?.user?.orgId`.
3. **pgvector queries**: Prisma doesn't natively support `<=>` operator — use raw queries in `vector-search.ts`.
4. **Neon serverless**: Use `@neondatabase/serverless` driver + `@prisma/adapter-neon` for edge-compatible DB connections.
5. **Rate limiter is in-memory**: Per-serverless-instance — not global. Acceptable for current scale; switch to Upstash Redis before high-traffic production.
6. **Widget API key is stored raw** for display in Settings. `apiKeyHash` is what's used for authentication lookups. Both are set at org creation time in `/api/register`.
7. **Decimal serialization**: `.toNumber()` required on all Decimal fields before `Response.json()`. Prisma Decimal objects serialize as strings otherwise.
8. **Prisma migrate dev in non-interactive env**: Refuses to run even with `--create-only`. Use `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` to generate SQL, manually create `migrations/<timestamp>_<name>/migration.sql`, then `prisma migrate deploy`.
