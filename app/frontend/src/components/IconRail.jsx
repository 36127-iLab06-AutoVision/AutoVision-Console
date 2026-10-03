import { colors, gradients } from "../theme.js";

const NAV_ITEMS = [
  { id: "queue", icon: "☰", label: "Queue" },
  { id: "performance", icon: "◐", label: "Analytics" },
  { id: "audit", icon: "✓", label: "Audit log" },
  { id: "settings", icon: "⚙", label: "Settings" },
  { id: "history", icon: "🕘", label: "History" },
];

function IconRail({ activeView, onNavigate }) {
  return (
    <div
      style={{
        width: "68px",
        backgroundImage: gradients.header,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: "20px",
        gap: "6px",
        flexShrink: 0,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            title={item.label}
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              background: active ? "rgba(255,255,255,0.18)" : "transparent",
              color: active ? colors.white : "rgba(255,255,255,0.55)",
              fontSize: "18px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s ease, color 0.15s ease",
            }}
          >
            <span>{item.icon}</span>
            <span style={{ fontSize: "8.5px", marginTop: "3px", fontWeight: 600 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default IconRail;