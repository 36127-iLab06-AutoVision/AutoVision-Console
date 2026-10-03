import ConfidenceBar from "./ConfidenceBar.jsx";

function average(captures, field) {
  const sum = captures.reduce((total, cap) => total + cap[field], 0);
  return sum / captures.length;
}

function ModelPerformance({ captures, threshold }) {
  const flaggedCount = captures.filter((cap) => {
    const minConf = Math.min(cap.makeConf, cap.modelConf, cap.colorConf, cap.bodyTypeConf);
    return minConf < threshold;
  }).length;

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
            <ConfidenceBar value={m.value} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default ModelPerformance;