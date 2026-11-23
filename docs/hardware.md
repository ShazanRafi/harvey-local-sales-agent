# Hardware and Model Selection

`/api/status` inspects RAM, CPU, and NVIDIA GPU visibility.

| Configuration | RAM/GPU condition | Model |
|---|---|---|
| Low memory | under 8 GB | `qwen3:1.7b` |
| Standard laptop | 8-16 GB | `qwen3:8b` |
| High performance | 32 GB or NVIDIA GPU | `qwen3:14b` |
| High memory/no GPU | 16-31 GB | `qwen3:8b` |

The recommendation is informational. `OLLAMA_MODEL` selects the active model.
