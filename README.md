# AgentDesk

A full-stack AI support agent built with **Next.js, React and TypeScript**. Claude answers support questions through **function calling**: it searches a help-centre knowledge base (**RAG** over an in-memory vector index), opens tickets, and looks up ticket status. Every tool call is shown live in an **agent trace** panel, with its input, output and timing.

The app also runs **without an API key**. In that case a deterministic offline planner drives the same tools, so anyone can clone the repo and try it in one minute.

## Features

- **Agent loop with function calling.** Claude decides which tool to call, the server runs it, and the result goes back to the model until it produces a final answer. A step limit stops runaway loops.
- **RAG.** Help articles are chunked into overlapping windows, embedded, and searched by cosine similarity. The model is told to answer only from retrieved passages.
- **Tool errors are visible, not silent.** Invalid tool input returns `{ error }` to the model rather than throwing, so the model can correct its next call. Errors are highlighted in the trace.
- **Agent trace UI.** Every call shows its arguments, its result, latency per tool, total latency and token usage.
- **Input validation** on the API route: message count, size, roles and JSON shape.
- **Tests and a retrieval eval** with Vitest.

## Architecture

```
Browser (React client component)
   │  POST /api/chat  { messages }
   ▼
Next.js route handler (app/api/chat/route.ts) ── validates input
   ▼
runAgent (lib/agent.ts)
   ├─ ANTHROPIC_API_KEY set → Claude tool-use loop (max 6 steps)
   └─ no key               → offline rule-based planner
   ▼
executeTool (lib/tools.ts)
   ├─ search_knowledge_base → VectorStore.search (lib/vectorStore.ts)
   ├─ create_ticket         → ticket store (lib/tickets.ts)
   └─ get_ticket_status     → ticket store
```

## Design decisions

- **Exact search over approximate search.** `VectorStore.search` scores all *n* chunks in O(n·d) and keeps the top *k* in a small sorted buffer (O(n·k)). That avoids sorting every score, which would cost O(n log n). Exact search is simple and fast up to roughly 100k chunks. Beyond that, I would move to an ANN index such as HNSW in pgvector or Qdrant.
- **Hashing-trick embeddings.** Unigrams and bigrams are hashed into 512 signed buckets and L2-normalised, with light stemming. There is no model download and no key, and the store accepts any embedding function. A hosted embedding model is a one-line swap.
- **Same tools in both modes.** The offline planner calls exactly the same `executeTool` as Claude, so tests cover the real tool code.

## Run it

```bash
npm install
cp .env.example .env.local     # optional: add ANTHROPIC_API_KEY to use Claude
npm run dev                    # http://localhost:3000
```

```bash
npm test          # unit tests + retrieval eval
npm run typecheck
npm run build
```

## Retrieval eval

`tests/retrieval-eval.test.ts` runs 20 hand-labelled queries. Each one is worded differently from the article it should find. The test checks whether the right article ranks first (hit@1) or in the top 3 (hit@3).

Current result: **hit@1 20/20, hit@3 20/20.** This is a small, self-written set over 8 articles. It is a regression check, not a benchmark.

## Next steps

- Stream agent steps to the UI (Server-Sent Events) instead of returning them all at the end
- Persist tickets in PostgreSQL
- Swap in a hosted embedding model and compare it against this eval
- Add a React Native (Expo) client against the same `/api/chat` endpoint
