import { colors } from "../theme.js";

const SETTINGS_SECTIONS = [
  { title: "Access Control", desc: "Manage who can view and correct capture records." },
  { title: "Model Version", desc: "Pin or switch the active detection model version." },
  { title: "Data Retention", desc: "Set how long captures and audit history are kept." },
  { title: "Notifications", desc: "Alerts for flagged captures above a chosen priority." },
];

// Read-only facts about the models, taken from the ML team's pipeline (modeling/inference.py).
const MODELS_IN_USE = [
  { task: "Vehicle Detection", model: "YOLO11s (COCO)" },
  { task: "Make & Model", model: "ResNet50" },
  { task: "Body Type", model: "ConvNeXt-Tiny" },
  { task: "Colour", model: "Swin-T" },
  { task: "Damage", model: "YOLO11s" },
];

function NotAvailableTag() {
  return (
    <span
      style={{
        fontSize: "12px",
        fontStyle: "italic",
        color: colors.placeholderText,
        background: colors.placeholderBg,
        padding: "3px 10px",
        borderRadius: "12px",
        whiteSpace: "nowrap",
      }}
    >
      Not yet available
    </span>
  );
}

function SettingsPage() {
  return (
    <div style={{ padding: "20px", maxWidth: "900px" }}>
      <h2 style={{ fontSize: "20px", marginBottom: "20px" }}>Settings</h2>

      <div className="card" style={{ padding: "18px 20px", marginBottom: "20px" }}>
        <div style={{ fontSize: "16px", fontWeight: 600 }}>Models in Use</div>
        <div style={{ marginBottom: "8px" }} />
        {MODELS_IN_USE.map((m) => (
          <div
            key={m.task}
            style={{ display: "flex", justifyContent: "space-between", gap: "16px", padding: "9px 0", borderTop: `1px solid ${colors.grey04}` }}
          >
            <span style={{ fontSize: "14px", color: colors.grey02 }}>{m.task}</span>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>{m.model}</span>
          </div>
        ))}
      </div>

      {SETTINGS_SECTIONS.map((s) => (
        <div key={s.title} className="card" style={{ padding: "16px 20px", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
            <span style={{ fontSize: "15px", fontWeight: 600 }}>{s.title}</span>
            <NotAvailableTag />
          </div>
          <div style={{ fontSize: "13px", color: colors.grey02, marginTop: "4px" }}>{s.desc}</div>
        </div>
      ))}
    </div>
  );
}

export default SettingsPage;