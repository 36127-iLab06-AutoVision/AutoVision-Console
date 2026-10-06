import ConfidenceBar from "./ConfidenceBar.jsx";

// Three states, and they mean different things:
//   items is null/undefined -> the model did not check for damage ("Not assessed")
//   items is []             -> the model checked and found none ("No damage detected")
//   items has entries       -> the damage found. An entry is either text ("dent")
//                              or an object { part, severity, confidence }.
function DamageList({ items }) {
  if (items === null || items === undefined) {
    return (
      <p style={{ fontSize: "13px", color: "#666", fontStyle: "italic" }}>
        Not assessed. The model has not checked this vehicle for damage.
      </p>
    );
  }

  if (items.length === 0) {
    return <p style={{ fontSize: "13px", color: "#666" }}>No damage detected.</p>;
  }

  return (
    <div>
      {items.map((item, i) => {
        const isText = typeof item === "string";
        const part = isText ? item : item?.part || item?.label || "Damage";
        const severity = isText ? null : item?.severity;
        const confidence = isText ? null : item?.confidence;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #ddd" }}>
            <div>
              <strong>{part}</strong>
              {severity && <div style={{ fontSize: "12px", color: "#E1261C" }}>{severity}</div>}
            </div>
            {typeof confidence === "number" && <ConfidenceBar value={confidence} />}
          </div>
        );
      })}
    </div>
  );
}

export default DamageList;