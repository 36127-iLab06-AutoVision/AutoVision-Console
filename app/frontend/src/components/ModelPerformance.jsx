import ConfidenceBar from "./ConfidenceBar.jsx";
import { isFlagged, getVehicles } from "../utils/confidence.js";

function average(captures, field) {
  const scores = captures
    .flatMap((cap) => getVehicles(cap))
    .map((v) => v[field])
    .filter((s) => typeof s === "number");
  return scores.length > 0 ? scores.reduce((t, s) => t + s, 0) / scores.length : null;
}

function ModelPerformance({ captures, threshold }) {
  const flaggedCount = captures.filter((cap) => isFlagged(cap, threshold)).length;

  const metrics = [
    { label: "Make", value: average(captures, "makeConf") },
    { label: "Model", value: average(captures, "modelConf") },
    { label: "Colour", value: average(captures, "colorConf") },
    { label: "Body type", value: average(captures, "bodyTypeConf") },
  ];

  return (
    <div style={{ padding: "20px", maxWidth: "700px" }}>
      <h2 style={{ fontSize: "16px", marginBottom: "16px" }}>Model Performance</h2>

      <div className="card" style={{ padding: "16px", marginBottom: "20px", display: "flex", gap: "32px" }}>
        <div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#002664" }}>{captures.length}</div>
          <div style={{ fontSize: "12px", color: "#495054" }}>Total Captures</div>
        </div>
        <div>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "#E1261C" }}>{flaggedCount}</div>
          <div style={{ fontSize: "12px", color: "#495054" }}>Flagged for Review (at {Math.round(threshold * 100)}% threshold)</div>
        </div>
      </div>

      <div className="card" style={{ padding: "16px" }}>
        <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "12px" }}>Average Confidence by Attribute</div>
        {metrics.map((m) => (
          <div key={m.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #EBEBEB" }}>
            <span style={{ fontSize: "13px" }}>{m.label}</span>
            {m.value === null ? (
              <span style={{ fontSize: "12px", color: "#98A1AB" }}>Not available</span>
            ) : (
              <ConfidenceBar value={m.value} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ModelPerformance;