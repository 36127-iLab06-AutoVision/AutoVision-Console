import { colors } from "../theme.js";
import ChequerBand from "./ChequerBand.jsx";

// Navigation lives in the icon rail on the left, so the header only identifies the product.
function Header() {
  return (
    <div>
      <div className="hdr-strip" style={{ background: colors.navyDark, color: colors.white, fontSize: "11px", padding: "4px 20px", display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <span>Student research prototype</span>
        <span style={{ color: colors.grey03 }}>UTS 36127 iLab Project 06 - Not for operational use</span>
      </div>

      <div className="hdr-main" style={{ background: colors.navy, color: colors.white, padding: "16px 20px" }}>
        <h1 className="hdr-title" style={{ margin: 0, fontSize: "28px" }}>Vehicle Identification Unit</h1>
        <p className="hdr-sub" style={{ margin: "2px 0 0", fontSize: "16px", color: colors.grey03 }}>
          Vehicle Metadata Review Console
        </p>
      </div>

      <ChequerBand height={6} />
    </div>
  );
}

export default Header;
