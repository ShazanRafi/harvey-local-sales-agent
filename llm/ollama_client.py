import json
import logging
import os
from typing import Any, Iterable

import httpx

logger = logging.getLogger("harvey.ollama")


class OllamaUnavailable(RuntimeError):
    pass


class OllamaClient:
    def __init__(
        self,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float = 180.0,
    ) -> None:
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")).rstrip("/")
        self.model = model or os.getenv("OLLAMA_MODEL", "qwen3:8b")
        self.timeout = timeout

    def health(self) -> dict[str, Any]:
        try:
            response = httpx.get(f"{self.base_url}/api/tags", timeout=5.0)
            response.raise_for_status()
            models = response.json().get("models", [])
            names = {item.get("name") for item in models}
            return {
                "ok": True,
                "base_url": self.base_url,
                "model": self.model,
                "model_available": self.model in names,
                "models": sorted(name for name in names if name),
            }
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            return {
                "ok": False,
                "base_url": self.base_url,
                "model": self.model,
                "model_available": False,
                "models": [],
                "error": f"Ollama unavailable: {exc}",
            }

    def generate(self, system: str, prompt: str, *, format: str = "json") -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "stream": False,
            "format": format,
            "options": {"temperature": 0.2, "num_ctx": 8192},
        }
        try:
            response = httpx.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            message = response.json()["message"]["content"]
            logger.info("Local Ollama inference completed model=%s", self.model)
            return message
        except httpx.HTTPError as exc:
            raise OllamaUnavailable(
                f"Ollama is unavailable at {self.base_url}. "
                "Start Ollama and ensure the configured model is installed."
            ) from exc
        except (KeyError, json.JSONDecodeError) as exc:
            raise OllamaUnavailable(f"Ollama returned an invalid response: {exc}") from exc

    def generate_json(self, system: str, prompt: str) -> dict[str, Any]:
        text = self.generate(system, prompt, format="json")
        try:
            value = json.loads(text)
        except json.JSONDecodeError as exc:
            raise OllamaUnavailable(f"Ollama returned invalid JSON: {exc}") from exc
        if not isinstance(value, dict):
            raise OllamaUnavailable("Ollama JSON response must be an object.")
        return value
