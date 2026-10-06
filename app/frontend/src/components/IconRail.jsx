import { colors, gradients } from "../theme.js";

const NAV_ITEMS = [
  { id: "queue", icon: "☰", label: "Queue" },
  { id: "performance", icon: "◐", label: "Analytics" },
  { id: "audit", icon: "✓", label: "Audit log" },
  { id: "settings", icon: "⚙", label: "Settings" },
  { id: "history", icon: "🕘", label: "History" },
];

// Layout (side bar on large screens, bottom bar on phones) lives in App.css under .icon-rail.
function IconRail({ activeView, onNavigate }) {
  return (
    <nav className="icon-rail" style={{ backgroundImage: gradients.header }}>
      {NAV_ITEMS.map((item) => {
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            className="icon-rail-btn"
            onClick={() => onNavigate(item.id)}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            style={{
              background: active ? "rgba(255,255,255,0.18)" : "transparent",
              color: active ? colors.white : "rgba(255,255,255,0.55)",
            }}
          >
            <span style={{ fontSize: "18px" }}>{item.icon}</span>
            <span style={{ fontSize: "8.5px", marginTop: "3px", fontWeight: 600 }}>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default IconRail;
