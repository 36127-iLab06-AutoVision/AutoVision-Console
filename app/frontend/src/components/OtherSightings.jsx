import { colors } from "../theme.js";

function OtherSightings() {
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ fontSize: "12px", fontWeight: 600 }}>Other sightings of this vehicle</span>
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
      <div style={{ fontSize: "11px", color: colors.placeholderText, marginBottom: "8px" }}>
        Needs vehicle re-identification, which is outside the current project scope.
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