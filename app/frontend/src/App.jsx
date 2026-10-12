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

// Choices in the correction box. The make list is built from the keys below, so there is one
// list to keep up to date. A value the model gives that is not listed here (for example "Opel")
// is still shown at the top of the box, so nothing is lost.
const modelsByMake = {
  Audi: ["A3", "A4", "Q5"],
  BMW: ["3 Series", "5 Series", "X3", "X5"],
  Ford: ["Ranger", "Falcon", "Focus", "Fiesta", "Territory", "Everest", "Mustang", "Escape"],
  Holden: ["Commodore", "Colorado", "Astra", "Cruze", "Barina", "Captiva", "Trax", "Caprice"],
  Honda: ["Civic", "Accord", "CR-V", "Jazz", "HR-V"],
  Hyundai: ["i30", "Elantra", "Tucson", "Santa Fe", "Kona", "Accent", "Veracruz", "Grandeur"],
  Isuzu: ["D-Max", "MU-X"],
  Kia: ["Cerato", "Sportage", "Sorento", "Rio", "Carnival", "Picanto"],
  Lexus: ["ES", "IS", "NX", "RX"],
  Mazda: ["Mazda2", "Mazda3", "Mazda6", "CX-3", "CX-5", "CX-9", "BT-50"],
  "Mercedes-Benz": ["C-Class", "E-Class", "GLC"],
  MG: ["MG3", "MG5", "ZS"],
  Mitsubishi: ["Lancer", "Outlander", "Triton", "Pajero", "ASX"],
  Nissan: ["Navara", "X-Trail", "Pathfinder", "Qashqai", "Patrol", "Pulsar"],
  Subaru: ["Impreza", "Forester", "Outback", "WRX", "XV"],
  Suzuki: ["Swift", "Vitara", "Jimny"],
  Toyota: ["Corolla", "Camry", "RAV4", "Yaris", "Kluger", "Hilux", "Land Cruiser", "Prado"],
  Volkswagen: ["Golf", "Polo", "Passat", "Tiguan", "Amarok"],
};

const MAKE_OPTIONS = Object.keys(modelsByMake);

// Colour and body type use the same names as the ML team's classes, so a correction reads the
// same as a prediction.
const COLOUR_OPTIONS = ["Black", "Blue", "Brown", "Champagne", "Green", "Purple", "Red", "Silver", "White", "Yellow"];
const BODY_TYPE_OPTIONS = [
  "MPV", "SUV", "Convertible", "Crossover", "Estate", "Fastback",
  "Hardtop Convertible", "Hatchback", "Minibus", "Pickup", "Sedan", "Sports",
];

const PLACEHOLDER_FIELDS = ["Day / Night", "Camera / Checkpoint Identifier", "GPS Location", "Model Version", "Vehicle Year / Trim"];

