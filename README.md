# Harvey Local Sales Agent

A local-first, multi-product sales agent forked from the Sellbird/Harvey open-source project. It uses FastAPI, SQLite, LangChain/LangGraph, Ollama, Qwen3, React, and optional public-web research tools.

## Architecture

- React + Vite dashboard
- FastAPI API
- SQLite local storage
- LangGraph sales and reply workflows
- Ollama at `http://127.0.0.1:11434`
- Qwen3 8B by default
- BeautifulSoup and Playwright for separate public-web research

No OpenAI, Anthropic, Claude, Codex, Gemini, paid API, cloud inference, or token-billing integration is used by this application.

## Quick start

```powershell
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
copy .env.example .env

ollama pull qwen3:8b
python scripts/run_api.py
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Dashboard

The local dashboard has sections for:

- **Overview** — product/prospect counts, model connection, workflow progress, and recent local inference activity.
- **Products** — create products and review their generated business profile and ICP.
- **Prospects** — add locally known prospect details, inspect buying signals and fit scores, and review email drafts.
- **Replies** — classify a sample reply and see the suggested next action.
- **Activity** — inspect Ollama traces and queued tasks.

Email drafts are for review only; the app does not send email. Website URLs are stored as references and are not fetched by the product or prospect forms.

## Offline test

Start Ollama and the API, disconnect the network, then run:

```powershell
python scripts/offline_acceptance.py
```

The script exercises business profile generation, product ICP, prospect research, buying-signal classification, problem generation, prospect scoring, personalised email generation, and reply classification.

## Failure handling

If Ollama is stopped or the model is missing, the API returns HTTP 503 and queues the task in SQLite. It never falls back to a cloud model.

## Repository layout

```text
backend/       FastAPI and SQLite
frontend/      React dashboard
graph/         LangGraph workflows
llm/           Ollama and hardware adapters
prompts/       Local prompt files
scripts/       API runner, research, and acceptance test
docs/          Architecture and evidence
tests/         Automated tests
data/          Local SQLite database and traces
sellbird/      Retained upstream source; not used by the local entry point
```

## Documentation

- [Architecture](docs/local_architecture.md)
- [Offline acceptance](docs/offline_acceptance.md)
- [Licences and costs](docs/licences_and_cost.md)
- [Hardware profiles](docs/hardware.md)
- [Known limitations](docs/known_limitations.md)
