import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const api = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.detail || "Request failed");
  return body;
};

function App() {
  const [status, setStatus] = useState(null);
  const [products, setProducts] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [traces, setTraces] = useState([]);
  const [output, setOutput] = useState(null);
  const [error, setError] = useState("");
  const [productForm, setProductForm] = useState({
    name: "Harbor Booking",
    description: "A simple appointment scheduling platform for service businesses.",
    website: "",
  });
  const [prospectForm, setProspectForm] = useState({
    name: "Jordan Lee",
    company: "Metro Dental Studio",
    role: "Practice Owner",
    website: "",
  });
  const [reply, setReply] = useState("This sounds useful. Can you show me a 20-minute demo?");

  const refresh = async () => {
    try {
      setStatus(await api("/status"));
      setProducts(await api("/products"));
      setProspects(await api("/prospects"));
      setTraces(await api("/traces"));
    } catch (err) {
      setError(err.message);
    }
  };
  useEffect(() => { refresh(); }, []);

  const run = async (label, request) => {
    setError("");
    setOutput({ loading: label });
    try {
      setOutput(await request());
      await refresh();
    } catch (err) {
      setError(err.message);
      setOutput(null);
    }
  };

  const createProduct = () => run("Generating business profile and ICP...", async () => {
    const product = await api("/products", { method: "POST", body: JSON.stringify(productForm) });
    return api(`/products/${product.id}/profile`, { method: "POST", body: "{}" });
  });

  const createProspect = () => run("Researching and prioritising prospect...", async () => {
    if (!products.length) throw new Error("Create and configure a product first.");
    const prospect = await api("/prospects", {
      method: "POST",
      body: JSON.stringify({ ...prospectForm, product_id: products[0].id, raw_data: {
        booking: "Phone only", hiring: "No", source: "Locally stored sample"
      } }),
    });
    return api(`/prospects/${prospect.id}/research`, { method: "POST", body: "{}" });
  });

  const classifyReply = () => run("Classifying reply...", async () => {
    return api("/replies", {
      method: "POST",
      body: JSON.stringify({ prospect_id: prospects[0]?.id || 0, reply_text: reply }),
    });
  });

  return (
    <main>
      <header>
        <div><span className="eyebrow">LOCAL / PRIVATE</span><h1>Harvey Sales Agent</h1></div>
        <div className={`status ${status?.ollama?.ok ? "ok" : "bad"}`}>
          {status?.ollama?.ok ? "Ollama connected" : "Ollama unavailable"}
        </div>
      </header>

      {error && <section className="alert">{error}</section>}

      <section className="grid">
        <article>
          <h2>1. Product & company</h2>
          <label>Product name<input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></label>
          <label>Value proposition<textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} /></label>
          <label>Website <span>(optional)</span><input value={productForm.website} onChange={(e) => setProductForm({ ...productForm, website: e.target.value })} /></label>
          <button onClick={createProduct}>Generate profile & ICP</button>
        </article>

        <article>
          <h2>2. Prospect</h2>
          <label>Person<input value={prospectForm.name} onChange={(e) => setProspectForm({ ...prospectForm, name: e.target.value })} /></label>
          <label>Company<input value={prospectForm.company} onChange={(e) => setProspectForm({ ...prospectForm, company: e.target.value })} /></label>
          <label>Role<input value={prospectForm.role} onChange={(e) => setProspectForm({ ...prospectForm, role: e.target.value })} /></label>
          <button onClick={createProspect}>Research & score</button>
        </article>

        <article>
          <h2>3. Reply classification</h2>
          <label>Sample reply<textarea value={reply} onChange={(e) => setReply(e.target.value)} /></label>
          <button onClick={classifyReply}>Classify reply</button>
        </article>
      </section>

      <section className="workspace">
        <div className="result">
          <h2>Agent output</h2>
          {output?.loading ? <p className="muted">{output.loading}</p> :
            output ? <pre>{JSON.stringify(output, null, 2)}</pre> :
            <p className="muted">Run a workflow to see traceable local output.</p>}
        </div>
        <aside>
          <h2>Local system</h2>
          {status && <>
            <dl><dt>Model</dt><dd>{status.ollama.model}</dd><dt>Hardware</dt><dd>{status.hardware.configuration}</dd><dt>Memory</dt><dd>{status.hardware.memory_gib} GB</dd><dt>GPU</dt><dd>{status.hardware.gpu_detected ? status.hardware.gpu_name : "Not detected"}</dd></dl>
          </>}
          <h3>Model traces</h3>
          <div className="traces">{traces.map((trace) => <div key={trace.id}><b>{trace.operation}</b><span>{trace.success ? "success" : "failed"}</span></div>)}</div>
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
