# Known Limitations

- Fresh prospect discovery requires a permitted public URL or local fixture data.
- Playwright/Scrapy are dependencies, but no production crawl policy is preconfigured.
- Email sending is outside this offline workflow.
- Sentence Transformers is a dependency, but the initial release uses direct local context rather than a vector database.
- Ollama and the selected model must be installed before offline use.
- Legacy upstream Claude/Codex source remains in the fork but is not used by the local entry point.
