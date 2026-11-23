import json

from fastapi.testclient import TestClient

from backend.app import app
from backend.database import init_db
from llm.hardware import detect_hardware
from llm.ollama_client import OllamaClient


client = TestClient(app)


def test_status_reports_local_only_configuration():
    result = client.get("/api/status")
    assert result.status_code == 200
    body = result.json()
    assert body["ollama"]["base_url"].startswith("http://127.0.0.1:")
    assert body["hardware"]["recommended_model"] in {
        "qwen3:1.7b",
        "qwen3:8b",
        "qwen3:14b",
    }


def test_hardware_detection_shape():
    hardware = detect_hardware()
    assert hardware["memory_gib"] > 0
    assert hardware["cpu_count"] >= 1


def test_ollama_default_has_no_cloud_endpoint():
    adapter = OllamaClient()
    assert "127.0.0.1" in adapter.base_url
    assert "http://" in adapter.base_url
