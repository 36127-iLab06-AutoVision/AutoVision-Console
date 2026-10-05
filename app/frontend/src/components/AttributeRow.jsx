import { useState } from "react";

function AttributeRow({ label, value, options, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value ?? "");
  const missing = value === null || value === undefined || value === "";

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
        </>
      )}
    </div>
  );
}

export default AttributeRow;