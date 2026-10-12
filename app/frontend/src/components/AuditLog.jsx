import { colors, mono } from "../theme.js";

function AuditLog({ entries }) {
  return (
    <div style={{ padding: "20px", maxWidth: "900px" }}>
      <h2 style={{ fontSize: "20px", marginBottom: "6px" }}>Audit Log</h2>
      <p style={{ fontSize: "14px", color: colors.grey02, marginTop: 0, marginBottom: "20px" }}>
        Every correction made in this system, recorded server-side.
      </p>

      {entries.length === 0 ? (
        <div className="card" style={{ padding: "20px 22px" }}>
          <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "4px" }}>No corrections recorded yet.</div>
          <div style={{ fontSize: "14px", color: colors.grey02 }}>
            When a reviewer edits an attribute in the Review Queue, the change appears here with the time,
            the old value and the new value.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "0" }}>
          {entries.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: "16px", padding: "14px 18px", borderBottom: `1px solid ${colors.grey04}` }}>
              <span style={{ ...mono, fontSize: "12px", color: colors.grey02, width: "110px", flexShrink: 0 }}>{e.time}</span>
              <span style={{ fontSize: "14px" }}>{e.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AuditLog;