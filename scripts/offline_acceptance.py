import json
import sys

import httpx

BASE = "http://127.0.0.1:8000"


def post(path: str, payload: dict) -> dict:
    response = httpx.post(BASE + path, json=payload, timeout=180)
    response.raise_for_status()
    return response.json()


def main() -> int:
    status = httpx.get(BASE + "/api/status", timeout=10).json()
    if not status["ollama"]["ok"]:
        print(json.dumps({"passed": False, "error": "Ollama unavailable", "status": status}, indent=2))
        return 1

    product = post("/api/products", {
        "name": "Harbor Booking",
        "description": "A local appointment scheduling platform for dental and HVAC businesses.",
        "website": "https://example.test",
        "company_information": {
            "industries": ["dental", "HVAC"],
            "strength": "simple setup",
        },
    })
    profile = post(f"/api/products/{product['id']}/profile", {})
    prospect = post("/api/prospects", {
        "product_id": product["id"],
        "name": "Jordan Lee",
        "company": "Metro Dental Studio",
        "role": "Practice Owner",
        "website": "https://example.test",
        "raw_data": {
            "hiring": "No",
            "booking": "Phone only",
            "source": "Locally stored fixture",
        },
    })
    research = post(f"/api/prospects/{prospect['id']}/research", {})
    reply = post("/api/replies", {
        "prospect_id": prospect["id"],
        "reply_text": "This sounds useful. Can you show me a 20-minute demo next Tuesday?",
    })
    result = {
        "passed": True,
        "offline_mode": "No external LLM API was configured or contacted",
        "status": status,
        "business_profile": profile["business_profile"],
        "product_icp": profile["icp"],
        "buying_signals": research["buying_signals"],
        "problem_statement": research["problem"],
        "prospect_score": research["score"],
        "personalised_email": research["email"],
        "reply_classification": reply["classification"],
    }
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
