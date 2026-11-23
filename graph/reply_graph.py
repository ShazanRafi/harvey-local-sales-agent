from pathlib import Path

from langgraph.graph import END, StateGraph
from llm.ollama_client import OllamaClient

PROMPT = (Path(__file__).resolve().parent.parent / "prompts" / "reply_classify.txt").read_text(encoding="utf-8")


def create_reply_graph(client: OllamaClient | None = None):
    client = client or OllamaClient()

    def classify(state: dict) -> dict:
        result = client.generate_json(PROMPT, f"Reply text:\n{state.get('reply_text', '')}")
        return {"reply": result}

    graph = StateGraph(dict)
    graph.add_node("classify", classify)
    graph.set_entry_point("classify")
    graph.add_edge("classify", END)
    return graph.compile()
