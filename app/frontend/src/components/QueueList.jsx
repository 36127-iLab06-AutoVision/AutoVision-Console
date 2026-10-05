import { isFlagged } from "../utils/confidence.js";

function QueueList({ captures, selectedId, onSelect, threshold }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {captures.map((cap) => {
        const flagged = isFlagged(cap, threshold);
        const conditions = cap.conditions || [];

        return (
          <button
            key={cap.id}
            className="queue-item"
            onClick={() => onSelect(cap.id)}
            style={{
              textAlign: "left",
              padding: "10px",
              background: cap.id === selectedId ? "#146CFD" : "#1B2338",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{cap.camera} - {cap.time}</span>
              {flagged && (
                <span style={{ fontSize: "10px", background: "#E1261C", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold" }}>
                  REVIEW
                </span>
              )}
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