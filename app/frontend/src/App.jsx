import { colors } from "./theme.js";
import { useState, useEffect } from "react";
import ConfidenceBar from "./components/ConfidenceBar.jsx";
import VehicleViewer from "./components/VehicleViewer.jsx";
import VehicleSelector from "./components/VehicleSelector.jsx";
import AttributeRow from "./components/AttributeRow.jsx";
import DamageList from "./components/DamageList.jsx";
import FeatureList from "./components/FeatureList.jsx";
import QueueList from "./components/QueueList.jsx";
import Header from "./components/Header.jsx";
import IconRail from "./components/IconRail.jsx";
import UploadPanel from "./components/UploadPanel.jsx";
import Toast from "./components/Toast.jsx";
import Legend from "./components/Legend.jsx";
import OtherSightings from "./components/OtherSightings.jsx";
import ModelPerformance from "./components/ModelPerformance.jsx";
import AuditLog from "./components/AuditLog.jsx";
import HistorySearch from "./components/HistorySearch.jsx";
import SettingsPage from "./components/SettingsPage.jsx";
import { getVehicles, weakestConfidence, isFlagged } from "./utils/confidence.js";
import "./App.css";

// Backend address. Locally this falls back to localhost; when published,
// set VITE_API_URL to the hosted server's address.
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Sends a request. If the server answers but refuses (for example 400 or 409),
// this throws an error carrying the server's message. A network failure throws as normal.
async function request(path, options) {
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.errors?.length ? `: ${data.errors.slice(0, 2).join("; ")}` : "";
    const err = new Error(`${data?.error || "Request failed"}${detail}`);
    err.fromServer = true;
    throw err;
  }
  return data;
}

const modelsByMake = {
  Toyota: ["Camry", "Corolla", "RAV4", "Hilux"],
  Ford: ["Ranger", "Falcon", "Focus"],
  Mazda: ["CX-5", "Mazda3", "BT-50"],
  Holden: ["Commodore", "Colorado"],
  Subaru: ["Outback", "Forester", "Impreza"],
  Nissan: ["Navara", "X-Trail"],
  BMW: ["3 Series", "X5"],
};

const PLACEHOLDER_FIELDS = ["Day / night", "Camera / checkpoint ID", "GPS location", "Model version", "Vehicle year / trim"];

