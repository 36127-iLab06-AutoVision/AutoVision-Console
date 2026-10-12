import { colors } from "../theme.js";

function OtherSightings() {
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600 }}>Other Sightings of this Vehicle</span>
      </div>
      <div style={{ display: "flex", gap: "10px", overflowX: "auto" }}>
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            style={{
              width: "140px", height: "80px", flexShrink: 0,
              background: colors.placeholderBg, borderRadius: "8px",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "11px", color: colors.placeholderText, fontStyle: "italic",
            }}
          >
            Not yet available
          </div>
        ))}
      </div>
    </div>
  );
}

export default OtherSightings;