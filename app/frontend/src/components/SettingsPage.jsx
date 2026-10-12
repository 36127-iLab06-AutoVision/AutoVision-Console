import { colors } from "../theme.js";

const SETTINGS_SECTIONS = [
  { title: "Access Control", desc: "Manage who can view and correct capture records." },
  { title: "Model Version", desc: "Pin or switch the active detection model version." },
  { title: "Data Retention", desc: "Set how long captures and audit history are kept." },
  { title: "Notifications", desc: "Alerts for flagged captures above a chosen priority." },
];

function SettingsPage() {
  return (
    <div style={{ padding: "20px", maxWidth: "700px" }}>
      <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>Settings</h2>

      {SETTINGS_SECTIONS.map((s) => (
        <div key={s.title} className="card" style={{ padding: "16px 18px", marginBottom: "10px", opacity: 0.6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>{s.title}</span>
          </div>
          <div style={{ fontSize: "12px", color: colors.grey02, marginTop: "4px" }}>{s.desc}</div>
        </div>
      ))}
    </div>
  );
}

export default SettingsPage;