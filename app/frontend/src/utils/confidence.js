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

// True when the model gave no answer for at least one of these four attributes.
// The model leaves an attribute out ("unknown") when it is not sure enough, so a missing
// answer is a reason for a person to look, not something to ignore.
export function hasUnknownAttribute(vehicle) {
  return [vehicle.make, vehicle.model, vehicle.color, vehicle.bodyType].some(
    (value) => value === null || value === undefined || value === ""
  );
}

// A capture is flagged when its weakest score is under the threshold, when it has no
// scores at all (nothing can be trusted yet), or when any vehicle has an unknown attribute.
export function isFlagged(capture, threshold) {
  const weakest = weakestConfidence(capture);
  if (weakest === null || weakest < threshold) return true;
  return getVehicles(capture).some(hasUnknownAttribute);
}

// "Toyota Camry, BMW X5" for display and search.
export function describeVehicles(capture) {
  return getVehicles(capture)
    .map((v) => [v.make, v.model].filter(Boolean).join(" ") || "Unknown vehicle")
    .join(", ");
}