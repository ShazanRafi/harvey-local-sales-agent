import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const navigation = [
  { id: "overview", label: "Overview", icon: "◫" },
  { id: "products", label: "Products", icon: "◇" },
  { id: "prospects", label: "Prospects", icon: "◎" },
  { id: "replies", label: "Replies", icon: "↗" },
  { id: "activity", label: "Activity", icon: "≋" },
];

const emptyProduct = { name: "", description: "", website: "", companyInfo: "" };
const emptyProspect = {
  name: "",
  company: "",
  role: "",
  website: "",
  notes: "",
};

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch {
    throw new Error("Cannot reach the backend. Start it with python scripts\\run_api.py.");
  }

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || body.error || `Request failed (${response.status})`);
  }
  return body;
}

function parseStored(value) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function displayScore(value) {
  const score = parseStored(value);
  return typeof score?.score === "number" ? score.score : null;
}

function App() {
  const [page, setPage] = useState("overview");
  const [status, setStatus] = useState(null);
  const [products, setProducts] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [traces, setTraces] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProspectId, setSelectedProspectId] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [prospectForm, setProspectForm] = useState(emptyProspect);
  const [replyText, setReplyText] = useState("");
  const [replyResult, setReplyResult] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedProduct = products.find((item) => String(item.id) === String(selectedProductId));
  const selectedProspect = prospects.find((item) => item.id === selectedProspectId);
  const readyCount = prospects.filter((item) => displayScore(item.score) !== null).length;
  const connectionOkay = Boolean(status?.ollama?.ok);

  const latestActivity = useMemo(() => traces.slice(0, 4), [traces]);

  async function refresh({ initial = false } = {}) {
    if (initial) setLoading(true);
    try {
      const [nextStatus, nextProducts, nextProspects, nextTraces, nextJobs] = await Promise.all([
        api("/status"),
        api("/products"),
        api("/prospects"),
        api("/traces"),
        api("/jobs"),
      ]);
      setStatus(nextStatus);
      setProducts(nextProducts);
      setProspects(nextProspects);
      setTraces(nextTraces);
      setJobs(nextJobs);
      setSelectedProductId((current) =>
        current && nextProducts.some((item) => String(item.id) === String(current))
          ? current
          : nextProducts[0] ? String(nextProducts[0].id) : ""
      );
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (initial) setLoading(false);
    }
  }

  useEffect(() => {
    refresh({ initial: true });
  }, []);

  async function runAction(label, action, successMessage) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const result = await action();
      if (successMessage) setNotice(successMessage);
      await refresh();
      return result;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setBusy("");
    }
  }

  async function createProduct(event) {
    event.preventDefault();
    const product = await runAction("product", async () => {
      const created = await api("/products", {
        method: "POST",
        body: JSON.stringify({
          name: productForm.name.trim(),
          description: productForm.description.trim(),
          website: productForm.website.trim() || null,
          company_information: productForm.companyInfo.trim()
            ? { notes: productForm.companyInfo.trim() }
            : {},
        }),
      });
      const profile = await api(`/products/${created.id}/profile`, {
        method: "POST",
        body: "{}",
      });
      setSelectedProductId(String(created.id));
      setProductForm(emptyProduct);
      return profile;
    }, "Product profile and ICP generated.");
    if (product) setPage("products");
  }

  async function createProspect(event) {
    event.preventDefault();
    if (!selectedProductId) {
      setError("Create a product first, then select it for this prospect.");
      return;
    }
    const result = await runAction("prospect", async () => {
      const created = await api("/prospects", {
        method: "POST",
        body: JSON.stringify({
          product_id: Number(selectedProductId),
          name: prospectForm.name.trim(),
          company: prospectForm.company.trim(),
          role: prospectForm.role.trim(),
          website: prospectForm.website.trim(),
          raw_data: prospectForm.notes.trim()
            ? { research_notes: prospectForm.notes.trim() }
            : {},
        }),
      });
      const research = await api(`/prospects/${created.id}/research`, {
        method: "POST",
        body: "{}",
      });
      setSelectedProspectId(created.id);
      setProspectForm(emptyProspect);
      return research;
    }, "Prospect analyzed and email draft generated.");
    if (result) setPage("prospects");
  }

  async function classifyReply(event) {
    event.preventDefault();
    const result = await runAction("reply", async () => {
      if (!prospects.length) {
        throw new Error("Add a prospect before classifying a reply.");
      }
      const classified = await api("/replies", {
        method: "POST",
        body: JSON.stringify({
          prospect_id: selectedProspectId || prospects[0].id,
          reply_text: replyText.trim(),
        }),
      });
      setReplyResult(classified.classification);
      return classified;
    }, "Reply classified locally.");
    if (result) setReplyText("");
  }

  function goTo(nextPage) {
    setError("");
    setNotice("");
    setPage(nextPage);
  }

  const modelName = status?.ollama?.model || "Ollama";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => goTo("overview")}>
          <span className="brand-mark">H</span>
          <span className="brand-copy"><strong>Harvey</strong><small>LOCAL SALES AGENT</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map((item) => (
            <button
              className={`nav-item ${page === item.id ? "active" : ""}`}
              key={item.id}
              onClick={() => goTo(item.id)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === "prospects" && prospects.length > 0 && (
                <span className="nav-count">{prospects.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className={`connection-card ${connectionOkay ? "connected" : "disconnected"}`}>
            <span className="connection-dot" />
            <div>
              <strong>{connectionOkay ? "Model connected" : "Model unavailable"}</strong>
              <small>{modelName}</small>
            </div>
          </div>
          <p>Runs on your machine.<br />Your data stays local.</p>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">Workspace <span>/</span> {navigation.find((item) => item.id === page)?.label}</div>
          <div className="topbar-right">
            <span className={`top-status ${connectionOkay ? "online" : "offline"}`}>
              <i />{connectionOkay ? "Ollama online" : "Ollama offline"}
            </span>
            <button className="icon-button" onClick={() => refresh()} aria-label="Refresh data" title="Refresh">↻</button>
            <div className="avatar" title="Local workspace">H</div>
          </div>
        </header>

        <main className="page-content">
          {error && <div className="toast error-toast" role="alert"><span>!</span>{error}<button onClick={() => setError("")}>×</button></div>}
          {notice && <div className="toast success-toast" role="status"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}

          {loading ? (
            <div className="loading-panel"><span className="spinner" /> Loading your local workspace…</div>
          ) : (
            <>
              {page === "overview" && (
                <Overview
                  products={products}
                  prospects={prospects}
                  readyCount={readyCount}
                  status={status}
                  activity={latestActivity}
                  onNavigate={goTo}
                />
              )}
              {page === "products" && (
                <ProductsPage
                  products={products}
                  form={productForm}
                  setForm={setProductForm}
                  onSubmit={createProduct}
                  busy={busy === "product"}
                />
              )}
              {page === "prospects" && (
                <ProspectsPage
                  products={products}
                  prospects={prospects}
                  selectedProductId={selectedProductId}
                  setSelectedProductId={setSelectedProductId}
                  selectedProspect={selectedProspect}
                  setSelectedProspectId={setSelectedProspectId}
                  form={prospectForm}
                  setForm={setProspectForm}
                  onSubmit={createProspect}
                  busy={busy === "prospect"}
                />
              )}
              {page === "replies" && (
                <RepliesPage
                  prospects={prospects}
                  selectedProspectId={selectedProspectId}
                  setSelectedProspectId={setSelectedProspectId}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  replyResult={replyResult}
                  onSubmit={classifyReply}
                  busy={busy === "reply"}
                />
              )}
              {page === "activity" && <ActivityPage traces={traces} jobs={jobs} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Overview({ products, prospects, readyCount, status, activity, onNavigate }) {
  return (
    <>
      <PageHeading
        eyebrow="YOUR LOCAL SALES WORKSPACE"
        title="Good to see you."
        description="Turn product knowledge into thoughtful, evidence-based outreach."
        action={<button className="button button-primary" onClick={() => onNavigate(products.length ? "prospects" : "products")}>＋ New {products.length ? "prospect" : "product"}</button>}
      />

      <section className="welcome-banner">
        <div className="welcome-copy">
          <div className="banner-kicker"><span className="sparkle">✳</span> LOCAL AI WORKSPACE</div>
          <h2>Prospecting that starts<br />with understanding.</h2>
          <p>Build product context, evaluate prospects, and draft relevant outreach — all with your local model.</p>
          <button className="button button-light" onClick={() => onNavigate(products.length ? "prospects" : "products")}>
            {products.length ? "Explore prospects" : "Set up your first product"} <span>→</span>
          </button>
        </div>
        <div className="banner-graphic" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="orbit-core">H</div><span className="orbit-node node-one">✦</span><span className="orbit-node node-two">◎</span><span className="orbit-node node-three">↗</span>
        </div>
      </section>

      <section className="metric-grid" aria-label="Workspace summary">
        <MetricCard label="Products" value={products.length} detail="Configured for selling" icon="◇" tint="lavender" />
        <MetricCard label="Prospects" value={prospects.length} detail="In your local pipeline" icon="◎" tint="blue" />
        <MetricCard label="Scored" value={readyCount} detail="With AI prioritisation" icon="↗" tint="peach" />
        <MetricCard
          label="Model"
          value={status?.ollama?.ok ? "Ready" : "Offline"}
          detail={status?.ollama?.model || "Check Ollama"}
          icon="✳"
          tint={status?.ollama?.ok ? "green" : "gray"}
        />
      </section>

      <section className="overview-grid">
        <div className="panel pipeline-panel">
          <div className="panel-heading">
            <div><h2>Sales workflow</h2><p>From product context to a personal first touch.</p></div>
            <span className="tiny-badge">LOCAL MODEL</span>
          </div>
          <div className="workflow-list">
            <WorkflowStep number="01" title="Define your product" detail="Describe what you sell and who it helps." complete={products.length > 0} onClick={() => onNavigate("products")} />
            <WorkflowStep number="02" title="Understand your ICP" detail="Generate a product-specific customer profile." complete={products.some((item) => item.icp)} onClick={() => onNavigate("products")} />
            <WorkflowStep number="03" title="Research prospects" detail="Add facts and let the local agent assess fit." complete={prospects.length > 0} onClick={() => onNavigate("prospects")} />
            <WorkflowStep number="04" title="Draft thoughtful outreach" detail="Review personalized emails before using them." complete={prospects.some((item) => item.email)} onClick={() => onNavigate("prospects")} last />
          </div>
        </div>
        <div className="panel activity-panel">
          <div className="panel-heading">
            <div><h2>Recent activity</h2><p>Local inference trace</p></div>
            <button className="text-button" onClick={() => onNavigate("activity")}>View all →</button>
          </div>
          {activity.length ? (
            <div className="recent-list">
              {activity.map((item) => (
                <div className="recent-item" key={item.id}>
                  <span className={`activity-symbol ${item.success ? "activity-good" : "activity-bad"}`}>{item.success ? "✓" : "!"}</span>
                  <div><strong>{item.operation.replaceAll("_", " ")}</strong><small>{item.model} · {formatDate(item.created_at)}</small></div>
                  <span className={`mini-status ${item.success ? "mini-success" : "mini-failed"}`}>{item.success ? "Done" : "Failed"}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Nothing here yet" detail="Your local model activity will show up here." />
          )}
        </div>
      </section>
    </>
  );
}

function MetricCard({ label, value, detail, icon, tint }) {
  return (
    <div className="metric-card">
      <div className={`metric-icon ${tint}`}>{icon}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
    </div>
  );
}

function WorkflowStep({ number, title, detail, complete, onClick, last }) {
  return (
    <button className={`workflow-step ${last ? "last" : ""}`} onClick={onClick}>
      <span className={`step-number ${complete ? "step-complete" : ""}`}>{complete ? "✓" : number}</span>
      <span className="step-copy"><strong>{title}</strong><small>{detail}</small></span>
      <span className="step-arrow">→</span>
    </button>
  );
}

function ProductsPage({ products, form, setForm, onSubmit, busy }) {
  return (
    <>
      <PageHeading eyebrow="PRODUCT CONTEXT" title="Your products" description="Give the local agent context about what you sell and who it is for." />
      <div className="content-grid">
        <section className="panel form-panel">
          <div className="panel-heading"><div><h2>Add a product</h2><p>Harvey uses this to build a product profile and ICP.</p></div><span className="form-step">01 / 02</span></div>
          <form onSubmit={onSubmit}>
            <Field label="Product name" required><input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Appointment scheduling software" /></Field>
            <Field label="What does it do?" required hint="Be specific about the value it delivers."><textarea required rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the product, its benefits, and the problems it solves." /></Field>
            <Field label="Company website" hint="Optional reference URL. This form does not fetch website content."><input type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://example.com" /></Field>
            <Field label="Additional company context" hint="Optional. Use your own business details."><textarea rows="3" value={form.companyInfo} onChange={(event) => setForm({ ...form, companyInfo: event.target.value })} placeholder="Audience, differentiators, pricing context…" /></Field>
            <button className="button button-primary button-wide" disabled={busy || !form.name.trim() || !form.description.trim()}>{busy ? <><span className="spinner spinner-light" /> Generating profile & ICP…</> : "Generate product profile  →"}</button>
            <p className="form-footnote"><span>✳</span> Processed by your local Ollama model. Nothing is sent to a cloud AI service.</p>
          </form>
        </section>
        <section className="product-list-section">
          <div className="section-title-row"><div><h2>Configured products</h2><p>{products.length} {products.length === 1 ? "product" : "products"} in this workspace</p></div></div>
          {products.length ? products.map((product) => (
            <ProductCard key={product.id} product={product} />
          )) : <EmptyState title="No products yet" detail="Add a product to create your business context and customer profile." />}
        </section>
      </div>
    </>
  );
}

function ProductCard({ product }) {
  const profile = parseStored(product.business_profile);
  const icp = parseStored(product.icp);
  return (
    <article className="panel product-card">
      <div className="product-card-top"><div className="product-avatar">{product.name.slice(0, 1).toUpperCase()}</div><div className="product-card-title"><h3>{product.name}</h3><span>{product.website || "Local product"}</span></div><span className={`product-state ${icp ? "state-ready" : "state-pending"}`}>{icp ? "Profile ready" : "Needs profile"}</span></div>
      <p className="product-description">{product.description}</p>
      {profile?.value_proposition && <div className="value-proposition"><span>VALUE PROPOSITION</span><p>{profile.value_proposition}</p></div>}
      {icp && <div className="tag-groups">
        {icp.industries?.length > 0 && <TagGroup label="Industries" values={icp.industries} />}
        {icp.roles?.length > 0 && <TagGroup label="Target roles" values={icp.roles} />}
      </div>}
    </article>
  );
}

function TagGroup({ label, values }) {
  return <div className="tag-group"><span>{label}</span><div>{values.slice(0, 5).map((value) => <span className="tag" key={value}>{value}</span>)}</div></div>;
}

function ProspectsPage({ products, prospects, selectedProductId, setSelectedProductId, selectedProspect, setSelectedProspectId, form, setForm, onSubmit, busy }) {
  return (
    <>
      <PageHeading eyebrow="PIPELINE" title="Prospects" description="Add a prospect using information you have, then review the local agent's assessment and draft." />
      <div className="content-grid prospects-layout">
        <section className="panel form-panel">
          <div className="panel-heading"><div><h2>Add prospect</h2><p>Provide evidence for a useful, grounded assessment.</p></div></div>
          {products.length ? (
            <form onSubmit={onSubmit}>
              <Field label="Product" required>
                <select required value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                  {products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}
                </select>
              </Field>
              <div className="form-two-col">
                <Field label="Contact name" required><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Contact name" /></Field>
                <Field label="Role"><input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="e.g. Owner" /></Field>
              </div>
              <Field label="Company" required><input required value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Company name" /></Field>
              <Field label="Company website"><input type="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://example.com" /></Field>
              <Field label="Research notes" hint="Facts you already have: tools, hiring, booking process, public statements, etc."><textarea rows="5" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Add observed facts. The model should not invent prospect details." /></Field>
              <button className="button button-primary button-wide" disabled={busy || !form.name.trim() || !form.company.trim()}>{busy ? <><span className="spinner spinner-light" /> Analyzing with local model…</> : "Analyze prospect  →"}</button>
              <p className="form-footnote"><span>✳</span> The agent uses stored prospect data and product context.</p>
            </form>
          ) : (
            <EmptyState title="Set up a product first" detail="A product profile gives Harvey the context needed to assess prospects." />
          )}
        </section>
        <section className="prospect-list-section">
          <div className="section-title-row"><div><h2>Your pipeline</h2><p>{prospects.length} prospects · sorted by most recent</p></div></div>
          {prospects.length ? (
            <div className="panel prospect-table-panel">
              <div className="table-scroll"><table><thead><tr><th>CONTACT</th><th>PRODUCT</th><th>FIT SCORE</th><th>PRIORITY</th></tr></thead>
                <tbody>{prospects.map((prospect) => {
                  const score = parseStored(prospect.score);
                  const product = products.find((item) => item.id === prospect.product_id);
                  return <tr className={selectedProspect?.id === prospect.id ? "selected-row" : ""} key={prospect.id} onClick={() => setSelectedProspectId(prospect.id)}>
                    <td><div className="contact-cell"><span className="contact-avatar">{(prospect.name || prospect.company || "?").slice(0, 1).toUpperCase()}</span><div><strong>{prospect.name || "Unnamed contact"}</strong><small>{prospect.role || prospect.company}</small></div></div></td>
                    <td>{product?.name || "—"}</td>
                    <td>{typeof score?.score === "number" ? <span className="score-pill">{score.score}<small>/100</small></span> : <span className="muted-cell">Not scored</span>}</td>
                    <td>{score?.priority ? <span className={`priority priority-${score.priority}`}>{score.priority}</span> : <span className="muted-cell">Pending</span>}</td>
                  </tr>;
                })}</tbody></table></div>
            </div>
          ) : <EmptyState title="Your pipeline is empty" detail="Add a prospect to generate buying signals, a fit score, and an email draft." />}
          {selectedProspect && <ProspectDetail prospect={selectedProspect} product={products.find((item) => item.id === selectedProspect.product_id)} />}
        </section>
      </div>
    </>
  );
}

function ProspectDetail({ prospect, product }) {
  const score = parseStored(prospect.score);
  const signals = parseStored(prospect.buying_signals)?.signals || [];
  const problem = parseStored(prospect.problem_statement);
  const email = parseStored(prospect.email);
  return (
    <section className="panel prospect-detail">
      <div className="detail-heading"><div><span className="eyebrow">PROSPECT BRIEF</span><h2>{prospect.company}</h2><p>{prospect.name}{prospect.role ? ` · ${prospect.role}` : ""}{product ? ` · ${product.name}` : ""}</p></div>{score && <div className="detail-score"><strong>{score.score}</strong><span>FIT SCORE</span></div>}</div>
      <div className="detail-section"><h3>Buying signals <span>{signals.length}</span></h3>{signals.length ? <div className="signal-list">{signals.map((signal, index) => <div className="signal-item" key={`${signal.name}-${index}`}><span className={`signal-dot signal-${signal.classification}`} /><div><strong>{signal.name}</strong><p>{signal.reason}</p></div><span className={`priority priority-${signal.classification}`}>{signal.classification}</span></div>)}</div> : <p className="muted-cell">No buying signals recorded.</p>}</div>
      {problem?.problem && <div className="detail-section"><h3>Problem hypothesis</h3><p className="problem-copy">{problem.problem}</p>{problem.business_impact && <p className="impact-copy">{problem.business_impact}</p>}</div>}
      {email?.body && <div className="detail-section email-draft"><div className="email-title"><h3>Personalized email draft</h3><span>Draft only · not sent</span></div><div className="email-subject"><span>SUBJECT</span><strong>{email.subject}</strong></div><pre>{email.body}</pre></div>}
    </section>
  );
}

function RepliesPage({ prospects, selectedProspectId, setSelectedProspectId, replyText, setReplyText, replyResult, onSubmit, busy }) {
  return (
    <>
      <PageHeading eyebrow="CONVERSATIONS" title="Reply assistant" description="Classify a sample reply and get a suggested next action. Harvey does not send responses." />
      <div className="reply-layout">
        <section className="panel form-panel">
          <div className="panel-heading"><div><h2>Classify a reply</h2><p>Use a sample conversation or paste a reply you are authorized to process.</p></div></div>
          {prospects.length ? (
            <form onSubmit={onSubmit}>
              <Field label="Related prospect">
                <select value={selectedProspectId || prospects[0].id} onChange={(event) => setSelectedProspectId(Number(event.target.value))}>
                  {prospects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.name} · {prospect.company}</option>)}
                </select>
              </Field>
              <Field label="Reply text" required><textarea required rows="7" value={replyText} onChange={(event) => setReplyText(event.target.value)} placeholder="Paste the reply text here…" /></Field>
              <button className="button button-primary" disabled={busy || !replyText.trim()}>{busy ? <><span className="spinner spinner-light" /> Classifying…</> : "Classify with local model  →"}</button>
            </form>
          ) : <EmptyState title="Add a prospect first" detail="Replies are linked to a prospect in your local pipeline." />}
        </section>
        <section className="panel reply-result-panel">
          <div className="panel-heading"><div><h2>Classification</h2><p>Intent and recommended follow-up</p></div><span className="tiny-badge">LOCAL AI</span></div>
          {replyResult ? (
            <div className="reply-result">
              <span className="result-label">REPLY TYPE</span><h3>{formatLabel(replyResult.classification)}</h3>
              <div className="reply-intent"><span>Intent</span><p>{replyResult.intent || "No intent provided."}</p></div>
              <div className="next-action"><span>→</span><div><strong>Suggested next action</strong><p>{replyResult.suggested_next_action || "Review the reply and decide how to respond."}</p></div></div>
            </div>
          ) : <EmptyState title="No reply analyzed" detail="The result will appear here after classification." />}
        </section>
      </div>
    </>
  );
}

function ActivityPage({ traces, jobs }) {
  return (
    <>
      <PageHeading eyebrow="SYSTEM" title="Activity & local inference" description="Review local model calls and tasks waiting for Ollama. No cloud model fallback is configured." />
      {jobs.length > 0 && <section className="panel queue-panel"><div className="panel-heading"><div><h2>Queued tasks</h2><p>These tasks remain local and can be retried when Ollama is available.</p></div></div>
        {jobs.map((job) => <div className="queue-row" key={job.id}><span className="queue-indicator" /><div><strong>{formatLabel(job.kind)}</strong><small>{job.error}</small></div><span className="priority priority-medium">{job.status}</span></div>)}
      </section>}
      <section className="panel activity-table-panel">
        <div className="panel-heading"><div><h2>Model traces</h2><p>{traces.length} most recent recorded calls · inference endpoint is local Ollama</p></div><span className="tiny-badge">127.0.0.1</span></div>
        {traces.length ? <div className="table-scroll"><table><thead><tr><th>OPERATION</th><th>MODEL</th><th>ENDPOINT</th><th>RESULT</th><th>TIME</th></tr></thead><tbody>
          {traces.map((trace) => <tr key={trace.id}><td><strong>{formatLabel(trace.operation)}</strong></td><td>{trace.model}</td><td className="mono-cell">{trace.base_url}</td><td><span className={`mini-status ${trace.success ? "mini-success" : "mini-failed"}`}>{trace.success ? "Success" : "Failed"}</span></td><td>{formatDate(trace.created_at)}</td></tr>)}
        </tbody></table></div> : <EmptyState title="No model calls yet" detail="Generated profiles and prospect analyses will be logged here." />}
      </section>
    </>
  );
}

function Field({ label, required, hint, children }) {
  return <label className="field"><span className="field-label">{label}{required && <i> *</i>}</span>{children}{hint && <small className="field-hint">{hint}</small>}</label>;
}

function EmptyState({ title, detail }) {
  return <div className="empty-state"><span className="empty-icon">◇</span><strong>{title}</strong><p>{detail}</p></div>;
}

function formatLabel(value = "") {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "Just now";
  const date = new Date(value.includes("Z") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

createRoot(document.getElementById("root")).render(<App />);