// Names shown to people for each editable field (the keys are the names the server uses).
const FIELD_LABELS = { make: "Make", model: "Model", color: "Colour", bodyType: "Body Type" };

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
  // Is a detection model connected to the server? null while we are still asking.
  const [detectAvailable, setDetectAvailable] = useState(null);

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

    request("/api/detect/status")
      .then((data) => setDetectAvailable(Boolean(data.available)))
      .catch(() => setDetectAvailable(false));
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

  // Nothing in the queue yet: still show the upload panel so the first image can be added.
  if (!capture) {
    return (
      <div style={{ background: colors.paper, minHeight: "100vh", color: colors.grey01, display: "flex" }}>
        <IconRail activeView={activeView} onNavigate={setActiveView} />
        <div className="app-main" style={{ flex: 1, minWidth: 0 }}>
          <div className="app-top">
            <Header />
          </div>
          <div className="layout">
            <div className="sidebar card" style={{ background: colors.white, padding: "16px" }}>
              <UploadPanel onDetect={handleDetect} detectAvailable={detectAvailable} />
            </div>
            <div className="viewer">
              <p style={{ color: colors.grey02, textAlign: "center", marginTop: "60px" }}>
                No captures yet. Upload an image and select Run Detection to begin.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // A capture can hold several vehicles. Older captures are their own single vehicle.
  const isMulti = Array.isArray(capture.vehicles) && capture.vehicles.length > 0;
  // A capture the model processed but found no vehicles in (vehicles is an empty list).
  const noVehicles = Array.isArray(capture.vehicles) && capture.vehicles.length === 0;
  const vehicles = getVehicles(capture);
  const vehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0];

  // Multi-vehicle images: selected vehicle's box is blue, the others grey.
  const vehicleBoxes = isMulti
    ? capture.vehicles
        .filter((v) => v.box)
        .map((v) => ({
          label: `Vehicle ${v.id}`,
          color: v.id === vehicle.id ? "#146CFD" : "#7A8CA8",
          ...v.box,
        }))
    : capture.boxes || [];

  // Damage findings that came with a location are outlined in red, for the selected vehicle only.
  const damageBoxes =
    isMulti && Array.isArray(vehicle.damage)
      ? vehicle.damage
          .map((d, i) =>
            d && typeof d === "object" && d.box
              ? { label: `Damage ${i + 1} (${d.label || d.part || "damage"})`, shortLabel: `D${i + 1}`, chipInside: true, color: "#E1261C", ...d.box }
              : null
          )
          .filter(Boolean)
      : [];

  const boxes = [...vehicleBoxes, ...damageBoxes];

  // null means "not assessed", [] means "checked, none found". Keep them apart.
  const features = vehicle.features ?? null;
  const damage = vehicle.damage ?? null;
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
        setToast({ text: `${FIELD_LABELS[field] || field} updated`, isError: false });
      })
      .catch(handleRequestError);
  }

  // "Run detection": the server sends the image to the detection model and saves the result.
  // Resolves with the model's warnings. Rejects with the server's message if anything fails.
  async function handleDetect(imageDataUrl) {
    const result = await request("/api/detect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageUrl: imageDataUrl }),
    });
    setCaptures((previous) => [result.capture, ...previous]);
    setSelectedId(result.capture.id);
    setSelectedVehicleId(null);
    return result.warnings || [];
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
  // The average of each capture's weakest score. Coloured with the same bands as the confidence bars.
  const avgScore = scored.length > 0 ? scored.reduce((t, s) => t + s, 0) / scored.length : null;
  const avgConfidence = avgScore !== null ? `${Math.round(avgScore * 100)}%` : "Not available";
  const avgColor = avgScore === null ? colors.grey02 : avgScore >= 0.8 ? colors.green : avgScore >= 0.6 ? "#B35C00" : colors.red;

  return (
    <div style={{ background: colors.paper, minHeight: "100vh", color: colors.grey01, display: "flex" }}>
      <IconRail activeView={activeView} onNavigate={setActiveView} />

      <div className="app-main" style={{ flex: 1, minWidth: 0 }}>
        <div className="app-top">
        <Header />

        <div className="app-crumbs" style={{ background: colors.white, borderBottom: `1px solid ${colors.grey03}`, padding: "10px 20px", fontSize: "12px", color: colors.grey02 }}>
          Home <span style={{ color: colors.grey03, margin: "0 6px" }}>/</span>
          Vehicle Identification Unit <span style={{ color: colors.grey03, margin: "0 6px" }}>/</span>
          <span style={{ color: colors.navy, fontWeight: 600 }}>
            {activeView === "queue" && "Review Queue"}
            {activeView === "performance" && "Analytics"}
            {activeView === "audit" && "Audit Log"}
            {activeView === "history" && "History"}
            {activeView === "settings" && "Settings"}
          </span>
        </div>
        </div>

        {activeView === "queue" && (
          <>
            <div className="stats-row" style={{ display: "flex", gap: "16px", padding: "16px 20px 0" }}>
              {[
                { label: "Total Captures", value: captures.length, color: colors.navy },
                { label: "Flagged for Review", value: flaggedCount, color: colors.red },
                { label: "Average Weakest Confidence", value: avgConfidence, color: avgColor },
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
                  <div style={{ fontSize: "15px", fontWeight: 500, color: colors.grey02, marginTop: "2px" }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="layout">
              <div className="sidebar card" style={{ background: colors.white, padding: "16px" }}>
                <UploadPanel onDetect={handleDetect} detectAvailable={detectAvailable} />
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
                      Show Detections
                    </label>
                  </div>

                  {weakest !== null && (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <ConfidenceBar value={weakest} />
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{Math.round(weakest * 100)}%</span>
                      <span style={{ fontSize: "12px", color: colors.grey02 }}>Weakest Confidence</span>
                    </div>
                  )}

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
                    <strong>Recent Corrections:</strong>
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
                    Flag Threshold
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

                {noVehicles ? (
                  <div
                    style={{
                      padding: "20px 16px",
                      background: colors.grey04,
                      borderRadius: "8px",
                      fontSize: "13px",
                      color: colors.grey02,
                      textAlign: "center",
                      lineHeight: 1.5,
                    }}
                  >
                    <strong style={{ display: "block", color: colors.grey01, marginBottom: "4px" }}>No Vehicles Detected</strong>
                    The model found no vehicles in this image. If you can see one, flag it for the Machine Learning team.
                  </div>
                ) : (
                  <>
                    <VehicleSelector vehicles={vehicles} selectedId={vehicle.id} onSelect={setSelectedVehicleId} />

                    <strong style={{ fontSize: "18px" }}>Extracted Attributes</strong>
                    <div style={{ marginTop: "12px" }}>
                      <AttributeRow
                        label="Make"
                        value={vehicle.make}
                        confidence={vehicle.makeConf}
                        options={MAKE_OPTIONS}
                        onSave={(v) => handleCorrect("make", v)}
                      />
                      <AttributeRow
                        label="Model"
                        value={vehicle.model}
                        confidence={vehicle.modelConf}
                        options={modelsByMake[vehicle.make] || []}
                        onSave={(v) => handleCorrect("model", v)}
                      />
                      <AttributeRow
                        label="Colour"
                        value={vehicle.color}
                        confidence={vehicle.colorConf}
                        options={COLOUR_OPTIONS}
                        onSave={(v) => handleCorrect("color", v)}
                      />
                      <AttributeRow
                        label="Body Type"
                        value={vehicle.bodyType}
                        confidence={vehicle.bodyTypeConf}
                        options={BODY_TYPE_OPTIONS}
                        onSave={(v) => handleCorrect("bodyType", v)}
                      />
                    </div>

                    {(features === null || features.length > 0) && (
                      <>
                        <strong style={{ display: "block", marginTop: "20px", fontSize: "18px" }}>Features</strong>
                        {features === null ? (
                          <p style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>
                            Not assessed. The model has not checked this vehicle for features.
                          </p>
                        ) : (
                          <FeatureList items={features} />
                        )}
                      </>
                    )}

                    <strong style={{ display: "block", marginTop: "20px", fontSize: "18px" }}>Damage</strong>
                    <DamageList items={damage} />
                  </>
                )}

                <strong style={{ display: "block", marginTop: "20px", fontSize: "18px" }}>Additional Metadata</strong>
                <div style={{ marginBottom: "8px" }} />
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
            threshold={threshold}
          />
        )}
        {activeView === "settings" && <SettingsPage />}
      </div>

      <Toast message={toast?.text} isError={toast?.isError} />
    </div>
  );
}

export default App;