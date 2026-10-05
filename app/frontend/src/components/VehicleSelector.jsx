import { colors } from "../theme.js";

function VehicleSelector({ vehicles, selectedId, onSelect }) {
  if (vehicles.length < 2) return null;

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontSize: "11px", color: colors.grey02, marginBottom: "6px" }}>
        {vehicles.length} vehicles in this image
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        {vehicles.map((v) => {
          const active = v.id === selectedId;
          return (
            <button
              key={v.id}
              onClick={() => onSelect(v.id)}
              style={{
                padding: "6px 12px",
                borderRadius: "20px",
                border: `1px solid ${active ? colors.blue : colors.grey03}`,
                background: active ? colors.blue : colors.white,
                color: active ? colors.white : colors.grey01,
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Vehicle {v.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default VehicleSelector;