(function () {
  "use strict";

  const { HashRouter, NavLink, Navigate, Route, Routes } = ReactRouterDOM;
  const { useEffect, useMemo, useState } = React;

  const ITI_KEY = "invoice_dev_itinerary_v4";
  const HM_KEY = "invoice_dev_hotel_workspace_v2";
  const HM_SETS_KEY = "invoice_dev_hotel_sets_v2";

  const NAV_ITEMS = [
    { to: "/", label: "Quote" },
    { to: "/itinerary", label: "Itinerary" },
    { to: "/hotel-maker", label: "Hotel Maker" },
    { to: "/gds-parser", label: "GDS Parser" },
    { to: "/manual", label: "Manual" },
    { to: "/itinerary-legacy", label: "Itinerary Legacy" },
    { to: "/hotel-maker-legacy", label: "Hotel Legacy" }
  ];

  function uid() {
    return "id_" + Math.random().toString(36).slice(2, 10);
  }

  function json(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function ymd(date) {
    const d = new Date(date);
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function join(path) {
    let base = window.location.pathname || "/";
    if (!base.endsWith("/")) base = base.slice(0, base.lastIndexOf("/") + 1);
    return base + (path.startsWith("/") ? path.slice(1) : path);
  }

  function saveText(filename, content, type) {
    const blob = new Blob([content], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function ToolFrame({ path, title }) {
    return (
      <section className="tool-frame-wrap" aria-label={title}>
        <iframe className="tool-frame" src={join(path)} title={title} loading="eager" referrerPolicy="no-referrer" />
      </section>
    );
  }

  function makeTrip() {
    return { title: "New Trip Planner", days: [{ id: uid(), date: ymd(new Date()), collapsed: false, activities: [] }] };
  }

  function loadTrip() {
    const parsed = json(localStorage.getItem(ITI_KEY), null);
    if (!parsed || !Array.isArray(parsed.days) || !parsed.days.length) return makeTrip();
    return parsed;
  }

  function itineraryHtml(trip) {
    const blocks = trip.days
      .map(
        (d, i) => `<section style="border:1px solid #dbeafe;border-radius:10px;padding:12px;margin:0 0 10px;background:#fff">
          <h2 style="margin:0 0 8px">DAY ${i + 1} - ${d.date}</h2>
          ${(d.activities || [])
            .map((a) => `<div style="padding:8px;border:1px solid #e2e8f0;border-radius:8px;margin:6px 0">${a.time || "TBD"} ${a.title || ""}</div>`)
            .join("") || "<div>No activity</div>"}
        </section>`
      )
      .join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${trip.title}</title></head><body style="font-family:Segoe UI;background:#f1f5f9;padding:20px"><h1>${trip.title}</h1>${blocks}</body></html>`;
  }

  function ItineraryApp() {
    const [trip, setTrip] = useState(loadTrip);
    const [toast, setToast] = useState("");
    useEffect(() => localStorage.setItem(ITI_KEY, JSON.stringify(trip)), [trip]);
    useEffect(() => {
      if (!toast) return;
      const t = setTimeout(() => setToast(""), 2200);
      return () => clearTimeout(t);
    }, [toast]);
    const count = useMemo(() => trip.days.reduce((n, d) => n + (d.activities || []).length, 0), [trip.days]);

    const addDay = () => setTrip((prev) => {
      const last = prev.days[prev.days.length - 1];
      const n = new Date(`${last.date}T00:00:00`);
      n.setDate(n.getDate() + 1);
      return { ...prev, days: [...prev.days, { id: uid(), date: ymd(n), collapsed: true, activities: [] }] };
    });

    const patchDay = (i, patch) => setTrip((prev) => {
      const days = [...prev.days];
      days[i] = { ...days[i], ...patch };
      return { ...prev, days };
    });

    const addActivity = (i) => setTrip((prev) => {
      const days = [...prev.days];
      const day = { ...days[i], activities: [...(days[i].activities || []), { id: uid(), time: "", title: "" }] };
      days[i] = day;
      return { ...prev, days };
    });

    const patchActivity = (di, ai, patch) => setTrip((prev) => {
      const days = [...prev.days];
      const acts = [...days[di].activities];
      acts[ai] = { ...acts[ai], ...patch };
      days[di] = { ...days[di], activities: acts };
      return { ...prev, days };
    });

    return (
      <section className="native-itinerary">
        <div className="iti-toolbar">
          <div className="iti-title-row">
            <input className="iti-title-input" value={trip.title} onChange={(e) => setTrip({ ...trip, title: e.target.value })} />
            <span className="iti-meta">DAY {trip.days.length} / Activity {count}</span>
          </div>
          <div className="iti-actions">
            <button className="iti-btn" onClick={addDay}>Add Day</button>
            <button className="iti-btn" onClick={() => navigator.clipboard.writeText(itineraryHtml(trip)).then(() => setToast("HTML copied"))}>Copy HTML</button>
            <button className="iti-btn" onClick={() => { const w = window.open("", "_blank"); if (w) { w.document.write(itineraryHtml(trip)); w.document.close(); } }}>Preview</button>
            <button className="iti-btn" onClick={() => { if (window.confirm("Reset?")) setTrip(makeTrip()); }}>Reset</button>
            <a className="iti-btn iti-btn-ghost" href="#/itinerary-legacy">Legacy View</a>
          </div>
        </div>
        <div className="iti-day-list">
          {trip.days.map((d, i) => (
            <article key={d.id} className="iti-day-card">
              <header className="iti-day-header">
                <button className="iti-toggle" onClick={() => patchDay(i, { collapsed: !d.collapsed })}>{d.collapsed ? ">" : "v"}</button>
                <strong>DAY {i + 1}</strong>
                <input className="iti-date" type="date" value={d.date} onChange={(e) => patchDay(i, { date: e.target.value })} />
                <button className="iti-btn-small" onClick={() => saveText(`day_${i + 1}.html`, `<script id=\"embeddedTripDayData\" type=\"application/json\">${JSON.stringify(d)}<\/script>`, "text/html;charset=utf-8")}>Export Day</button>
              </header>
              {!d.collapsed && (
                <div className="iti-day-body">
                  <button className="iti-btn-small" onClick={() => addActivity(i)}>Add Activity</button>
                  {(d.activities || []).map((a, ai) => (
                    <div key={a.id} className="iti-activity-card">
                      <input value={a.time || ""} onChange={(e) => patchActivity(i, ai, { time: e.target.value })} placeholder="HHMM" />
                      <input value={a.title || ""} onChange={(e) => patchActivity(i, ai, { title: e.target.value })} placeholder="Title" />
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
        {toast && <div className="iti-toast">{toast}</div>}
      </section>
    );
  }

  function emptyHotel(i) {
    return { id: uid(), nameKo: `Hotel ${i}`, nameEn: "", website: "", image: "", description: "" };
  }

  function loadHotels() {
    const ws = json(localStorage.getItem(HM_KEY), null);
    if (!ws || !Array.isArray(ws.hotels) || !ws.hotels.length) return { hotels: [emptyHotel(1)], active: 0, setId: null, setName: "Unsaved Set" };
    return ws;
  }

  function hotelHtml(h) {
    return `<table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" width=\"100%\" style=\"max-width:750px;font-family:Malgun Gothic,sans-serif\"><tr><td width=\"320\" style=\"vertical-align:top\"><img src=\"${h.image || "https://placehold.co/320x240?text=No+Image"}\" width=\"320\" style=\"width:100%;display:block\"></td><td style=\"padding-left:18px\"><div style=\"font-weight:700\">${h.nameKo || "Unnamed Hotel"}</div><div style=\"font-size:12px;color:#64748b\">${h.nameEn || ""}</div><div style=\"white-space:pre-wrap;margin-top:10px\">${h.description || ""}</div>${h.website ? `<a href=\"${h.website}\" target=\"_blank\">Website</a>` : ""}</td></tr></table>`;
  }

  function HotelMakerApp() {
    const init = loadHotels();
    const [hotels, setHotels] = useState(init.hotels);
    const [active, setActive] = useState(init.active || 0);
    const [setId, setSetId] = useState(init.setId || null);
    const [setName, setSetName] = useState(init.setName || "Unsaved Set");
    const [savedSets, setSavedSets] = useState(() => json(localStorage.getItem(HM_SETS_KEY), []));
    const [showSets, setShowSets] = useState(false);
    const [query, setQuery] = useState("");
    const [tsv, setTsv] = useState("");
    const [toast, setToast] = useState("");
    useEffect(() => localStorage.setItem(HM_KEY, JSON.stringify({ hotels, active, setId, setName })), [hotels, active, setId, setName]);
    useEffect(() => localStorage.setItem(HM_SETS_KEY, JSON.stringify(savedSets)), [savedSets]);
    useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 2200); return () => clearTimeout(t); }, [toast]);
    const current = hotels[active] || hotels[0];
    const filtered = useMemo(() => savedSets.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())), [savedSets, query]);

    const patch = (k, v) => setHotels((prev) => { const n = [...prev]; n[active] = { ...n[active], [k]: v }; return n; });
    const addHotel = () => setHotels((prev) => { const n = [...prev, emptyHotel(prev.length + 1)]; setActive(n.length - 1); return n; });
    const saveAsNew = () => {
      const name = (window.prompt("Set name", current && current.nameKo ? current.nameKo : "Hotel Set") || "").trim();
      if (!name) return;
      const next = [{ id: uid(), name, updatedAt: Date.now(), hotels }, ...savedSets];
      setSavedSets(next); setSetId(next[0].id); setSetName(name); setToast("Saved");
    };
    const saveCurrent = () => {
      if (!setId) return saveAsNew();
      setSavedSets((prev) => prev.map((s) => s.id === setId ? { ...s, name: setName, updatedAt: Date.now(), hotels } : s));
      setToast("Updated");
    };
    const importTsv = () => {
      const rows = String(tsv || "").replace(/\r\n?/g, "\n").split("\n").map((r) => r.trim()).filter(Boolean);
      if (!rows.length) return setToast("No TSV rows");
      const parsed = rows.map((r, i) => { const c = r.split("\t"); return { id: uid(), nameKo: c[0] || `Hotel ${i + 1}`, nameEn: c[1] || "", website: c[2] || "", image: c[3] || "", description: c[4] || "" }; });
      setHotels((prev) => { const n = [...prev]; n[active] = { ...n[active], ...parsed[0] }; if (parsed.length > 1) n.splice(active + 1, 0, ...parsed.slice(1)); return n; });
      setSetId(null); setSetName("Unsaved Set"); setToast(`Imported ${parsed.length} rows`);
    };

    return (
      <section className="native-hotel">
        <div className="hm-toolbar">
          <div className="hm-title-row"><h2>Hotel Maker</h2><span className="hm-set-name">Current Set: {setName}</span></div>
          <div className="hm-actions">
            <button className="iti-btn" onClick={addHotel}>Add Hotel</button>
            <button className="iti-btn" onClick={() => navigator.clipboard.writeText(hotelHtml(current)).then(() => setToast("Hotel HTML copied"))}>Copy HTML</button>
            <button className="iti-btn" onClick={() => { const w = window.open("", "_blank"); if (w) { w.document.write(`<html><body style='font-family:Segoe UI'>${hotels.map((h) => hotelHtml(h)).join("<hr/>")}</body></html>`); w.document.close(); } }}>Preview</button>
            <button className="iti-btn" onClick={saveCurrent}>Save Set</button>
            <button className="iti-btn" onClick={saveAsNew}>Save As New</button>
            <button className="iti-btn" onClick={() => setShowSets(true)}>Load Set</button>
            <a className="iti-btn iti-btn-ghost" href="#/hotel-maker-legacy">Legacy View</a>
          </div>
        </div>
        <div className="hm-tabs">
          {hotels.map((h, i) => (
            <div key={h.id} className={i === active ? "hm-tab active" : "hm-tab"}>
              <button className="hm-tab-main" onClick={() => setActive(i)}>{h.nameKo || `Hotel ${i + 1}`}</button>
              <button className="hm-tab-close" onClick={() => hotels.length > 1 && setHotels((p) => p.filter((_, idx) => idx !== i))}>x</button>
            </div>
          ))}
        </div>
        {current && (
          <div className="hm-editor">
            <label className="hm-field"><span>Name (KR)</span><input value={current.nameKo || ""} onChange={(e) => patch("nameKo", e.target.value)} /></label>
            <label className="hm-field"><span>Name (EN)</span><input value={current.nameEn || ""} onChange={(e) => patch("nameEn", e.target.value)} /></label>
            <label className="hm-field"><span>Website</span><input value={current.website || ""} onChange={(e) => patch("website", e.target.value)} /></label>
            <label className="hm-field"><span>Image URL</span><input value={current.image || ""} onChange={(e) => patch("image", e.target.value)} /></label>
            <label className="hm-field hm-field-wide"><span>Description</span><textarea rows={6} value={current.description || ""} onChange={(e) => patch("description", e.target.value)} /></label>
          </div>
        )}
        <details className="hm-import-panel">
          <summary>TSV Import</summary>
          <textarea rows={6} value={tsv} onChange={(e) => setTsv(e.target.value)} placeholder={"nameKo\tnameEn\twebsite\timage\tdescription"} />
          <div className="hm-import-actions"><button className="iti-btn-small" onClick={importTsv}>Import TSV</button><button className="iti-btn-small" onClick={() => setTsv("")}>Clear</button></div>
        </details>
        {showSets && (
          <div className="hm-modal-backdrop" onClick={() => setShowSets(false)}>
            <div className="hm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="hm-modal-head"><h3>Saved Sets</h3><button className="iti-btn-small" onClick={() => setShowSets(false)}>Close</button></div>
              <input className="hm-set-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
              <ul className="hm-set-list">
                {filtered.map((s) => (
                  <li key={s.id} className="hm-set-item">
                    <div className="hm-set-meta"><strong>{s.name}</strong><small>{new Date(s.updatedAt).toLocaleString()}</small></div>
                    <div className="hm-set-actions">
                      <button className="iti-btn-small" onClick={() => { setHotels(s.hotels); setActive(0); setSetId(s.id); setSetName(s.name); setShowSets(false); }}>Load</button>
                      <button className="iti-btn-small" onClick={() => setHotels((prev) => [...prev, ...s.hotels.map((h) => ({ ...h, id: uid() }))])}>Append</button>
                      <button className="iti-btn-small" onClick={() => { const n = (window.prompt("Rename", s.name) || "").trim(); if (!n) return; setSavedSets((p) => p.map((x) => x.id === s.id ? { ...x, name: n, updatedAt: Date.now() } : x)); if (setId === s.id) setSetName(n); }}>Rename</button>
                      <button className="iti-btn-small iti-danger" onClick={() => setSavedSets((p) => p.filter((x) => x.id !== s.id))}>Delete</button>
                    </div>
                  </li>
                ))}
                {filtered.length === 0 && <li className="hm-empty">No saved sets</li>}
              </ul>
            </div>
          </div>
        )}
        {toast && <div className="iti-toast">{toast}</div>}
      </section>
    );
  }

  function Header() {
    return (
      <header className="top-bar">
        <div className="brand">
          <h1>Invoice Dev</h1>
          <p>React workspace wrapper for legacy tools</p>
        </div>
        <nav aria-label="Primary">
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.to === "/"} className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    );
  }

  function App() {
    return (
      <HashRouter>
        <div className="app-shell">
          <Header />
          <main className="page-content">
            <Routes>
              <Route path="/" element={<ToolFrame path="public/legacy/quote/index.html" title="Quote Tool" />} />
              <Route path="/itinerary" element={<ItineraryApp />} />
              <Route path="/itinerary-legacy" element={<ToolFrame path="public/legacy/itinerary_planner/index.html" title="Itinerary Legacy" />} />
              <Route path="/hotel-maker" element={<HotelMakerApp />} />
              <Route path="/hotel-maker-legacy" element={<ToolFrame path="public/legacy/hotel_maker/index.html" title="Hotel Maker Legacy" />} />
              <Route path="/gds-parser" element={<ToolFrame path="public/legacy/gds_parser/gds_parser.html" title="GDS Parser Tool" />} />
              <Route path="/manual" element={<ToolFrame path="public/legacy/manual/index.html" title="Manual" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
