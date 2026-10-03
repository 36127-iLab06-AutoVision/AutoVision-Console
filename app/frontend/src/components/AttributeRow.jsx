import { useState } from "react";

function AttributeRow({ label, value, options, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draftValue, setDraftValue] = useState(value);

  function handleSave() {
    onSave(draftValue);
    setEditing(false);
  }

  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
      <span style={{ width: "60px" }}>{label}:</span>

      {editing ? (
        <>
          <select
            value={draftValue}
            onChange={(e) => setDraftValue(e.target.value)}
            style={{ padding: "4px" }}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <button onClick={handleSave}>Save</button>
        </>
      ) : (
        <>
          <strong>{value}</strong>
          <button
            onClick={() => setEditing(true)}
            title="Correct this value"
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