import ConfidenceBar from "./ConfidenceBar.jsx";
import { isFlagged, getVehicles } from "../utils/confidence.js";

function average(captures, field) {
  const scores = captures
    .flatMap((cap) => getVehicles(cap))
    .map((v) => v[field])
    .filter((s) => typeof s === "number");
  return scores.length > 0 ? scores.reduce((t, s) => t + s, 0) / scores.length : null;
}

// The ML team currently predicts make and model together, so both carry the same score.
// When every scored vehicle has identical make and model scores, show one combined bar.
// If the scores ever differ (separate models), show them separately again.
function makeAndModelAreCombined(captures) {
  const scored = captures
    .flatMap((cap) => getVehicles(cap))
    .filter((v) => typeof v.makeConf === "number" && typeof v.modelConf === "number");
  return scored.length > 0 && scored.every((v) => v.makeConf === v.modelConf);
}

function ModelPerformance({ captures, threshold }) {
  const flaggedCount = captures.filter((cap) => isFlagged(cap, threshold)).length;

  const makeModel = makeAndModelAreCombined(captures)
    ? [{ label: "Make & Model", value: average(captures, "makeConf") }]
    : [
        { label: "Make", value: average(captures, "makeConf") },
        { label: "Model", value: average(captures, "modelConf") },
      ];

  const metrics = [
    ...makeModel,
    { label: "Colour", value: average(captures, "colorConf") },
    { label: "Body Type", value: average(captures, "bodyTypeConf") },
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
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ConfidenceBar value={m.value} />
                <span
                  style={{
                    width: "44px",
                    textAlign: "right",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#2B3236",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {Math.round(m.value * 100)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ModelPerformance;