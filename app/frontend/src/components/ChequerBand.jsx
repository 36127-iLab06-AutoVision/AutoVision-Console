function ChequerBand({ height = 6 }) {
  return (
    <div
      style={{
        height,
        backgroundImage: "repeating-conic-gradient(#111 0% 25%, #fff 0% 50%)",
        backgroundSize: `${height}px ${height}px`,
      }}
    />
  );
}

export default ChequerBand;