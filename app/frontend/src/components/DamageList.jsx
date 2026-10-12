// Same colour bands as the attribute rows, so a percentage reads the same everywhere.
function confidenceColor(value) {
  if (value >= 0.8) return "#0A7D3E";
  if (value >= 0.6) return "#B35C00";
  return "#C0160D";
}

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
        const hasConfidence = typeof confidence === "number";
        const percent = hasConfidence ? Math.round(Math.min(Math.max(confidence, 0), 1) * 100) : 0;
        return (
          <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #ddd" }}>
            {/* Name, bar and percentage on one line. The bar takes whatever room is left and shrinks to fit. */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <strong style={{ flexShrink: 0 }}>{part}</strong>
              {hasConfidence && (
                <>
                  <div style={{ flex: 1, minWidth: 30, height: "10px", borderRadius: "5px", background: "#333", overflow: "hidden" }}>
                    <div style={{ width: `${percent}%`, height: "100%", background: confidenceColor(confidence) }} />
                  </div>
                  <span style={{ flexShrink: 0, fontSize: "16px", fontWeight: 700, minWidth: "44px", textAlign: "right", color: confidenceColor(confidence) }}>
                    {percent}%
                  </span>
                </>
              )}
            </div>
            {severity && <div style={{ fontSize: "12px", color: "#E1261C", marginTop: "2px" }}>{severity}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default DamageList;