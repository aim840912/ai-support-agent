# AI Support Agent

A multi-tenant AI customer support SaaS platform with RAG-powered knowledge base, embeddable chat widget, and a full-featured dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Styling** | Tailwind CSS v4 |
| **Auth** | NextAuth v5 (beta) |
| **Database** | Prisma + Neon PostgreSQL (pgvector) |
| **LLM** | Vercel AI SDK + Groq |
| **Embeddings** | Google Gemini |
| **UI** | Radix UI + Lucide React + Recharts |

---

## Features

- **RAG Knowledge Base** — Upload documents, auto-chunk and embed, semantic vector search via pgvector
- **AI Chat Agent** — Tool-calling agent with order status lookup, inventory check, ticket creation, and KB search
- **Embeddable Widget** — Drop-in chat widget authenticated via API key (`/widget/[apiKey]`)
- **Dashboard** — Playground, knowledge base management, conversation history, analytics, and settings
- **Multi-tenant** — Organization model with free/pro plan support

---

## Project Structure

```
src/
  app/
    (auth)/              # Login, register
    (dashboard)/         # Playground, knowledge-base, conversations, analytics, settings
    widget/              # Embeddable chat widget
    api/                 # chat, documents, conversations, analytics, auth, register, widget
  lib/
    ai/                  # Agent orchestration, tools, prompts
    rag/                 # Embedding, text-splitter, vector-search, process-document
    chat/                # Chat stream factory
prisma/
  schema.prisma          # 10 models: Organization, User, Document, Embedding,
                         # ChatSession, ChatMessage, AgentSettings,
                         # Account, Session, VerificationToken
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- [Neon](https://neon.tech) PostgreSQL database with pgvector enabled
- [Groq](https://console.groq.com) API key
- [Google AI Studio](https://aistudio.google.com) API key (Gemini embeddings)

### Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd ai-support-agent

# 2. Install dependencies
pnpm install

# 3. Configure environment variables
cp .env.example .env.local
```

Edit `.env.local` and fill in the required values:

```env
DATABASE_URL=          # Neon PostgreSQL connection string
AUTH_SECRET=           # Random secret for NextAuth (generate with: openssl rand -base64 32)
AUTH_URL=              # Base URL (e.g. http://localhost:3000)
GOOGLE_GENERATIVE_AI_API_KEY=   # Gemini embeddings
GROQ_API_KEY=          # Groq LLM
```

```bash
# 4. Push schema to database
pnpm prisma db push

# 5. Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.
