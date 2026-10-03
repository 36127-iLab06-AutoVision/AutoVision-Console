function FeatureList({ items }) {
  return (
    <div>
      {items.map((item) => {
        const tone = item.confidence >= 0.8 ? "#00AA45" : item.confidence >= 0.6 ? "#B8860B" : "#E1261C";

        return (
          <div
            key={item.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: "1px solid #EBEBEB",
            }}
          >
            <span style={{ fontSize: "13px" }}>{item.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: item.present ? "#00AA45" : "#495054" }}>
                {item.present ? "PRESENT" : "NOT DETECTED"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <div style={{ width: "80px", height: "5px", background: "#EBEBEB", borderRadius: "2px", overflow: "hidden" }}>
                  <div style={{ width: `${item.confidence * 100}%`, height: "100%", background: tone }} />
                </div>
                <span style={{ fontSize: "11px", color: "#495054", width: "30px" }}>{Math.round(item.confidence * 100)}%</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default FeatureList;