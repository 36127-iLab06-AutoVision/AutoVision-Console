function Loader({ percent }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div style={{ position: "relative", width: "120px", height: "120px" }}>
      <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
        {/* Background track (the full grey circle) */}
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#EBEBEB" strokeWidth="10" />
        {/* Progress ring, drawn on top */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#146CFD"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          fontWeight: 700,
          color: "#002664",
        }}
      >
        {percent}%
      </div>
    </div>
  );
}

export default Loader;