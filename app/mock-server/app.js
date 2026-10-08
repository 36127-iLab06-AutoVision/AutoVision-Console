// The API. createApp() builds it from settings, so tests can run it on a temporary
// database, and server.js runs it for real.
import express from "express";
import cors from "cors";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateCapture, validateCorrection } from "./validate.js";
import { openStore } from "./db.js";
import { seedCaptures } from "./seed.js";

// Captures built by the ingest step. Each one is checked with the same rules as an upload,
// so bad data is skipped here with a clear message instead of breaking the interface later.
function loadIngested(processedDir, log) {
  const file = path.join(processedDir, "captures.json");
  if (!fs.existsSync(file)) return [];
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (err) {
    log.error("Could not read captures.json:", err.message);
    return [];
  }
  if (!Array.isArray(raw)) {
    log.error("captures.json should contain a list of captures, so it was ignored");
    return [];
  }
  const good = [];
  const seen = new Set();
  for (const item of raw) {
    const { errors, capture } = validateCapture(item);
    if (errors.length > 0) {
      log.warn(`Skipped ingested capture "${item?.id ?? "unknown"}": ${errors.join("; ")}`);
    } else if (seen.has(capture.id)) {
      log.warn(`Skipped ingested capture "${capture.id}": id appears twice in captures.json`);
    } else {
      seen.add(capture.id);
      good.push(capture);
    }
  }
  return good;
}

// An uploaded image arrives as a data URL. Check it really is a PNG or JPEG, save it as a
// file, and return the short link to it. Returns { error } if it is not acceptable.
function saveUploadedImage(dataUrl, uploadsDir) {
  const marker = ";base64,";
  const cut = dataUrl.indexOf(marker);
  const type = cut === -1 ? "" : dataUrl.slice(5, cut);
  const ext = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : null;
  if (!ext) return { error: "imageUrl must be a PNG or JPEG image" };

  const bytes = Buffer.from(dataUrl.slice(cut + marker.length), "base64");
  const isPng = bytes.length > 8 && bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const isJpeg = bytes.length > 3 && bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if ((ext === "png" && !isPng) || (ext === "jpg" && !isJpeg)) {
    return { error: "imageUrl is not a valid image file" };
  }

  fs.mkdirSync(uploadsDir, { recursive: true });
  const name = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(uploadsDir, name), bytes);
  return { url: `/uploads/${name}` };
}

export function createApp({ dbFile, processedDir, uploadsDir, corsOrigin, log = console }) {
  const store = openStore(dbFile);
  store.seedIfMissing(seedCaptures);
  store.syncIngested(loadIngested(processedDir, log));

  const app = express();
  app.use(cors(corsOrigin ? { origin: corsOrigin.split(",").map((s) => s.trim()) } : undefined));
  app.use(express.json({ limit: "10mb" }));

  // Images from the ingest step, and images people have uploaded.
  app.use("/images", express.static(path.join(processedDir, "images")));
  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/captures", (req, res) => {
    res.json(store.listCaptures());
  });

  app.get("/api/audit", (req, res) => {
    res.json(store.listAudit());
  });

  app.patch("/api/captures/:id", (req, res) => {
    const { errors, correction } = validateCorrection(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: "Invalid correction", errors });
    }
    const { field, value, vehicleId } = correction;
    const { id } = req.params;

    const found = store.getCapture(id);
    if (!found) {
      return res.status(404).json({ error: "Capture not found" });
    }
    const target = found.doc;

    const isMulti = Array.isArray(target.vehicles) && target.vehicles.length > 0;
    if (isMulti && vehicleId === undefined) {
      return res.status(400).json({ error: "This capture has several vehicles, so vehicleId is required" });
    }
    if (!isMulti && vehicleId !== undefined) {
      return res.status(400).json({ error: "This capture has no vehicles list, so vehicleId is not allowed" });
    }

    let oldValue;
    let where = target.camera;
    let updated;

    if (isMulti) {
      const vehicle = target.vehicles.find((v) => v.id === vehicleId);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      oldValue = vehicle[field] ?? "not set";
      where = `${target.camera}, vehicle ${vehicleId}`;
      updated = { ...target, vehicles: target.vehicles.map((v) => (v.id === vehicleId ? { ...v, [field]: value } : v)) };
    } else {
      oldValue = target[field] ?? "not set";
      updated = { ...target, [field]: value };
    }

    store.saveCorrection(id, updated);
    store.addAudit(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      `${field} changed from "${oldValue}" to "${value}" on ${where}`
    );

    res.json({ success: true, auditLog: store.listAudit() });
  });

  app.post("/api/captures", (req, res) => {
    const { errors, capture } = validateCapture(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: "Invalid capture", errors });
    }
    if (store.hasCapture(capture.id)) {
      return res.status(409).json({ error: `A capture with id "${capture.id}" already exists` });
    }
    if (typeof capture.imageUrl === "string" && capture.imageUrl.startsWith("data:")) {
      const saved = saveUploadedImage(capture.imageUrl, uploadsDir);
      if (saved.error) {
        return res.status(400).json({ error: "Invalid capture", errors: [saved.error] });
      }
      capture.imageUrl = saved.url;
    }
    store.insertCapture(capture, "upload");
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
    log.error(err);
    res.status(500).json({ error: "Server error" });
  });

  return { app, store };
}