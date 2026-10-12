import { isFlagged, describeVehicles, getVehicles, weakestConfidence, hasUnknownAttribute } from "../utils/confidence.js";

// Where uploaded pictures are served from. Same rule as App.jsx.
const API = import.meta.env.VITE_API_URL || "http://localhost:4000";

// One line saying what is in the capture, for telling queue entries apart at a glance.
function summary(cap) {
  if (Array.isArray(cap.vehicles) && cap.vehicles.length === 0) return "No Vehicles Detected";
  return describeVehicles(cap);
}

// The first picture of a capture, as a full address.
function thumbnailUrl(cap) {
  const first = Array.isArray(cap.images) && cap.images.length > 0 ? cap.images[0] : null;
  const url = (first && typeof first === "object" ? first.url : first) || cap.imageUrl || null;
  if (!url) return null;
  return url.startsWith("/") ? `${API}${url}` : url;
}

// Why a capture is flagged, in plain words. Empty when it is not flagged.
function flagReasons(cap, threshold) {
  const reasons = [];
  const weakest = weakestConfidence(cap);
  if (weakest === null) reasons.push("No Scores");
  else if (weakest < threshold) reasons.push("Low Confidence");
  if (getVehicles(cap).some(hasUnknownAttribute)) reasons.push("Unknown Attribute");
  return reasons;
}

function QueueList({ captures, selectedId, onSelect, threshold }) {
  return (
    // The list scrolls on its own, so a long queue does not push the whole page down.
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        maxHeight: "calc(100vh - 340px)",
        minHeight: "240px",
        overflowY: "auto",
        paddingRight: "4px",
      }}
    >
      {captures.map((cap) => {
        const flagged = isFlagged(cap, threshold);
        const reasons = flagged ? flagReasons(cap, threshold) : [];
        const conditions = cap.conditions || [];
        const selected = cap.id === selectedId;
        const thumb = thumbnailUrl(cap);

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
              gap: "10px",
              alignItems: "flex-start",
            }}
          >
            {thumb && (
              <img
                src={thumb}
                alt=""
                style={{ width: "48px", height: "36px", objectFit: "cover", borderRadius: "3px", flexShrink: 0, background: "#101418" }}
              />
            )}

            <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <span style={{ fontWeight: 600, fontSize: "14px", minWidth: 0, overflowWrap: "anywhere" }}>{cap.camera}</span>
                {flagged && (
                  <span style={{ fontSize: "11px", background: "#E1261C", padding: "2px 6px", borderRadius: "3px", fontWeight: "bold", flexShrink: 0 }}>
                    REVIEW
                  </span>
                )}
              </div>

              {/* What is in the picture is the part that tells entries apart, so it comes first. */}
              <div
                style={{
                  fontSize: "13px",
                  color: "white",
                  overflowWrap: "anywhere",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {summary(cap)}
              </div>

              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)", overflowWrap: "anywhere" }}>
                {cap.time} &middot; {cap.id}
              </div>

              {reasons.length > 0 && (
                <div style={{ fontSize: "12px", color: "#FFD1CE" }}>{reasons.join(" · ")}</div>
              )}

              {conditions.length > 0 && (
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {conditions.map((tag) => (
                    <span
                      key={tag}
                      style={{ fontSize: "11px", color: "#CDD3D6", border: "1px solid #495054", borderRadius: "3px", padding: "1px 5px" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default QueueList;