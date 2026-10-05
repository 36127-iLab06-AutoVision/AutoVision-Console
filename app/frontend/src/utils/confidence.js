// Returns the list of vehicles in a capture. Older single-vehicle captures
// carry their attributes at the top level, so the capture itself is the vehicle.
export function getVehicles(capture) {
  if (Array.isArray(capture.vehicles) && capture.vehicles.length > 0) return capture.vehicles;
  return [capture];
}

// Lowest confidence across every vehicle. Missing scores are ignored.
export function weakestConfidence(capture) {
  const scores = getVehicles(capture)
    .flatMap((v) => [v.makeConf, v.modelConf, v.colorConf, v.bodyTypeConf])
    .filter((s) => typeof s === "number");
  return scores.length > 0 ? Math.min(...scores) : null;
}

// A capture with no scores at all is flagged, because nothing can be trusted yet.
export function isFlagged(capture, threshold) {
  const weakest = weakestConfidence(capture);
  return weakest === null || weakest < threshold;
}

// "Toyota Camry, BMW X5" for display and search.
export function describeVehicles(capture) {
  return getVehicles(capture)
    .map((v) => [v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle")
    .join(", ");
}