import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

// The repo root is two folders above app/mock-server.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DATA_DIR = path.join(ROOT, "data");

const dbFile = process.env.DB_FILE || path.join(DATA_DIR, "app.db");

const { app, store } = createApp({
  dbFile,
  processedDir: path.join(DATA_DIR, "processed"),
  uploadsDir: process.env.UPLOADS_DIR || path.join(DATA_DIR, "uploads"),
  corsOrigin: process.env.CORS_ORIGIN, // when published: the web address of the interface
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  const { total, ingested } = store.counts();
  console.log(`Mock API server running at http://localhost:${PORT}`);
  console.log(`Database: ${dbFile}`);
  console.log(`Loaded ${total} captures (${ingested} ingested)`);
});