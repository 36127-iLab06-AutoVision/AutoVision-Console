function ConfidenceBar({ value }) {
  const color = value >= 0.8 ? "green" : value >= 0.6 ? "orange" : "red";

  return (
    <div style={{ background: "#333", width: "200px", height: "10px", borderRadius: "5px" }}>
      <div
        style={{
          background: color,
          width: `${value * 100}%`,
          height: "100%",
          borderRadius: "5px",
          transition: "width 0.6s ease, background 0.6s ease",
        }}
      />
    </div>
  );
}

export default ConfidenceBar;