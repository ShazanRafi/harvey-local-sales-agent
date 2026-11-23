# Local Architecture

## Request flow

1. React sends product, prospect, or reply data to FastAPI.
2. FastAPI stores state in SQLite.
3. LangGraph invokes a local Ollama chat completion.
4. Ollama runs Qwen3 or the configured local model.
5. FastAPI stores results and model traces.
6. The dashboard displays output and local system status.

## Workflows

- Business profile and product ICP: `sales_graph`
- Buying signals, problem statement, score, and email: `sales_graph`
- Reply classification: `reply_graph`

## Queue behaviour

Ollama failures return HTTP 503 and create `jobs(status='queued')` rows in SQLite. No cloud fallback is configured.
