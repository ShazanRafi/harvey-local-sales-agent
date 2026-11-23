# Offline Acceptance Test

1. Install dependencies and download `qwen3:8b`.
2. Start the API and React frontend.
3. Disconnect network access.
4. Run `python scripts/offline_acceptance.py`.
5. Save the JSON output and `/api/traces` rows.

The script exercises all eight required AI workflows. It makes no external LLM or web request.
