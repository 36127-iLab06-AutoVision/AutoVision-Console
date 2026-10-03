import { colors } from "../theme.js";

function OtherSightings() {
  return (
    <div style={{ marginTop: "16px" }}>
      <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Other sightings of this vehicle</div>
      <div style={{ fontSize: "11px", color: colors.placeholderText, marginBottom: "8px" }}>
        Requires vehicle re-identification — not yet in scope
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