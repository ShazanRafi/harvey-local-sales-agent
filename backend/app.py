import json
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.database import connect, init_db
from graph.reply_graph import create_reply_graph
from graph.sales_graph import create_profile_graph, create_sales_graph
from llm.hardware import detect_hardware
from llm.ollama_client import OllamaClient, OllamaUnavailable


class ProductInput(BaseModel):
    name: str
    description: str
    website: str | None = None
    company_information: dict[str, Any] = Field(default_factory=dict)


class ProspectInput(BaseModel):
    product_id: int
    name: str
    company: str
    role: str = ""
    website: str = ""
    raw_data: dict[str, Any] = Field(default_factory=dict)


class ReplyInput(BaseModel):
    prospect_id: int
    reply_text: str


app = FastAPI(title="Harvey Local Sales Agent", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


def ollama() -> OllamaClient:
    return OllamaClient()


def trace(operation: str, success: bool, detail: str = "") -> None:
    client = ollama()
    with connect() as db:
        db.execute(
            "INSERT INTO model_traces(model, base_url, operation, success, detail) VALUES (?, ?, ?, ?, ?)",
            (client.model, client.base_url, operation, int(success), detail),
        )


@app.get("/api/status")
def status():
    health = ollama().health()
    return {"ollama": health, "hardware": detect_hardware()}


@app.post("/api/products")
def create_product(payload: ProductInput):
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO products(name, description, website, company_information) VALUES (?, ?, ?, ?)",
            (
                payload.name,
                payload.description,
                payload.website,
                json.dumps(payload.company_information),
            ),
        )
        product_id = cursor.lastrowid
    return {"id": product_id, **payload.model_dump()}


@app.get("/api/products")
def list_products():
    with connect() as db:
        rows = db.execute("SELECT * FROM products ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]


@app.post("/api/products/{product_id}/profile")
def generate_profile(product_id: int):
    with connect() as db:
        product = db.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not product:
        raise HTTPException(404, "Product not found")
    try:
        graph = create_profile_graph(ollama())
        result = graph.invoke({
            "product": dict(product),
        })
    except OllamaUnavailable as exc:
        with connect() as db:
            db.execute(
                "INSERT INTO jobs(kind, payload, status, error) VALUES (?, ?, 'queued', ?)",
                ("profile", json.dumps({"product_id": product_id}), str(exc)),
            )
        trace("business_profile", False, str(exc))
        raise HTTPException(503, str(exc))
    profile = result["business_profile"]
    icp = result["icp"]
    with connect() as db:
        db.execute(
            "UPDATE products SET business_profile=?, icp=? WHERE id=?",
            (json.dumps(profile), json.dumps(icp), product_id),
        )
    trace("business_profile+product_icp", True)
    return {"business_profile": profile, "icp": icp}


@app.post("/api/prospects")
def create_prospect(payload: ProspectInput):
    with connect() as db:
        cursor = db.execute(
            """INSERT INTO prospects(product_id, name, company, role, website, raw_data)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                payload.product_id,
                payload.name,
                payload.company,
                payload.role,
                payload.website,
                json.dumps(payload.raw_data),
            ),
        )
        prospect_id = cursor.lastrowid
    return {"id": prospect_id, **payload.model_dump()}


@app.get("/api/prospects")
def list_prospects(product_id: int | None = None):
    with connect() as db:
        if product_id is None:
            rows = db.execute("SELECT * FROM prospects ORDER BY id DESC").fetchall()
        else:
            rows = db.execute(
                "SELECT * FROM prospects WHERE product_id=? ORDER BY id DESC",
                (product_id,),
            ).fetchall()
    return [dict(row) for row in rows]


@app.post("/api/prospects/{prospect_id}/research")
def research_prospect(prospect_id: int):
    with connect() as db:
        prospect = db.execute("SELECT * FROM prospects WHERE id=?", (prospect_id,)).fetchone()
        if not prospect:
            raise HTTPException(404, "Prospect not found")
        product = db.execute("SELECT * FROM products WHERE id=?", (prospect["product_id"],)).fetchone()
    if not product:
        raise HTTPException(404, "Product not found")
    try:
        result = create_sales_graph(ollama()).invoke({
            "product": dict(product),
            "prospect": dict(prospect),
        })
    except OllamaUnavailable as exc:
        with connect() as db:
            db.execute(
                "INSERT INTO jobs(kind, payload, status, error) VALUES (?, ?, 'queued', ?)",
                ("prospect_research", json.dumps({"prospect_id": prospect_id}), str(exc)),
            )
        trace("prospect_research", False, str(exc))
        raise HTTPException(503, str(exc))
    with connect() as db:
        db.execute(
            """UPDATE prospects SET buying_signals=?, problem_statement=?, score=?, email=? WHERE id=?""",
            (
                json.dumps(result["buying_signals"]),
                json.dumps(result["problem"]),
                json.dumps(result["score"]),
                json.dumps(result["email"]),
                prospect_id,
            ),
        )
    trace("prospect_research", True)
    return result


@app.post("/api/replies")
def classify_reply(payload: ReplyInput):
    try:
        result = create_reply_graph(ollama()).invoke({"reply_text": payload.reply_text})
    except OllamaUnavailable as exc:
        with connect() as db:
            db.execute(
                "INSERT INTO jobs(kind, payload, status, error) VALUES (?, ?, 'queued', ?)",
                ("reply", json.dumps(payload.model_dump()), str(exc)),
            )
        trace("reply_classification", False, str(exc))
        raise HTTPException(503, str(exc))
    classification = json.dumps(result["reply"])
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO replies(prospect_id, reply_text, classification) VALUES (?, ?, ?)",
            (payload.prospect_id, payload.reply_text, classification),
        )
    trace("reply_classification", True)
    return {"id": cursor.lastrowid, "classification": result["reply"]}


@app.get("/api/jobs")
def list_jobs():
    with connect() as db:
        rows = db.execute("SELECT * FROM jobs ORDER BY id DESC").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/traces")
def list_traces():
    with connect() as db:
        rows = db.execute("SELECT * FROM model_traces ORDER BY id DESC LIMIT 100").fetchall()
    return [dict(row) for row in rows]
