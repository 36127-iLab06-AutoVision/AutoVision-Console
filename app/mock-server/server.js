import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

// The repo root is two folders above app/mock-server.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = path.join(ROOT, "data");

const dbFile = process.env.DB_FILE || path.join(DATA_DIR, "app.db");

const { app, store } = createApp({
  dbFile,
  // Where captures.json and its images are read from. Published version: the committed demo-data folder.
  processedDir: process.env.PROCESSED_DIR || path.join(DATA_DIR, "processed"),
  uploadsDir: process.env.UPLOADS_DIR || path.join(DATA_DIR, "uploads"),
  corsOrigin: process.env.CORS_ORIGIN, // when published: the web address of the interface
  // Where the detection service runs, e.g. http://localhost:8000. Leave unset and "Run detection" says no model is connected.
  analyzeUrl: process.env.ANALYZE_URL,
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  const { total, ingested } = store.counts();
  console.log(`Mock API server running at http://localhost:${PORT}`);
  console.log(`Database: ${dbFile}`);
  console.log(`Loaded ${total} captures (${ingested} ingested)`);
  console.log(process.env.ANALYZE_URL ? `Detection service: ${process.env.ANALYZE_URL}` : "Detection service: not connected (Run detection is off)");
});