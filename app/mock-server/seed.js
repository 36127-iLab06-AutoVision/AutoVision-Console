// Built-in demo captures, so the interface is never empty.
export const seedCaptures = [
  {
    id: "c1", camera: "Toll Gantry 4B", time: "14:02:11", conditions: ["Oblique angle"],
    make: "Toyota", model: "Camry", color: "Steel Blue", bodyType: "Sedan",
    images: [{ url: null, confidence: 0.94 }, { url: null, confidence: 0.71 }],
    makeConf: 0.94, modelConf: 0.81, colorConf: 0.97, bodyTypeConf: 0.9,
    features: [
      { label: "Roof rack", present: false, confidence: 0.88 },
      { label: "Tow bar", present: false, confidence: 0.92 },
      { label: "Rear decal", present: true, confidence: 0.71 },
    ],
    boxes: [
      { label: "Vehicle", color: "#146CFD", x: 10, y: 20, w: 70, h: 50 },
      { label: "Damage", color: "#E1261C", x: 55, y: 55, w: 15, h: 12 },
    ],
    damage: [{ part: "Front bumper", severity: "Minor scuff", confidence: 0.64 }],
  },
  {
    id: "c2", camera: "Checkpoint North", time: "14:02:47", conditions: [],
    make: "Ford", model: "Ranger", color: "Red", bodyType: "Ute",
    makeConf: 0.98, modelConf: 0.95, colorConf: 0.99, bodyTypeConf: 0.97,
    features: [
      { label: "Roof rack", present: true, confidence: 0.93 },
      { label: "Tow bar", present: true, confidence: 0.89 },
      { label: "Rear decal", present: false, confidence: 0.6 },
    ],
    boxes: [{ label: "Vehicle", color: "#146CFD", x: 8, y: 22, w: 78, h: 48 }],
    damage: [],
  },
  {
    id: "c3", camera: "Carpark Cam 2", time: "14:03:15", conditions: ["Partial occlusion"],
    make: "Mazda", model: "CX-5", color: "Charcoal", bodyType: "SUV",
    makeConf: 0.72, modelConf: 0.45, colorConf: 0.86, bodyTypeConf: 0.79,
    features: [
      { label: "Roof rack", present: true, confidence: 0.55 },
      { label: "Tow bar", present: false, confidence: 0.7 },
      { label: "Rear decal", present: false, confidence: 0.66 },
    ],
    boxes: [{ label: "Vehicle", color: "#146CFD", x: 20, y: 30, w: 60, h: 40 }],
    damage: [{ part: "Rear quarter panel", severity: "Dent", confidence: 0.58 }],
  },
];