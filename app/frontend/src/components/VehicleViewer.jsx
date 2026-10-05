import { useState } from "react";

function VehicleViewer({ images, boxes, highlightLabel, showBoxes }) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Accept old shapes too: null entries or plain URL strings become { url, confidence }
  const imageList =
    images && images.length > 0
      ? images.map((img) =>
          img && typeof img === "object" ? img : { url: img ?? null, confidence: null }
        )
      : [{ url: null, confidence: null }];

  const current = imageList[activeIndex] || { url: null, confidence: null };
  const boxList = boxes || [];

  const confColor = (c) => (c >= 0.8 ? "#00AA45" : c >= 0.6 ? "#B8860B" : "#E1261C");

  return (
    <div>
      <div
        style={{
          position: "relative",
          width: "100%",
          // A real picture sets its own height, so boxes match it exactly.
          // The placeholder drawing needs a fixed shape.
          aspectRatio: current.url ? "auto" : "16 / 10",
          borderRadius: "4px",
          overflow: "hidden",
          background: "#101418",
          border: "1px solid #CDD3D6",
        }}
      >
        {current.url ? (
          <img src={current.url} alt="Capture" style={{ width: "100%", height: "auto", display: "block" }} />
        ) : (
          <svg viewBox="0 0 400 250" style={{ width: "100%", height: "100%" }}>
            <rect x="0" y="0" width="400" height="250" fill="#101418" />
            <rect x="0" y="196" width="400" height="54" fill="#1B2026" />
            <rect x="60" y="105" width="280" height="80" rx="14" fill="#5B7A9D" />
            <rect x="105" y="65" width="160" height="55" rx="14" fill="#5B7A9D" opacity="0.9" />
            <circle cx="115" cy="185" r="24" fill="#0A0D10" stroke="#333" strokeWidth="5" />
            <circle cx="285" cy="185" r="24" fill="#0A0D10" stroke="#333" strokeWidth="5" />
          </svg>
        )}

        {current.confidence != null && (
          <div
            style={{
              position: "absolute", top: "10px", right: "10px",
              background: confColor(current.confidence), color: "white",
              fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "20px",
            }}
          >
            {Math.round(current.confidence * 100)}%
          </div>
        )}

        {showBoxes &&
          boxList.map((box, i) => {
            const isHighlighted = highlightLabel === box.label;
            const isDimmed = highlightLabel && !isHighlighted;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`,
                  border: `${isHighlighted ? 4 : 2}px solid ${box.color}`,
                  opacity: isDimmed ? 0.3 : 1,
                  boxShadow: isHighlighted ? `0 0 12px ${box.color}` : "none",
                  transition: "border-width 0.15s ease, opacity 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                <span style={{ color: box.color, fontSize: "11px" }}>{box.label}</span>
              </div>
            );
          })}
      </div>

      {imageList.length > 1 && (
        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          {imageList.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              style={{
                position: "relative", width: "64px", height: "44px", borderRadius: "6px", overflow: "hidden", padding: 0,
                border: i === activeIndex ? "2px solid #146CFD" : "2px solid transparent",
                cursor: "pointer", background: "#101418",
              }}
            >
              {img.url && <img src={img.url} alt={`Angle ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              {img.confidence != null && (
                <span
                  style={{
                    position: "absolute", bottom: "2px", right: "2px",
                    background: confColor(img.confidence), color: "white",
                    fontSize: "8px", fontWeight: 700, padding: "1px 4px", borderRadius: "8px",
                  }}
                >
                  {Math.round(img.confidence * 100)}%
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default VehicleViewer;