import ConfidenceBar from "./ConfidenceBar.jsx";
import { isFlagged, getVehicles } from "../utils/confidence.js";

const isAnswered = (value) => value !== null && value !== undefined && value !== "";

// One row per attribute: the average of the scores the model gave, and how often it gave an
// answer at all. A vehicle the model left "unknown" is not in the average, so the count of
// answers is shown next to it.
function summarise(vehicles, valueField, confField) {
  const answered = vehicles.filter((v) => isAnswered(v[valueField]));
  const scores = vehicles.map((v) => v[confField]).filter((s) => typeof s === "number");
  return {
    average: scores.length > 0 ? scores.reduce((t, s) => t + s, 0) / scores.length : null,
    answered: answered.length,
    total: vehicles.length,
  };
}

// The ML team currently predicts make and model together, so both carry the same score.
// When every scored vehicle has identical make and model scores, show one combined row.
function makeAndModelAreCombined(vehicles) {
  const scored = vehicles.filter((v) => typeof v.makeConf === "number" && typeof v.modelConf === "number");
  return scored.length > 0 && scored.every((v) => v.makeConf === v.modelConf);
}

function Stat({ value, label, color }) {
  return (
    <div>
      <div style={{ fontSize: "26px", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "14px", color: "#495054", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

function ModelPerformance({ captures, threshold }) {
  // Captures that hold no vehicles at all are left out of the attribute figures.
  const vehicles = captures.flatMap((cap) => (Array.isArray(cap.vehicles) ? cap.vehicles : getVehicles(cap)))
    .filter((v) => v && (v.make !== undefined || v.makeConf !== undefined || v.bodyType !== undefined || v.color !== undefined));
  const flaggedCount = captures.filter((cap) => isFlagged(cap, threshold)).length;

  const combined = makeAndModelAreCombined(vehicles);
  const rows = [
    ...(combined
      ? [{ label: "Make & Model", ...summarise(vehicles, "make", "makeConf") }]
      : [
          { label: "Make", ...summarise(vehicles, "make", "makeConf") },
          { label: "Model", ...summarise(vehicles, "model", "modelConf") },
        ]),
    { label: "Colour", ...summarise(vehicles, "color", "colorConf") },
    { label: "Body Type", ...summarise(vehicles, "bodyType", "bodyTypeConf") },
  ];

  // Damage: how many vehicles were checked, and how many damage findings were reported.
  const checked = vehicles.filter((v) => Array.isArray(v.damage));
  const withDamage = checked.filter((v) => v.damage.length > 0);
  const findings = checked.reduce((t, v) => t + v.damage.length, 0);

  return (
    <div style={{ padding: "20px", maxWidth: "900px" }}>
      <h2 style={{ fontSize: "20px", marginBottom: "6px" }}>Analytics</h2>
      <p style={{ fontSize: "14px", color: "#495054", marginTop: 0, marginBottom: "18px" }}>
        These figures show how confident the model says it is. They are not a measure of accuracy.
      </p>

      <div className="card" style={{ padding: "18px 20px", marginBottom: "20px", display: "flex", gap: "40px", flexWrap: "wrap" }}>
        <Stat value={captures.length} label="Total Captures" color="#002664" />
        <Stat value={vehicles.length} label="Vehicles Found" color="#002664" />
        <Stat value={flaggedCount} label={`Flagged for Review (at ${Math.round(threshold * 100)}% Threshold)`} color="#E1261C" />
      </div>

      <div className="card" style={{ padding: "18px 20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>Average Confidence by Attribute</div>
        <div style={{ fontSize: "13px", color: "#495054", marginBottom: "10px" }}>
          Averages use only the vehicles where the model gave an answer.
        </div>
        {rows.map((m) => (
          <div
            key={m.label}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", padding: "10px 0", borderBottom: "1px solid #EBEBEB", flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontSize: "15px" }}>{m.label}</div>
              <div style={{ fontSize: "12px", color: "#495054" }}>
                Answered on {m.answered} of {m.total} vehicles
              </div>
            </div>
            {m.average === null ? (
              <span style={{ fontSize: "13px", color: "#98A1AB" }}>Not available</span>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <ConfidenceBar value={m.average} />
                <span style={{ width: "48px", textAlign: "right", fontSize: "15px", fontWeight: 600, color: "#2B3236", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(m.average * 100)}%
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: "18px 20px" }}>
        <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "10px" }}>Damage</div>
        {checked.length === 0 ? (
          <div style={{ fontSize: "13px", color: "#98A1AB" }}>Not available. No vehicle has been checked for damage yet.</div>
        ) : (
          <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
            <Stat value={checked.length} label="Vehicles Checked" color="#002664" />
            <Stat value={withDamage.length} label="Vehicles With Damage Found" color="#002664" />
            <Stat value={findings} label="Damage Findings" color="#002664" />
          </div>
        )}
      </div>
    </div>
  );
}

export default ModelPerformance;