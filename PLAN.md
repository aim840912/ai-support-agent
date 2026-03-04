# AI Support Agent SaaS — Project Plan

> Phase 1 of「AI 時代全端工程師精進計畫」
> 目標：展示 Tool Use + Agent Loop 能力，從 $25/hr 升級到 $50+/hr。

---

## 專案概述

**一句話**：幫助 B2B 企業快速部署可嵌入式 AI 客服 Agent，透過 RAG 知識庫 + Tool Use 自動處理常見客服請求。

**核心功能**：
- 多租戶（Organization）知識庫上傳與管理
- AI Agent 自動回答問題（RAG + Tool Use）
- 可嵌入 Widget（一行 Script Tag 部署）
- 對話歷史與分析面板

---

## 技術架構

### 技術棧

| 層級 | 技術 | 選擇理由 |
|------|------|---------|
| Frontend | Next.js 15 + Tailwind CSS + shadcn/ui | App Router + RSC，展示現代全端能力 |
| AI UI | Vercel AI SDK `useChat` hook | 內建 streaming + tool call 狀態管理 |
| Backend | Next.js Route Handlers | 展示不依賴 NestJS 的架構能力 |
| Database | PostgreSQL + Prisma + pgvector | 向量搜尋（cosine distance）|
| Auth | NextAuth.js v5 + Prisma Adapter | Next.js 原生整合 |
| AI | Vercel AI SDK v6 | Tool Use + Agent Loop 核心能力 |
| LLM | Groq (llama-3.1-70b-versatile) | 免費 + 高速推論 |
| Embedding | Google Gemini (gemini-embedding-001) | 免費 + 768 維度 |
| DB Host | Neon PostgreSQL | 免費方案，pgvector 支援 |
| Deploy | Vercel Hobby | 免費，與 Next.js 最佳整合 |
| Widget | Shadow DOM + Rollup IIFE | 可嵌入任意網站，無樣式污染 |

### 目錄結構

```
ai-support-agent/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (dashboard)/
│   │   │   ├── knowledge-base/page.tsx   # 文件上傳管理
│   │   │   ├── conversations/page.tsx    # 對話歷史
│   │   │   ├── playground/page.tsx       # 測試 Agent
│   │   │   ├── analytics/page.tsx        # 數據分析
│   │   │   └── settings/page.tsx         # API Key、Widget 設定
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts
│   │   │   ├── chat/route.ts             # Agent 主入口（streamText + tools）
│   │   │   ├── documents/
│   │   │   │   ├── route.ts              # 上傳文件
│   │   │   │   └── [id]/route.ts         # 刪除文件
│   │   │   └── widget/[orgId]/route.ts   # Widget 公開 API
│   │   ├── embed/
│   │   │   └── [orgId]/page.tsx          # Widget iframe 頁面
│   │   └── layout.tsx
│   ├── components/
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx          # useChat 主元件
│   │   │   ├── MessageBubble.tsx         # Markdown + streaming cursor
│   │   │   ├── SourcesList.tsx           # 展開式 citations
│   │   │   └── ToolCallDisplay.tsx       # Tool 執行狀態顯示
│   │   ├── dashboard/
│   │   │   ├── DocumentList.tsx
│   │   │   ├── UploadDropzone.tsx
│   │   │   └── ConversationTable.tsx
│   │   └── ui/                           # shadcn/ui 元件
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── tools/
│   │   │   │   ├── search-knowledge-base.ts
│   │   │   │   ├── get-order-status.ts
│   │   │   │   ├── create-ticket.ts
│   │   │   │   └── check-inventory.ts
│   │   │   ├── agent.ts                  # ToolLoopAgent 配置
│   │   │   └── prompts.ts                # System prompt 模板
│   │   ├── rag/
│   │   │   ├── text-splitter.ts          # 從 ai-chatbot-demo 複用
│   │   │   ├── embedding.ts              # Gemini embedding API
│   │   │   └── vector-search.ts          # pgvector cosine distance 查詢
│   │   ├── db.ts                         # Prisma client singleton
│   │   └── auth.ts                       # NextAuth 配置
│   └── types/
│       ├── agent.ts
│       └── index.ts
├── widget/
│   ├── src/
│   │   ├── index.ts                      # Shadow DOM 入口
│   │   └── ChatWidget.ts                 # Widget UI
│   ├── rollup.config.js                  # 打包為 IIFE
│   └── package.json
├── prisma/
│   └── schema.prisma
├── .env.example
└── PLAN.md
```

---

## 資料庫 Schema（多租戶）

