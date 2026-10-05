function Toast({ message, isError }) {
  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        background: isError ? "#E1261C" : "#22272B",
        color: "white",
        padding: "16px 28px",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: 600,
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        zIndex: 2000,
        animation: "popIn 0.3s ease",
        maxWidth: "min(90vw, 480px)",
        textAlign: "center",
      }}
    >
      {isError ? "! " : "\u2713 "}
      {message}
    </div>
  );
}

export default Toast;