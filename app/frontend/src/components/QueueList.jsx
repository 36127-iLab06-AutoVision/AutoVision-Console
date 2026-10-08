import { isFlagged, describeVehicles } from "../utils/confidence.js";

// One line saying what is in the capture, for telling queue entries apart at a glance.
function summary(cap) {
  if (Array.isArray(cap.vehicles) && cap.vehicles.length === 0) return "No vehicles detected";
  return describeVehicles(cap);
}

function QueueList({ captures, selectedId, onSelect, threshold }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {captures.map((cap) => {
        const flagged = isFlagged(cap, threshold);
        const conditions = cap.conditions || [];
        const selected = cap.id === selectedId;

        return (
          <button
            key={cap.id}
            className="queue-item"
            onClick={() => onSelect(cap.id)}
            style={{
              textAlign: "left",
              width: "100%",
              minWidth: 0,
              padding: "10px",
              background: selected ? "#146CFD" : "#1B2338",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <span style={{ fontWeight: 600, minWidth: 0, overflowWrap: "anywhere" }}>{cap.camera}</span>
              {flagged && (
                <span style={{ fontSize: "10px", background: "#E1261C", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold", flexShrink: 0 }}>
                  REVIEW
                </span>
              )}
            </div>

            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)", overflowWrap: "anywhere" }}>
              {cap.id} &middot; {cap.time}
            </div>

            <div
              style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.7)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
              }}
            >
              {summary(cap)}
            </div>

            {conditions.length > 0 && (
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {conditions.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: "10px",
                      color: "#CDD3D6",
                      border: "1px solid #495054",
                      borderRadius: "3px",
                      padding: "1px 5px",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default QueueList;
