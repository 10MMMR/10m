# 10m

AI-assisted study workspace built with Next.js, Supabase, Tiptap, and Gemini.

## Table of Contents

- [Overview](#overview)
- [Stack](#stack)
- [AI Overview](#ai-overview)
- [Rate Limiting](#rate-limiting)
- [AI Action Registry](#ai-action-registry)
- [Chat Flow](#chat-flow)
- [Note Generation Flow](#note-generation-flow)
- [AI Contracts](#ai-contracts)
- [Context Building](#context-building)
- [Prompting Rules](#prompting-rules)
- [Workspace Behavior](#workspace-behavior)
- [Configuration](#configuration)
- [Development](#development)
- [Key Files](#key-files)

## Overview

This project is a study workspace with two AI features:

1. Context-aware chat tied to the active note or PDF in the middle pane.
2. AI note generation that creates a new note or overwrites the current note using selected notes and PDFs as source context.

The AI system is command-driven. Chat does not return arbitrary assistant prose from the server. It returns structured JSON with an `action`, and the client decides what to do next.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase auth, database, and storage
- Tiptap rich text editor
- Gemini API as the current AI provider

## AI Overview

There are two server routes for AI:

- `POST /api/chat`
  - Classifies the user turn and returns a structured assistant command.
  - Used for normal chat and for deciding when chat should trigger note generation.
- `POST /api/notes/generate`
  - Generates validated TipTap JSON for a note body.
  - Used by tree-based note generation and chat-triggered note generation.

The shared AI layer lives in `lib/ai/` and is responsible for:

- provider selection
- config loading
- prompt definitions
- assistant command parsing
- note document validation
- authenticated source-context loading from Supabase

## Rate Limiting

API rate limiting is centralized in:

- `lib/api/rate-limit.ts`
- `lib/api/rate-limit-rules.ts`

How it works:

- Fixed-window limiter keyed by route + caller identity.
- Identity is `user:{userId}` when authenticated, otherwise `ip:{forwarded-or-real-ip}`.
- Each protected route consumes from its configured limit before running core logic.
- Storage backend:
  - if `REDIS_URL` is configured, counters are stored in Redis (shared across instances)
  - otherwise, counters fall back to in-memory (single-instance scope)
- The client reads `Retry-After` and `X-RateLimit-*` headers and applies per-action cooldown messaging (chat, note generation, PDF/image upload, and PDF delete).
- Limit violations return `429` with:
  - `Retry-After`
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

Current route rules (`windowMs = 60_000`):

- `POST /api/chat`: `2` requests/window
- `POST /api/notes/generate`: `20` requests/window
- `POST /api/uploads/image`: `20` requests/window
- `POST /api/uploads/pdf`: `12` requests/window
- `DELETE /api/uploads/pdf`: `30` requests/window
- `POST /api/editor/log-invalid-document`: `8` requests/window

`/api/editor/log-invalid-document` has additional protection:

- Auth is required.
- When over limit, the route returns `202` with `{ ok: true, sampled: true }` and skips `console.error` emission to reduce log noise.

Operational note:

- Redis mode is recommended for production so limits are global across replicas.
- In-memory mode is process-local and only safe for local dev or single-instance deploys.

## AI Action Registry

The AI capability list is stored in `lib/ai/actions.ts`. This is the canonical source of truth for what the assistant is allowed to do.

Current transport actions:

- `reply`
- `generate_note`

Current note-operation capability labels:

- `create_new_note`
- `overwrite_current_note`

These are internal registry/prompt labels, not response payload values. On the wire, the assistant can only return:

- `action: "reply"`
- `action: "generate_note"` with `target: "current_note" | "new_note"`

Unsupported requests must resolve to `reply`, not a new action. That includes requests such as:

- opening a PDF
- navigating panes
- selecting files in the tree
- manipulating the UI directly

When the user asks for one of those, the assistant should reply that it cannot do that yet.

## Chat Flow

Chat is scoped to the active middle-pane document.

- If the active item is a note, chat uses that note as context.
- If the active item is a PDF, chat uses that PDF as context.
- If no note or PDF is open, chat is disabled.
- Switching to another note or PDF swaps to that document's transient chat session.
- No cross-document chat persistence is guaranteed when navigating away and back.

Client flow:

1. User sends a chat message from the right pane.
2. The client sends `classId`, `activeNodeId`, `messages`, and optional draft note context to `POST /api/chat`.
3. The server builds source context for the active note or PDF.
4. Gemini returns structured JSON.
5. The server validates that JSON into an `AssistantCommand`.
6. The client renders `assistant.message`.
   - Assistant messages are rendered as Markdown in the chat pane.
7. The client either:
   - stops if `action === "reply"`
   - triggers note generation if `action === "generate_note"`

## Note Generation Flow

There are two entry points.

### Tree-Triggered Generation

Triggered by `Generate notes` from the left tree menu.

- Uses the current multi-selection if the clicked node is already selected.
- Otherwise uses only the clicked node.
- Filters sources to notes and PDFs only.
- Creates a new note at the class root.
- Calls `POST /api/notes/generate`.
- Writes returned TipTap JSON into the note body.
- Persists the note.

### Chat-Triggered Generation

Triggered when chat returns `action: "generate_note"`.

- Uses the active note or PDF as the default source context.
- If `target === "current_note"` and the active item is a note, the current note is overwritten.
- Otherwise a new root note is created.
- The new or overwritten note is populated with generated TipTap JSON and saved.

Temporary behavior during generation:

- The target note is opened first.
- A placeholder TipTap document is shown while generation is running.
- If generation fails, the note stays open and receives a short failure document instead of silently reverting.

## AI Contracts

### `POST /api/chat`

Request body:

```json
{
  "classId": "cs101-ai",
  "activeNodeId": "note-node-id-or-file-node-id",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "draftContext": {
    "nodeId": "note-node-id",
    "title": "Current draft title",
    "contentJson": {
      "type": "doc",
      "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Current unsaved note" }] }]
    }
  }
}
```

Notes:

- `messages` must be a non-empty array.
- Each message must be `{ "role": "user" | "assistant", "content": string }`.
- Empty or whitespace-only message content is rejected.
- `draftContext` is optional.
- `draftContext` must include non-empty `nodeId`, `title`, and valid `contentJson` when provided.
- `draftContext` only matters when the active source is the same note currently being edited.

Response body:

```json
{
  "assistant": {
    "action": "reply",
    "message": "..."
  }
}
```

or

```json
{
  "assistant": {
    "action": "generate_note",
    "message": "...",
    "prompt": "...",
    "target": "new_note",
    "title": "Optional title"
  }
}
```

Allowed assistant actions:

- `reply`
- `generate_note`

Internal note-operation capability labels referenced by prompts:

- `create_new_note`
- `overwrite_current_note`

Actual `generate_note` response field:

- `current_note`
- `new_note`

### `POST /api/notes/generate`

Request body:

```json
{
  "classId": "cs101-ai",
  "sourceNodeIds": ["note-id", "file-id"],
  "mode": "new_note",
  "targetNoteId": "optional-target-note-node-id",
  "title": "Optional title",
  "prompt": "Normalized note-generation instruction",
  "draftContext": {
    "nodeId": "note-id",
    "title": "Unsaved title",
    "contentJson": {
      "type": "doc",
      "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "Unsaved body" }] }]
    }
  }
}
```

`mode` values:

- `new_note`
- `overwrite_note`

Notes:

- `sourceNodeIds` must be a non-empty array of valid node IDs.
- `prompt` must be a non-empty string.
- `targetNoteId` is optional, but must be a valid node ID when provided.
- `draftContext` follows the same validation rules as `/api/chat`.

Response body:

```json
{
  "contentJson": {
    "type": "doc",
    "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }]
  },
  "title": "Optional title"
}
```

## Context Building

Source context is assembled server-side in `lib/ai/server-context.ts`.

Rules:

- All AI routes require authenticated Supabase users.
- `classId` and node IDs are validated before context loading.
- The server loads the class tree from Supabase.
- Each source node must exist and be either:
  - `note`
  - `file`
- Notes are sent as text parts containing:
  - note title
  - plain text derived from the stored TipTap document
- PDFs are downloaded from Supabase Storage and sent to Gemini as `inlineData` parts with base64 content.
- There is currently no documented request-size cap beyond the PDF upload limit, so context size scales with selected sources and message history.
- If the active note has unsaved local edits, `draftContext` replaces the stored note title/content for that note during context construction.

This means the model can reason over:

- saved notes
- unsaved note edits currently in the editor
- uploaded PDFs

## Prompting Rules

Two prompts are defined in `lib/ai/prompts.ts`.

### Chat Prompt

The chat system prompt enforces that StudyAI:

- behaves like a premium study assistant
- is concise and exam-focused
- avoids fluff
- always returns JSON
- uses `generate_note` when the user asks to create, rewrite, or overwrite notes
- never claims unsupported UI or navigation abilities
- falls back to `reply` when the user asks for unsupported actions such as opening a PDF or navigating the app

### Note Generation Prompt

The note-generation prompt enforces that output:

- is HTML only
- has no markdown fences
- has no JSON wrapper
- is grounded in provided sources
- is concise, structured, and study-focused

Preferred HTML structures:

- `h1`, `h2`, `h3`
- `p`
- `strong`, `em`, `mark`
- `ul`, `ol`, `li`
- `table`, `thead`, `tbody`, `tr`, `th`, `td`

## Workspace Behavior

The client behavior is implemented in `app/editor/class/[class-id]/_components/workspace-shell.tsx`.

Important rules:

- Chat sessions are stored per active note or PDF node ID.
- Chat input is cleared when the active AI context changes.
- In-flight AI work is aborted on context change or unmount.
- Chat is disabled when the middle pane is not showing a note or PDF.
- Tree-based note generation and chat-triggered note generation both use the same internal generation path.
- New AI-generated notes are created at the class root for now.

Title behavior:

- If AI provides a `title`, that title is used.
- Otherwise generated notes default to:
  - `Study Notes - {source title}` for one source
  - `Study Notes - {first source title} + {n} more` for multiple sources
- Overwrite mode keeps the current note title unless AI provides a replacement title.

Failure behavior:

- Invalid AI config returns a 500 from the route.
- Invalid request payloads return 400.
- Missing auth returns 401.
- Invalid assistant JSON fails on the server before it reaches the client.
- Invalid generated HTML is rejected before being saved.

## Configuration

AI config is loaded from `lib/ai/config.ts`.

Required environment variables:

- `AI_MODEL`
- `GEMINI_API_KEY`

Optional AI environment variables:

- `AI_PROVIDER`
  - defaults to `gemini`
- `AI_REQUIRE_AUTH`
  - parsed by config today, but current AI routes still always require authenticated Supabase users
- `REDIS_URL`
  - Redis connection string used by API rate limiting.
  - Example format: `redis://default:<password>@<host>:<port>` or `rediss://default:<password>@<host>:<port>` depending on your Redis Cloud endpoint.

Supabase-related environment variables used by the AI and storage flows:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_STORAGE_BUCKET`

## Development

Install dependencies, then run the app:

```bash
pnpm install
pnpm run dev
```

Useful scripts:

```bash
pnpm run lint
pnpm test
```

## Key Files

- `app/api/chat/route.ts`
  - chat command route
- `app/api/notes/generate/route.ts`
  - HTML note-generation route
- `app/editor/class/[class-id]/_components/workspace-shell.tsx`
  - client-side AI routing, note creation, overwrite logic, and chat session state
- `lib/ai/assistant-contract.ts`
  - assistant command schema and HTML normalization
- `lib/ai/actions.ts`
  - canonical AI capability and action registry
- `lib/ai/prompts.ts`
  - system prompts
- `lib/ai/server-context.ts`
  - auth, validation, note loading, PDF loading, and draft context merging
- `lib/ai/providers/gemini.ts`
  - Gemini request builder and text generation call
- `lib/api/rate-limit.ts`
  - centralized rate-limit backend (Redis + in-memory fallback), identity strategy, and headers
- `lib/api/rate-limit-rules.ts`
  - per-route rate-limit configuration
