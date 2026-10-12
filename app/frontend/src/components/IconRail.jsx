import { colors, gradients } from "../theme.js";

// Simple line icons (24 x 24 grid, drawn with the current text colour, so the active and
// inactive colours below apply to them automatically). No icon library is needed.
const ICONS = {
  // A list: the queue of captures waiting to be reviewed.
  queue: (
    <>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </>
  ),
  // Three bars: the analytics view.
  performance: (
    <>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </>
  ),
  // A clipboard with a tick: the record of every correction.
  audit: (
    <>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <polyline points="9 14 11 16 15 12" />
    </>
  ),
  // Sliders: settings.
  settings: (
    <>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </>
  ),
  // A clock: search and export of past captures.
  history: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
};

const NAV_ITEMS = [
  { id: "queue", label: "Queue" },
  { id: "performance", label: "Analytics" },
  { id: "audit", label: "Audit Log" },
  { id: "settings", label: "Settings" },
  { id: "history", label: "History" },
];

// Layout and sizes (side bar on large screens, bottom bar on phones) live in App.css under .icon-rail.
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
            <svg
              className="icon-rail-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {ICONS[item.id]}
            </svg>
            <span className="icon-rail-label">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default IconRail;