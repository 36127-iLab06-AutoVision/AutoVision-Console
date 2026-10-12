import { useState } from "react";

// Same bands as the confidence bar, with darker text shades so they stay readable on white.
function confidenceColor(value) {
  if (value >= 0.8) return "#0A7D3E";
  if (value >= 0.6) return "#B35C00";
  return "#C0160D";
}

function AttributeRow({ label, value, confidence, options, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value ?? "");
  const missing = value === null || value === undefined || value === "";
  const hasScore = typeof confidence === "number";

  // If the current value isn't in the list (for example a make the model
  // returned that we haven't hardcoded), add it so the dropdown shows it correctly.
  const optionList = !missing && !options.includes(value) ? [value, ...options] : options;

  function startEditing() {
    setDraftValue(value ?? "");
    setEditing(true);
  }

  function handleSave() {
    if (!draftValue) return;
    onSave(draftValue);
    setEditing(false);
  }

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
      <span style={{ width: "60px" }}>{label}:</span>

      {editing ? (
        <>
          <select value={draftValue} onChange={(e) => setDraftValue(e.target.value)} style={{ padding: "4px" }}>
            {missing && <option value="">Select...</option>}
            {optionList.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button onClick={handleSave}>Save</button>
        </>
      ) : (
        <>
          {missing ? (
            <span style={{ color: "#98A1AB", fontStyle: "italic", fontSize: "13px" }}>Not available</span>
          ) : (
            <strong>{value}</strong>
          )}
          <button
            onClick={startEditing}
            title={missing ? "Add this value" : "Correct this value"}
            style={{
              background: "transparent",
              border: "1px solid #CDD3D6",
              borderRadius: "50%",
              width: "26px",
              height: "26px",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            ✎
          </button>
          {!missing && (
            <span
              title="Model confidence for this value"
              style={{
                marginLeft: "auto",
                flexShrink: 0,
                fontSize: "16px",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: hasScore ? confidenceColor(confidence) : "#98A1AB",
              }}
            >
              {hasScore ? `${Math.round(confidence * 100)}%` : "Not available"}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default AttributeRow;