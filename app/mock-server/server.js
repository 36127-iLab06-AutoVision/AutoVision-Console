import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

let captures = [
  {
    id: "c1", camera: "Toll Gantry 4B", time: "14:02:11", conditions: ["Oblique angle"],
    make: "Toyota", model: "Camry", color: "Steel Blue", images: [null, null], bodyType: "Sedan",
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
  {
    id: "c5", camera: "Test (ML sample, 2 vehicles)", time: "14:05:00", conditions: [], images: [],
    vehicles: [
      { id: 1, make: "Toyota", model: "Camry", color: null, bodyType: null,
        makeConf: 0.91, modelConf: 0.91, colorConf: null, bodyTypeConf: null,
        box: { x: 9.38, y: 11.11, w: 40.62, h: 54.17 }, features: [], damage: [] },
      { id: 2, make: "BMW", model: "X5", color: null, bodyType: null,
        makeConf: 0.87, modelConf: 0.87, colorConf: null, bodyTypeConf: null,
        box: { x: 55.47, y: 13.89, w: 30.47, h: 45.83 }, features: [], damage: [] },
    ],
  },
];

// The server now owns the audit log, not the browser.
let auditLog = [];

app.get("/api/captures", (req, res) => {
  res.json(captures);
});

app.get("/api/audit", (req, res) => {
  res.json(auditLog);
});

app.patch("/api/captures/:id", (req, res) => {
  const { id } = req.params;
  const { field, value, vehicleId } = req.body;

  const target = captures.find((c) => c.id === id);
  if (!target) {
    return res.status(404).json({ error: "Capture not found" });
  }

  let oldValue;
  let where = target.camera;

  if (vehicleId !== undefined && Array.isArray(target.vehicles)) {
    const vehicle = target.vehicles.find((v) => v.id === vehicleId);
    if (!vehicle) {
      return res.status(404).json({ error: "Vehicle not found" });
    }
    oldValue = vehicle[field] ?? "not set";
    where = `${target.camera}, vehicle ${vehicleId}`;
    captures = captures.map((c) =>
      c.id === id
        ? { ...c, vehicles: c.vehicles.map((v) => (v.id === vehicleId ? { ...v, [field]: value } : v)) }
        : c
    );
  } else {
    oldValue = target[field] ?? "not set";
    captures = captures.map((c) => (c.id === id ? { ...c, [field]: value } : c));
  }

  auditLog = [
    {
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      text: `${field} changed from "${oldValue}" to "${value}" on ${where}`,
    },
    ...auditLog,
  ];

  res.json({ success: true, auditLog });
});

app.post("/api/captures", (req, res) => {
  const newCapture = req.body;
  captures = [newCapture, ...captures];
  res.json(newCapture);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Mock API server running at http://localhost:${PORT}`);
});