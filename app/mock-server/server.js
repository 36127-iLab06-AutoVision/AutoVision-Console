import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateCapture, validateCorrection } from "./validate.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// The repo root is two folders above app/mock-server.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");

// Serves the images copied there by the ingest step.
app.use("/images", express.static(path.join(PROCESSED_DIR, "images")));

// Captures built by the ingest step. Returns an empty list if there are none yet.
function loadIngested() {
  const file = path.join(PROCESSED_DIR, "captures.json");
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    console.error("Could not read captures.json:", err.message);
    return [];
  }
}

const seedCaptures = [
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

// Ingested captures first, then the built-in demo captures.
let captures = [...loadIngested(), ...seedCaptures];
let auditLog = [];

app.get("/api/captures", (req, res) => {
  res.json(captures);
});

app.get("/api/audit", (req, res) => {
  res.json(auditLog);
});

app.patch("/api/captures/:id", (req, res) => {
  const { errors, correction } = validateCorrection(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: "Invalid correction", errors });
  }
  const { field, value, vehicleId } = correction;
  const { id } = req.params;

  const target = captures.find((c) => c.id === id);
  if (!target) {
    return res.status(404).json({ error: "Capture not found" });
  }

  const isMulti = Array.isArray(target.vehicles) && target.vehicles.length > 0;
  if (isMulti && vehicleId === undefined) {
    return res.status(400).json({ error: "This capture has several vehicles, so vehicleId is required" });
  }
  if (!isMulti && vehicleId !== undefined) {
    return res.status(400).json({ error: "This capture has no vehicles list, so vehicleId is not allowed" });
  }

  let oldValue;
  let where = target.camera;

  if (isMulti) {
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
  const { errors, capture } = validateCapture(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: "Invalid capture", errors });
  }
  if (captures.some((c) => c.id === capture.id)) {
    return res.status(409).json({ error: `A capture with id "${capture.id}" already exists` });
  }
  captures = [capture, ...captures];
  res.status(201).json(capture);
});

// Turns body-parsing problems into JSON instead of an HTML error page.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body is not valid JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "Request is too large (limit 10 MB)" });
  }
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Mock API server running at http://localhost:${PORT}`);
  console.log(`Loaded ${captures.length} captures (${captures.length - seedCaptures.length} ingested)`);
});