```prisma
// prisma/schema.prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

model Organization {
  id           String          @id @default(cuid())
  name         String
  apiKey       String          @unique @default(cuid())
  plan         String          @default("free")  // free | pro
  settings     Json?           // { theme, welcomeMessage, ... }
  createdAt    DateTime        @default(now())

  users        User[]
  documents    Document[]
  chatSessions ChatSession[]
  agentSettings AgentSettings?
}

model User {
  id        String       @id @default(cuid())
  email     String       @unique
  password  String?      // hashed, null if OAuth
  role      String       @default("member")  // owner | admin | member
  orgId     String
  org       Organization @relation(fields: [orgId], references: [id])
  createdAt DateTime     @default(now())

  accounts  Account[]    // NextAuth
  sessions  Session[]    // NextAuth
}

model Document {
  id         String      @id @default(cuid())
  filename   String
  status     String      @default("processing")  // processing | ready | error
  chunkCount Int         @default(0)
  orgId      String
  org        Organization @relation(fields: [orgId], references: [id])
  createdAt  DateTime    @default(now())

  embeddings Embedding[]
}

model Embedding {
  id         String                      @id @default(cuid())
  chunkText  String
  vector     Unsupported("vector(768)")  // Gemini embedding 維度
  documentId String
  document   Document                    @relation(fields: [documentId], references: [id], onDelete: Cascade)
  orgId      String                      // 冗餘欄位，加速多租戶過濾
}

model ChatSession {
  id        String       @id @default(cuid())
  visitorId String?      // 匿名訪客 ID
  userId    String?      // 登入用戶 ID
  orgId     String
  source    String       @default("widget")  // widget | dashboard | api
  org       Organization @relation(fields: [orgId], references: [id])
  createdAt DateTime     @default(now())

  messages  ChatMessage[]
}

model ChatMessage {
  id         String      @id @default(cuid())
  role       String      // user | assistant | tool
  content    String
  sources    Json?       // [{ documentId, chunkText, score }]
  toolCalls  Json?       // Vercel AI SDK tool call records
  sessionId  String
  session    ChatSession @relation(fields: [sessionId], references: [id])
  createdAt  DateTime    @default(now())
}

model AgentSettings {
  id             String       @id @default(cuid())
  orgId          String       @unique
  org            Organization @relation(fields: [orgId], references: [id])
  systemPrompt   String?
  welcomeMessage String       @default("您好！我是 AI 客服，有什麼可以幫助您的嗎？")
  theme          Json?        // { primaryColor, logoUrl }
  enabledTools   String[]     @default(["searchKnowledgeBase"])
}

// NextAuth 必要 Models
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

---

## AI Agent 設計

### Tool Use 架構（Vercel AI SDK v6）

```typescript
// src/lib/ai/agent.ts
import { streamText, tool, stopWhen, stepCountIs } from 'ai'
import { createGroq } from '@ai-sdk/groq'
import { searchKnowledgeBase } from './tools/search-knowledge-base'
import { getOrderStatus } from './tools/get-order-status'
import { createTicket } from './tools/create-ticket'
import { checkInventory } from './tools/check-inventory'

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY })

export function createSupportAgent(orgId: string, systemPrompt: string) {
  return {
    model: groq('llama-3.1-70b-versatile'),
    system: systemPrompt,
    tools: {
      searchKnowledgeBase: searchKnowledgeBase(orgId),
      getOrderStatus,
      createTicket,           // needsApproval: true — 前端顯示確認 UI
      checkInventory,
    },
    stopWhen: stepCountIs(10), // 防止無限 loop（v6 API，非 maxSteps）
  }
}
```

### 四個核心工具

```typescript
// 1. RAG 知識庫搜尋（最核心）
searchKnowledgeBase(orgId) = tool({
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => vectorSearch(query, orgId)
})

// 2. 訂單狀態查詢（Mock 數據 demo）
getOrderStatus = tool({
  inputSchema: z.object({ orderId: z.string() }),
  execute: async ({ orderId }) => mockOrders[orderId] ?? 'Not found'
})

// 3. 建立工單（需要用戶確認）
createTicket = tool({
  inputSchema: z.object({
    issue: z.string(),
    priority: z.enum(['low', 'medium', 'high'])
  }),
  execute: async ({ issue, priority }) => createSupportTicket({ issue, priority })
  // 前端 ToolCallDisplay 顯示確認按鈕，用戶點選後才執行
})

