from pathlib import Path

from langgraph.graph import END, StateGraph

from llm.ollama_client import OllamaClient
from graph.state import SalesState


PROMPTS = Path(__file__).resolve().parent.parent / "prompts"


def _prompt(name: str) -> str:
    return (PROMPTS / name).read_text(encoding="utf-8").strip()


def create_sales_graph(client: OllamaClient | None = None):
    client = client or OllamaClient()

    def business_profile(state: SalesState) -> dict:
        payload = state.get("product", {})
        value = client.generate_json(
            _prompt("business_profile.txt"),
            f"Stored company and product data:\n{payload}",
        )
        return {"business_profile": value}

    def product_icp(state: SalesState) -> dict:
        payload = {
            "business_profile": state.get("business_profile", {}),
            "product": state.get("product", {}),
        }
        value = client.generate_json(_prompt("product_icp.txt"), str(payload))
        return {"icp": value}

    def classify_signals(state: SalesState) -> dict:
        payload = {
            "product": state.get("product", {}),
            "prospect": state.get("prospect", {}),
            "icp": state.get("icp", {}),
        }
        value = client.generate_json(_prompt("buying_signals.txt"), str(payload))
        signals = value.get("signals")
        if not isinstance(signals, list):
            raw = state.get("prospect", {}).get("raw_data", {})
            if isinstance(raw, dict):
                signals = [
                    {
                        "name": str(key),
                        "classification": "medium",
                        "reason": f"Stored prospect data reports {key}={value_item}.",
                    }
                    for key, value_item in raw.items()
                    if key not in {"source"} and value_item not in (None, "")
                ]
            else:
                signals = []
            value = {"signals": signals}
        return {"buying_signals": value}

    def problem(state: SalesState) -> dict:
        payload = {
            "prospect": state.get("prospect", {}),
            "icp": state.get("icp", {}),
            "buying_signals": state.get("buying_signals", {}),
            "product": state.get("product", {}),
        }
        value = client.generate_json(_prompt("problem_statement.txt"), str(payload))
        return {"problem": value}

    def score(state: SalesState) -> dict:
        payload = {
            "prospect": state.get("prospect", {}),
            "icp": state.get("icp", {}),
            "buying_signals": state.get("buying_signals", {}),
            "problem": state.get("problem", {}),
        }
        value = client.generate_json(_prompt("prospect_score.txt"), str(payload))
        return {"score": value}

    def outreach(state: SalesState) -> dict:
        payload = {
            "prospect": state.get("prospect", {}),
            "problem": state.get("problem", {}),
            "product": state.get("product", {}),
        }
        value = client.generate_json(_prompt("outreach.txt"), str(payload))
        return {"email": value}

    graph = StateGraph(SalesState)
    graph.add_node("business_profile", business_profile)
    graph.add_node("product_icp", product_icp)
    graph.add_node("classify_signals", classify_signals)
    graph.add_node("problem", problem)
    graph.add_node("score", score)
    graph.add_node("outreach", outreach)
    graph.set_entry_point("business_profile")
    graph.add_edge("business_profile", "product_icp")
    graph.add_edge("product_icp", "classify_signals")
    graph.add_edge("classify_signals", "problem")
    graph.add_edge("problem", "score")
    graph.add_edge("score", "outreach")
    graph.add_edge("outreach", END)
    return graph.compile()


def create_profile_graph(client: OllamaClient | None = None):
    client = client or OllamaClient()

    def business_profile(state: SalesState) -> dict:
        value = client.generate_json(
            _prompt("business_profile.txt"),
            f"Stored company and product data:\n{state.get('product', {})}",
        )
        return {"business_profile": value}

    def product_icp(state: SalesState) -> dict:
        payload = {
            "business_profile": state.get("business_profile", {}),
            "product": state.get("product", {}),
        }
        value = client.generate_json(_prompt("product_icp.txt"), str(payload))
        return {"icp": value}

    graph = StateGraph(SalesState)
    graph.add_node("business_profile", business_profile)
    graph.add_node("product_icp", product_icp)
    graph.set_entry_point("business_profile")
    graph.add_edge("business_profile", "product_icp")
    graph.add_edge("product_icp", END)
    return graph.compile()
