# Chat with your AI Expert

Pick a domain expert, then work through a real task with them — a conversation that asks
what it needs to know before answering, not a one-shot reply.

**Live:** https://yg674-dev.github.io/ai-persona-chat/

---

## 1. Business goal

This is only worth building if people **finish tasks** with it, not if they start sessions. The
goal is to convert one-off assistant usage into completed work — and the bet on how: make the
assistant ask before it answers, on the theory that one short clarification round buys a
materially better first answer, and that a domain persona is what makes that clarification
competent instead of generic.

The gap it addresses: general-purpose chat assistants answer immediately and confidently, which is
the wrong behavior when the question is under-specified — and most real questions are. Chat with
your AI Expert routes the user to one of 32 domain personas, each of which opens by asking the two
or three things that actually change the answer, then works the task *with* the user instead of at
them.

Working prototype and startup concept. Two builds live here: the deployed single-file app and a
modular refactor.

## 2. Problem

- **The first answer is usually wrong because the question was.** "How should I price this?"
  has a different answer for a seed SaaS company and a local bakery, and a general assistant
  guesses rather than asks.
- **Expertise is a prompting skill.** Getting a useful answer out of a general model requires
  knowing what context to volunteer — which is exactly what a non-expert doesn't know.
- **Persona prompts are throwaway.** People paste a "you are a senior X" preamble, lose it,
  and rewrite it slightly differently next time, so quality is never cumulative.

## 3. Users and jobs to be done

| User | Job |
| --- | --- |
| **Operator with a specific task** (pricing page, term sheet, retention plan) | "Give me someone who knows this domain and will interrogate my situation before advising." |
| **Learner** | "Let me work a real problem alongside an expert, not read a generic explainer." |
| **Builder evaluating models** | "Run the same persona against Claude and OpenAI and compare, without rewriting anything." |

## 4. Goals and non-goals

**Goals**
- Ask before answering — every persona opens with clarifying questions.
- Make expertise reusable: a persona is a stored object, not a pasted preamble.
- Stay provider-neutral so personas outlive any single model.

**Non-goals (v1)**
- Not a general-purpose assistant. If the task has no domain, this is the wrong tool.
- No accounts, no server-side chat history, no team features.
- No claim of professional advice — the legal and financial personas are drafting aids.

## 5. Solution

| Piece | What it does |
| --- | --- |
| **Persona registry** | 32 experts, each with a role, system prompt, and its own opening questions |
| **Clarification engine** | Establishes what it needs to know before the first substantive answer |
| **Provider manager** | Claude and OpenAI behind one interface — a persona runs on either without touching persona code |
| **Workflow layer** | Skill registry plus a recommender that suggests the next useful move in the task |
| **Session storage** | Per-browser persistence; the conversation survives a refresh |
| **MCP discovery** *(backend)* | Finds MCP servers so a persona can reach external tools — the one job a browser can't do alone |

## 6. Functional requirements

1. A persona must ask at least one clarifying question before its first substantive answer.
2. Switching model provider must not change persona behavior or require a code change.
3. API keys are entered in the UI, held in browser session storage, and sent only to the
   model provider — never committed, never proxied through a third party.
4. The frontend must run with no build step and no server, so a reader can open it and see it work.
5. A session must survive a page refresh.

## 7. Success metrics

| | Metric |
| --- | --- |
| **North star** | Tasks carried to a usable artifact, not sessions started |
| **Leading** | Clarifying questions answered per session · turns per session · persona re-selection rate |
| **Lagging** | Return rate within 7 days · share of sessions reaching a copied or exported output |
| **Guardrail** | Abandonment during clarification — asking is the product, but asking too much kills it |

## 8. Risks

| Risk | Mitigation |
| --- | --- |
| **Clarification feels like friction** | Cap the opening questions; make them skippable; track abandonment as a guardrail |
| **Persona sprawl** — 32 experts nobody browses | Recommender surfaces the right one; registry keeps them consistent rather than ad hoc |
| **Advice in regulated domains** (legal, financial) | Framed as drafting aids; personas state their limits |
| **Key handling** | Session storage only, provider-direct calls, no server-side persistence |

## 9. Roadmap

- **Now** — deployed single-file app; modular refactor with provider abstraction and MCP backend.
- **Next** — promote `app/` to the deployed build; persona-level evals so prompt changes are measurable.
- **Later** — user-authored personas, shareable task transcripts, richer MCP tool use.

## 10. What's in this repo

| Path | What it is |
| --- | --- |
| `index.html` | The deployed single-file app — what GitHub Pages serves. Personas, prompts, chat UI, and key handling in one file, no build step. |
| `app/` | The modular refactor of the same product: ES modules plus a small Express backend. Not yet the deployed version. |
| `DEPLOY.md` | Deploy notes for the single-file version. |

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

## Running locally

The frontend is static — open `index.html` (or `app/index.html`) directly, or serve the folder
with any static server. For the MCP discovery backend:

```bash
cd app/backend
npm install
cp .env.example .env    # set FRONTEND_ORIGIN
npm run dev             # http://localhost:3001
```
