import ConfidenceBar from "./ConfidenceBar.jsx";

function DamageList({ items }) {
  if (items.length === 0) {
    return <p style={{ fontSize: "13px", color: "#666" }}>No damage detected.</p>;
  }

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #ddd" }}>
          <div>
            <strong>{item.part}</strong>
            <div style={{ fontSize: "12px", color: "#E1261C" }}>{item.severity}</div>
          </div>
          <ConfidenceBar value={item.confidence} />
        </div>
      ))}
    </div>
  );
}

export default DamageList;