function App() {
  const [captures, setCaptures] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [threshold, setThreshold] = useState(0.75);
  const [toast, setToast] = useState(null);
  const [fading, setFading] = useState(false);
  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [showBoxes, setShowBoxes] = useState(true);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState(false);
  const [activeView, setActiveView] = useState("queue");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    request("/api/captures")
      .then((data) => {
        setCaptures(data);
        if (data.length > 0) setSelectedId(data[0].id);
        setLoading(false);
      })
      .catch(() => setServerError(true));

    request("/api/audit")
      .then((data) => setAuditLog(data))
      .catch(() => setServerError(true));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.isError ? 5000 : 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const capture = captures.find((c) => c.id === selectedId);

  if (serverError) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#E1261C" }}>
        Unable to reach the detection server. Check that it's running, then refresh this page.
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading captures...</div>;
  }

  if (!capture) {
    return <div style={{ padding: "40px", textAlign: "center" }}>No captures available yet.</div>;
  }

  // A capture can hold several vehicles. Older captures are their own single vehicle.
  const isMulti = Array.isArray(capture.vehicles) && capture.vehicles.length > 0;
  const vehicles = getVehicles(capture);
  const vehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  // Multi-vehicle images: selected vehicle's box is blue, the others grey.
  const boxes = isMulti
    ? capture.vehicles
        .filter((v) => v.box)
        .map((v) => ({
          label: `Vehicle ${v.id}`,
          color: v.id === vehicle.id ? "#146CFD" : "#7A8CA8",
          ...v.box,
        }))
    : capture.boxes || [];

  const features = vehicle.features || [];
  const damage = vehicle.damage || [];
  const weakest = weakestConfidence(capture);

  // Image links from the ingest step are relative, so add the server address.
  const withServer = (url) => (url && url.startsWith("/") ? `${API}${url}` : url);
  const images = (capture.images || (capture.imageUrl ? [{ url: capture.imageUrl, confidence: null }] : []))
    .map((img) => ({ ...img, url: withServer(img?.url) }));

  // The server answered but refused: show its message. No answer at all: show the offline page.
  function handleRequestError(err) {
    if (err.fromServer) {
      setToast({ text: err.message, isError: true });
    } else {
      setServerError(true);
    }
  }

  function handleCorrect(field, newValue) {
    const body = isMulti
      ? { field, value: newValue, vehicleId: vehicle.id }
      : { field, value: newValue };

    request(`/api/captures/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((result) => {
        setCaptures(
          captures.map((c) => {
            if (c.id !== selectedId) return c;
            if (isMulti) {
              return {
                ...c,
                vehicles: c.vehicles.map((v) => (v.id === vehicle.id ? { ...v, [field]: newValue } : v)),
              };
            }
            return { ...c, [field]: newValue };
          })
        );
        setAuditLog(result.auditLog);
        setToast({ text: `${field} updated`, isError: false });
      })
      .catch(handleRequestError);
  }

  function handleNewCapture(newCapture) {
    request("/api/captures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCapture),
    })
      .then((saved) => {
        setCaptures([saved, ...captures]);
        setSelectedId(saved.id);
        setSelectedVehicleId(null);
      })
      .catch(handleRequestError);
  }

  function handleSelectCapture(id) {
    if (id === selectedId) return;
    setFading(true);
    setTimeout(() => {
      setSelectedId(id);
      setSelectedVehicleId(null);
      setFading(false);
    }, 150);
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  const flaggedCount = captures.filter((c) => isFlagged(c, threshold)).length;
  const scored = captures.map(weakestConfidence).filter((s) => s !== null);
  const avgConfidence =
    scored.length > 0
      ? `${Math.round((scored.reduce((t, s) => t + s, 0) / scored.length) * 100)}%`
      : "n/a";

  return (
    <div style={{ background: colors.paper, minHeight: "100vh", color: colors.grey01, display: "flex" }}>
      <IconRail activeView={activeView} onNavigate={setActiveView} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <Header />

        <div style={{ background: colors.white, borderBottom: `1px solid ${colors.grey03}`, padding: "10px 20px", fontSize: "12px", color: colors.grey02 }}>
          Home <span style={{ color: colors.grey03, margin: "0 6px" }}>/</span>
          Vehicle Identification Unit <span style={{ color: colors.grey03, margin: "0 6px" }}>/</span>
          <span style={{ color: colors.navy, fontWeight: 600 }}>
            {activeView === "queue" && "Review queue"}
            {activeView === "performance" && "Model performance"}
            {activeView === "audit" && "Audit log"}
            {activeView === "history" && "Search & export"}
            {activeView === "settings" && "Settings"}
          </span>
        </div>

        {activeView === "queue" && (
          <>
            <div style={{ display: "flex", gap: "16px", padding: "16px 20px 0" }}>
              {[
                { label: "Total captures", value: captures.length, color: colors.navy },
                { label: "Flagged for review", value: flaggedCount, color: colors.red },
                { label: "Avg. confidence", value: avgConfidence, color: colors.green },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="stat-tile"
                  style={{
                    flex: 1,
                    background: colors.white,
                    borderRadius: "12px",
                    padding: "16px 20px",
                    boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 4px 12px rgba(16,24,40,0.06)",
                  }}
                >
                  <div style={{ fontSize: "26px", fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: "12px", color: colors.grey02, marginTop: "2px" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="layout">
              <div className="sidebar card" style={{ background: colors.white, padding: "16px" }}>
                <UploadPanel onNewCapture={handleNewCapture} />
                <QueueList captures={captures} selectedId={selectedId} onSelect={handleSelectCapture} threshold={threshold} />
              </div>

              <div className="viewer">
                <div
                  style={{
                    opacity: fading ? 0 : 1,
                    transform: fading ? "translateY(6px)" : "translateY(0)",
                    transition: "opacity 0.15s ease, transform 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ margin: 0 }}>{capture.camera} - {capture.time}</p>
                    <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input type="checkbox" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} />
                      Show detections
                    </label>
                  </div>

                  {weakest !== null && <ConfidenceBar value={weakest} />}

                  <div style={{ maxWidth: "720px", margin: "20px auto 0" }}>
                    <VehicleViewer
                      key={capture.id}
                      images={images}
                      boxes={boxes}
                      highlightLabel={hoveredLabel}
                      showBoxes={showBoxes}
                    />
                    <Legend boxes={boxes} hoveredLabel={hoveredLabel} onHover={setHoveredLabel} />
                    <OtherSightings />
                  </div>
                </div>

                {auditLog.length > 0 && (
                  <div style={{ marginTop: "20px", fontSize: "13px", background: colors.grey04, padding: "12px", borderRadius: "6px" }}>
                    <strong>Recent corrections:</strong>
                    <ul>
                      {auditLog.slice(0, 5).map((entry, i) => (
                        <li key={i}>{entry.time} - {entry.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="attributes card" style={{ background: colors.white, padding: "16px" }}>
                <div style={{ marginBottom: "16px", fontSize: "12px" }}>
                  <label>
                    Flag threshold
                    <input
                      type="range"
                      min="0.5"
                      max="0.95"
                      step="0.05"
                      value={threshold}
                      onChange={(e) => setThreshold(parseFloat(e.target.value))}
                      style={{ display: "block", width: "100%", marginTop: "4px" }}
                    />
                  </label>
                  <div style={{ textAlign: "right", fontSize: "11px", color: colors.grey02 }}>{Math.round(threshold * 100)}%</div>
                </div>

                <VehicleSelector vehicles={vehicles} selectedId={vehicle.id} onSelect={setSelectedVehicleId} />

                <strong>Extracted attributes</strong>
                <div style={{ marginTop: "12px" }}>
                  <AttributeRow
                    label="Make"
                    value={vehicle.make}
                    options={["Toyota", "Ford", "Mazda", "Holden", "Subaru", "Nissan", "BMW"]}
                    onSave={(v) => handleCorrect("make", v)}
                  />
                  <AttributeRow
                    label="Model"
                    value={vehicle.model}
                    options={modelsByMake[vehicle.make] || []}
                    onSave={(v) => handleCorrect("model", v)}
                  />
                  <AttributeRow
                    label="Colour"
                    value={vehicle.color}
                    options={["Steel Blue", "Red", "Charcoal", "Dark Green", "Gold", "White", "Black"]}
                    onSave={(v) => handleCorrect("color", v)}
                  />
                  <AttributeRow
                    label="Body type"
                    value={vehicle.bodyType}
                    options={["Ute / Pickup", "Sedan", "SUV", "Wagon", "Hatchback", "Van"]}
                    onSave={(v) => handleCorrect("bodyType", v)}
                  />
                </div>

                {features.length > 0 && (
                  <>
                    <strong style={{ display: "block", marginTop: "20px" }}>Features</strong>
                    <FeatureList items={features} />
                  </>
                )}

                <strong style={{ display: "block", marginTop: "20px" }}>Damage</strong>
                <DamageList items={damage} />

                <strong style={{ display: "block", marginTop: "20px" }}>Additional metadata</strong>
                <div style={{ fontSize: "11px", color: colors.placeholderText, marginBottom: "8px" }}>
                  Awaiting detection pipeline
                </div>
                {PLACEHOLDER_FIELDS.map((label) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "9px 12px",
                      background: colors.placeholderBg,
                      borderRadius: "8px",
                      marginBottom: "6px",
                    }}
                  >
                    <span style={{ fontSize: "12.5px", color: colors.grey02 }}>{label}</span>
                    <span style={{ fontSize: "11px", color: colors.placeholderText, fontStyle: "italic" }}>Not yet available</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activeView === "performance" && <ModelPerformance captures={captures} threshold={threshold} />}
        {activeView === "audit" && <AuditLog entries={auditLog} />}
        {activeView === "history" && (
          <HistorySearch
            captures={captures}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            downloadJson={downloadJson}
          />
        )}
        {activeView === "settings" && <SettingsPage />}
      </div>

      <Toast message={toast?.text} isError={toast?.isError} />
    </div>
  );
}

export default App;