// 4. 庫存查詢（Mock 數據 demo）
checkInventory = tool({
  inputSchema: z.object({ productId: z.string() }),
  execute: async ({ productId }) => mockInventory[productId] ?? 0
})
```

### API Route（Agent 主入口）

```typescript
// src/app/api/chat/route.ts
import { streamText, convertToModelMessages } from 'ai'  // v6 必須轉換

export async function POST(req: Request) {
  const { messages, sessionId, orgId } = await req.json()
  const settings = await getAgentSettings(orgId)

  const result = streamText({
    ...createSupportAgent(orgId, settings.systemPrompt),
    messages: convertToModelMessages(messages),  // UIMessage → ModelMessage
    onFinish: async ({ text, toolCalls }) => {
      await saveChatMessage({ sessionId, role: 'assistant', content: text, toolCalls })
    }
  })

  return result.toDataStreamResponse()
}
```

---

## 可嵌入 Widget 架構

### 嵌入方式（客戶網站）

```html
<!-- 客戶只需加這一行 -->
<script src="https://ai-support-agent.vercel.app/widget.js"
        data-org-id="org_abc123"
        data-position="bottom-right">
</script>
```

### Widget 技術方案

```
客戶網站                     ai-support-agent.vercel.app
    │                                    │
    ├─ widget.js (IIFE, ~20KB) ─────────►│
    │  Shadow DOM (隔離樣式)              │
    │  ├─ 懸浮按鈕 (FAB)                 │
    │  └─ 聊天視窗 (iframe)  ─────────►  │  /embed/[orgId]
    │                                    │  Next.js iframe 頁面
    │                              POST /api/widget/[orgId]/chat
    │                              (用 API Key 認證，非 session)
```

### 為何用 Shadow DOM + iframe

- **Shadow DOM**：懸浮按鈕與客戶網站樣式完全隔離
- **iframe**：聊天視窗完整隔離，可使用 React/Next.js 全功能
- **Rollup IIFE**：bundle 無 external 依賴，單一 JS 檔案即可運作

---

## 從 ai-chatbot-demo 複用的程式碼

| 元件 | 來源路徑 | 目標路徑 | 複用方式 |
|------|---------|---------|---------|
| Text Splitter | `apps/api/src/common/text-splitter.ts` | `src/lib/rag/text-splitter.ts` | 直接複製（零依賴，87 行） |
| Vector Search SQL | `apps/api/src/modules/chat/services/vector-search.service.ts` | `src/lib/rag/vector-search.ts` | 改寫為函數（去掉 NestJS 裝飾器）|
| Source Types | `packages/shared-types/src/` | `src/types/index.ts` | 合併型別定義 |
| System Prompt 設計 | `apps/api/src/modules/chat/chat.service.ts` | `src/lib/ai/prompts.ts` | 參考 RAG context 注入模式 |
| MessageBubble UI | `apps/web/src/components/chat/MessageBubble.tsx` | `src/components/chat/MessageBubble.tsx` | 調整為 Vercel AI SDK 介面 |
| SourcesList UI | `apps/web/src/components/chat/SourcesList.tsx` | `src/components/chat/SourcesList.tsx` | 直接複用（展開式 citations） |
| Mock Mode 偵測 | `apps/api/src/common/mock-mode.ts` | `src/lib/mock-mode.ts` | 直接複製 |

> **節省工時**：以上元件複用預計節省 ~2-3 天開發時間。

---

## Week 1-4 開發時程

### Week 1：基礎架構 + Auth + Dashboard

**目標**：能登入、上傳文件、看到文件列表

- [ ] `npx create-next-app@latest` 初始化
- [ ] Prisma + Neon 連線設定，執行 migration
- [ ] NextAuth.js v5 設定（email/password）
- [ ] Dashboard layout（shadcn/ui sidebar）
- [ ] 文件上傳 UI + API Route（multipart/form-data）
- [ ] 文件處理 Pipeline：PDF parse → text split → Gemini embed → 存 pgvector
- [ ] `vercel deploy` 驗證基礎建置

**驗收**：可上傳 PDF，database 有 embeddings 資料

---

### Week 2：AI Agent 核心

**目標**：能在 Playground 與 Agent 對話，Tool Use 正常運作

- [ ] Groq API 整合 + `createGroq` 配置
- [ ] 四個 Tool 實作（含 Mock 數據）
- [ ] `POST /api/chat` Route Handler（`streamText` + `convertToModelMessages`）
- [ ] `ChatInterface.tsx`（`useChat` hook + streaming 顯示）
- [ ] `MessageBubble.tsx`（Markdown 渲染 + streaming cursor）
- [ ] `ToolCallDisplay.tsx`（工具執行狀態 + createTicket 確認 UI）
- [ ] `SourcesList.tsx`（RAG 來源展開）
- [ ] Playground 頁面完整測試

**驗收**：問題能透過 RAG 搜尋回答，createTicket 能顯示確認 UI

---

### Week 3：Widget + 多租戶

**目標**：Widget 可嵌入外部網站，多 Org 資料隔離正常

- [ ] Widget 目錄初始化（Rollup + TypeScript）
- [ ] Shadow DOM FAB 按鈕
- [ ] iframe 嵌入 `/embed/[orgId]`
- [ ] `/api/widget/[orgId]` 公開 API（API Key 認證）
- [ ] Org 設定頁面（API Key 顯示、嵌入代碼生成）
- [ ] Widget Script Tag embed code 生成器
- [ ] `AgentSettings` CRUD（修改 system prompt、welcome message）
- [ ] 多租戶隔離驗證（不同 Org 無法看到彼此資料）

**驗收**：在 `localhost:3001` 靜態頁面嵌入 Widget，能正常對話

---

### Week 4：Analytics + Polish + Portfolio

**目標**：對話分析面板完成，可作為作品集展示

- [ ] Analytics 頁面（對話量、常見問題、回答成功率）
- [ ] 對話歷史列表（含 Tool Call 記錄）
- [ ] 深色模式支援
- [ ] Mobile 響應式優化（Widget 小螢幕）
- [ ] README 撰寫（Upwork 提案用的技術亮點說明）
- [ ] Demo 影片錄製（Screen record Playground + Widget 嵌入）
- [ ] Vercel 正式環境部署驗證

**驗收**：能錄製一個完整的 demo 影片，可在 Upwork 提案中使用

---

## 免費 API 策略

| 服務 | 免費額度 | 預估用量 | 備註 |
|------|---------|---------|------|
| Groq | 每天 14,400 個請求 | < 500 req/day | 生產環境考慮 Gemini |
| Google Gemini embedding | 1,500 req/min | < 100 chunks/天 | 完全夠用 |
| Neon PostgreSQL | 0.5 GB storage | < 100MB | 足夠 demo 資料量 |
| Vercel Hobby | 100 GB bandwidth | 幾乎可忽略 | 無 Serverless 限制 |

> **總成本：$0/月**（開發期間）

---

## Vercel AI SDK v6 關鍵 API 備忘

```typescript
// ✅ v6 正確 API（與 v4 不同！）
import { streamText, tool, stopWhen, stepCountIs, convertToModelMessages } from 'ai'

