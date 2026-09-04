# Chat with your AI Expert

Pick a domain expert, then work through a real task with them in conversation — not a
one-shot answer, but a back-and-forth that asks clarifying questions first.

**Live:** https://yg674-dev.github.io/ai-persona-chat/

---

## What's here

| Path | What it is |
| --- | --- |
| `index.html` | The deployed single-file app — what GitHub Pages serves. Personas, prompts, chat UI, and API-key handling all in one file, no build step. |
| `app/` | The modular refactor of the same product, split into ES modules, with a small Express backend. Not yet the deployed version. |
| `DEPLOY.md` | Deploy notes for the single-file version. |

## The modular version (`app/`)

```
app/
├── index.html
├── js/
│   ├── personas/registry.js      32 expert personas — role, system prompt, opening questions
│   ├── providers/                Claude and OpenAI clients behind a provider-manager abstraction
│   ├── clarification/engine.js   asks what it needs to know before answering
│   ├── workflow/                 skill registry + recommender
│   └── utils/session-storage.js  per-browser session persistence
└── backend/                      Express proxy for MCP server discovery (Node 20+, Playwright)
```

Two model providers sit behind one interface, so a persona can run on Claude or OpenAI
without touching persona code. The backend exists only to do MCP discovery scraping that
a browser can't do directly.

## Running the backend locally

```bash
cd app/backend
npm install
cp .env.example .env    # set FRONTEND_ORIGIN
npm run dev             # http://localhost:3001
```

The frontend is static — open `index.html` (or `app/index.html`) directly, or serve the
folder with any static server. API keys are entered in the UI and kept in browser session
storage; they are never committed and never sent anywhere but the model provider.
