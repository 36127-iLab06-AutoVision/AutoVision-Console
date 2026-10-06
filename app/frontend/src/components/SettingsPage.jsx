import { colors } from "../theme.js";

const SETTINGS_SECTIONS = [
  { title: "Access control", desc: "Manage who can view and correct capture records." },
  { title: "Model version", desc: "Pin or switch the active detection model version." },
  { title: "Data retention", desc: "Set how long captures and audit history are kept." },
  { title: "Notifications", desc: "Alerts for flagged captures above a chosen priority." },
];

function SettingsPage() {
  return (
    <div style={{ padding: "20px", maxWidth: "700px" }}>
      <h2 style={{ fontSize: "18px", marginBottom: "4px" }}>Settings</h2>
      <p style={{ fontSize: "13px", color: colors.grey02, marginBottom: "20px" }}>
        Planned for a future release. These are not part of the current prototype.
      </p>

      {SETTINGS_SECTIONS.map((s) => (
        <div key={s.title} className="card" style={{ padding: "16px 18px", marginBottom: "10px", opacity: 0.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>{s.title}</span>
            <span
              style={{
                fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase",
                padding: "2px 6px", borderRadius: "4px",
                background: colors.placeholderBg, color: colors.placeholderText,
              }}
            >
              Planned
            </span>
          </div>
          <div style={{ fontSize: "12px", color: colors.grey02, marginTop: "4px" }}>{s.desc}</div>
        </div>
      ))}
    </div>
  );
}

export default SettingsPage;