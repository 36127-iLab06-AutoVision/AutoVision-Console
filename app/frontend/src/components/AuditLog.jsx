import { colors, mono } from "../theme.js";

function AuditLog({ entries }) {
  return (
    <div style={{ padding: "20px", maxWidth: "800px" }}>
      <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Audit log</h2>
      <p style={{ fontSize: "13px", color: colors.grey02, marginBottom: "20px" }}>
        Every correction made in this system, recorded server-side.
      </p>

      {entries.length === 0 ? (
        <div style={{ fontSize: "13px", color: colors.grey02 }}>No corrections recorded yet.</div>
      ) : (
        <div className="card" style={{ padding: "0" }}>
          {entries.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: "16px", padding: "14px 18px", borderBottom: `1px solid ${colors.grey04}` }}>
              <span style={{ ...mono, fontSize: "11px", color: colors.grey02, width: "90px", flexShrink: 0 }}>{e.time}</span>
              <span style={{ fontSize: "13px" }}>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AuditLog;