// Storage. One small SQLite file keeps captures and the audit log between restarts.
// Each capture is stored as one JSON document, so its shape stays exactly what the
// interface already expects.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export function openStore(file) {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS captures (
      seq       INTEGER PRIMARY KEY AUTOINCREMENT,
      id        TEXT NOT NULL UNIQUE,
      source    TEXT NOT NULL,                 -- seed | ingest | upload
      corrected INTEGER NOT NULL DEFAULT 0,    -- 1 once a person has corrected it
      doc       TEXT NOT NULL                  -- the capture as JSON
    );
    CREATE TABLE IF NOT EXISTS audit (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT NOT NULL,
      text TEXT NOT NULL
    );
  `);

  const q = {
    all: db.prepare(`
      SELECT doc FROM captures
      ORDER BY CASE source WHEN 'upload' THEN 0 WHEN 'ingest' THEN 1 ELSE 2 END,
               CASE WHEN source = 'upload' THEN -seq ELSE seq END`),
    one: db.prepare("SELECT doc, source, corrected FROM captures WHERE id = ?"),
    insert: db.prepare("INSERT INTO captures (id, source, doc) VALUES (?, ?, ?)"),
    saveCorrected: db.prepare("UPDATE captures SET doc = ?, corrected = 1 WHERE id = ?"),
    replaceDoc: db.prepare("UPDATE captures SET doc = ? WHERE id = ?"),
    ingestRows: db.prepare("SELECT id, corrected FROM captures WHERE source = 'ingest'"),
    remove: db.prepare("DELETE FROM captures WHERE id = ?"),
    removeSeeds: db.prepare("DELETE FROM captures WHERE source = 'seed'"),
    addAudit: db.prepare("INSERT INTO audit (time, text) VALUES (?, ?)"),
    audit: db.prepare("SELECT time, text FROM audit ORDER BY id DESC LIMIT ?"),
    count: db.prepare("SELECT COUNT(*) AS n FROM captures"),
    countSource: db.prepare("SELECT COUNT(*) AS n FROM captures WHERE source = ?"),
  };

  return {
    listCaptures: () => q.all.all().map((r) => JSON.parse(r.doc)),
    getCapture(id) {
      const r = q.one.get(id);
      return r ? { doc: JSON.parse(r.doc), source: r.source, corrected: r.corrected === 1 } : null;
    },
    hasCapture: (id) => q.one.get(id) !== undefined,
    insertCapture: (doc, source) => q.insert.run(doc.id, source, JSON.stringify(doc)),
    saveCorrection: (id, doc) => q.saveCorrected.run(JSON.stringify(doc), id),

    // Demo captures: added once, never overwritten.
    seedIfMissing(list) {
      for (const doc of list) if (!q.one.get(doc.id)) q.insert.run(doc.id, "seed", JSON.stringify(doc));
    },

    // Remove the built-in demo captures (used when demo data is switched off).
    removeSeeded: () => q.removeSeeds.run().changes,

    // Bring the stored ingested captures in line with captures.json.
    // New ones are added. Ones nobody has corrected are refreshed, or removed if they are gone
    // from the file. Ones a person has corrected are never touched.
    syncIngested(list) {
      const incoming = new Map(list.map((d) => [d.id, d]));
      for (const row of q.ingestRows.all()) {
        if (row.corrected === 1) continue;
        if (incoming.has(row.id)) q.replaceDoc.run(JSON.stringify(incoming.get(row.id)), row.id);
        else q.remove.run(row.id);
      }
      for (const doc of list) if (!q.one.get(doc.id)) q.insert.run(doc.id, "ingest", JSON.stringify(doc));
    },

    addAudit: (time, text) => q.addAudit.run(time, text),
    listAudit: (limit = 200) => q.audit.all(limit),
    counts: () => ({ total: q.count.get().n, ingested: q.countSource.get("ingest").n }),
    close: () => db.close(),
  };
}
