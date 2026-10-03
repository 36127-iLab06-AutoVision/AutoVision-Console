import { colors } from "../theme.js";
import ChequerBand from "./ChequerBand.jsx";

function Header({ activeView, onNavigate }) {
  const tabs = [
    { id: "queue", label: "Review Queue" },
    { id: "performance", label: "Model Performance" },
  ];

  return (
    <div>
      <div style={{ background: colors.navyDark, color: colors.white, fontSize: "11px", padding: "4px 20px", display: "flex", justifyContent: "space-between" }}>
        <span>A NSW Government Website</span>
        <span style={{ color: colors.grey03 }}>OFFICIAL - Internal Review Use only</span>
      </div>

      <div style={{ background: colors.navy, color: colors.white, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "28px" }}>Vehicle Identification Unit</h1>
          <p style={{ margin: "2px 0 0", fontSize: "16px", color: colors.grey03 }}>
            Traffic &amp; Vehicle Intelligence Command - Review Console
          </p>
        </div>

        <div style={{ display: "flex", gap: "24px", fontSize: "13px" }}>
          {tabs.map((tab) => (
            <span
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              style={{
                cursor: "pointer",
                fontWeight: activeView === tab.id ? 600 : 400,
                color: activeView === tab.id ? colors.white : colors.grey03,
                borderBottom: activeView === tab.id ? `2px solid ${colors.white}` : "2px solid transparent",
                paddingBottom: "4px",
              }}
            >
              {tab.label}
            </span>
          ))}
        </div>
      </div>

      <ChequerBand height={6} />
    </div>
  );
}

export default Header;