// Tool 定義：用 inputSchema，非 parameters
const myTool = tool({
  inputSchema: z.object({ ... }),    // ✅ v6
  // parameters: z.object({ ... }), // ❌ v4 舊語法
  execute: async (args) => { ... }
})

// 多步驟控制：stopWhen，非 maxSteps
streamText({
  stopWhen: stepCountIs(10),         // ✅ v6
  // maxSteps: 10,                   // ❌ v4 舊語法
})

// 前端 UIMessage → 後端 ModelMessage
convertToModelMessages(messages)     // ✅ v6 必須轉換

// 環境變數
GROQ_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...

// 文檔：https://ai-sdk.dev（非 sdk.vercel.ai）
```

---

## 驗證清單

### 技術驗證

- [ ] `gh repo view ai-support-agent` — 確認 repo 為 private
- [ ] Neon DB 連線 + pgvector extension 啟用
- [ ] Prisma migration 成功執行
- [ ] Gemini embedding API 回傳 768 維度向量
- [ ] Groq API 能正常 streaming
- [ ] Agent 能執行多步驟 Tool Use（searchKnowledgeBase → 回答）
- [ ] createTicket Tool 顯示確認 UI，用戶點選後才執行
- [ ] Widget 在外部網站可嵌入且樣式隔離

### 作品集驗證

- [ ] README 有清晰的架構說明和 Tech Stack
- [ ] Demo 影片展示：上傳文件 → 知識庫建立 → Widget 對話 → Tool Use
- [ ] Upwork 提案可引用：「Built multi-tenant AI support agent with RAG + tool use」
- [ ] GitHub commit 歷史展示漸進式開發過程

---

## 延伸功能（Phase 2，不在當前範圍）

- [ ] Stripe 訂閱（Free / Pro 方案）
- [ ] Email 通知（工單建立後通知客服人員）
- [ ] Slack 整合（工單推送到 Slack channel）
- [ ] 多語言支援（i18n）
- [ ] A/B 測試不同 system prompt
- [ ] Custom domain for Widget（`support.customer.com`）
