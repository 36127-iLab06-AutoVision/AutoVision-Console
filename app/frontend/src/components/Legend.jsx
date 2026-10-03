function Legend({ boxes, hoveredLabel, onHover }) {
  // Boxes can repeat labels (e.g. two "Damage" boxes) — this keeps only
  // the first occurrence of each label, so the legend doesn't show duplicates.
  const seen = new Set();
  const uniqueItems = boxes.filter((b) => {
    if (seen.has(b.label)) return false;
    seen.add(b.label);
    return true;
  });

  return (
    <div style={{ display: "flex", gap: "16px", marginTop: "10px", fontSize: "12px" }}>
      {uniqueItems.map((item) => (
        <div
          key={item.label}
          onMouseEnter={() => onHover(item.label)}
          onMouseLeave={() => onHover(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            cursor: "pointer",
            opacity: hoveredLabel && hoveredLabel !== item.label ? 0.4 : 1,
            transition: "opacity 0.15s ease",
          }}
        >
          <span style={{ width: "10px", height: "10px", borderRadius: "2px", background: item.color, display: "inline-block" }} />
          {item.label}
        </div>
      ))}
    </div>
  );
}

export default Legend;