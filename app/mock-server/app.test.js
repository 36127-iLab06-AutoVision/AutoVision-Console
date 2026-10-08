import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createApp } from "./app.js";

const quiet = { warn() {}, error() {}, log() {} };
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// A fresh temporary folder with the same layout the real project uses.
function workspace() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vmi-"));
  const processedDir = path.join(dir, "processed");
  fs.mkdirSync(processedDir);
  return {
    dir,
    processedDir,
    dbFile: path.join(dir, "app.db"),
    uploadsDir: path.join(dir, "uploads"),
    writeIngested: (list) => fs.writeFileSync(path.join(processedDir, "captures.json"), JSON.stringify(list)),
  };
}

// Starts the API on a free port. Call stop() to simulate shutting the server down.
async function start(ws) {
  const { app, store } = createApp({ dbFile: ws.dbFile, processedDir: ws.processedDir, uploadsDir: ws.uploadsDir, log: quiet });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const url = `http://localhost:${server.address().port}`;
  const call = async (method, p, body) => {
    const res = await fetch(url + p, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data, res };
  };
  const stop = () => new Promise((resolve) => server.close(() => { store.close(); resolve(); }));
  return { url, call, stop, store };
}

const vehicle = (id, make) => ({ id, make, model: "Camry", makeConf: 0.9, modelConf: 0.9, box: { x: 10, y: 10, w: 30, h: 30 } });
const ingested = (id, make) => ({ id, camera: "Imported file", time: "t", conditions: [], vehicles: [vehicle(1, make)] });

test("a fresh database starts with the three demo captures", async () => {
  const ws = workspace();
  const s = await start(ws);
  const { data } = await s.call("GET", "/api/captures");
  assert.deepEqual(data.map((c) => c.id), ["c1", "c2", "c3"]);
  await s.stop();
});

test("a correction and its audit entry survive a restart", async () => {
  const ws = workspace();
  let s = await start(ws);
  const r = await s.call("PATCH", "/api/captures/c2", { field: "make", value: "Toyota" });
  assert.equal(r.status, 200);
  await s.stop();

  s = await start(ws);
  const { data } = await s.call("GET", "/api/captures");
  assert.equal(data.find((c) => c.id === "c2").make, "Toyota");
  const audit = (await s.call("GET", "/api/audit")).data;
  assert.equal(audit.length, 1);
  assert.match(audit[0].text, /make changed from "Ford" to "Toyota" on Checkpoint North/);
  await s.stop();
});

test("a multi-vehicle correction needs vehicleId and is saved for that vehicle only", async () => {
  const ws = workspace();
  ws.writeIngested([{ ...ingested("img_1", "Kia"), vehicles: [vehicle(1, "Kia"), vehicle(2, "BMW")] }]);
  const s = await start(ws);
  assert.equal((await s.call("PATCH", "/api/captures/img_1", { field: "make", value: "Ford" })).status, 400);
  assert.equal((await s.call("PATCH", "/api/captures/img_1", { field: "make", value: "Ford", vehicleId: 9 })).status, 404);
  assert.equal((await s.call("PATCH", "/api/captures/img_1", { field: "make", value: "Ford", vehicleId: 2 })).status, 200);
  const c = (await s.call("GET", "/api/captures")).data.find((x) => x.id === "img_1");
  assert.deepEqual(c.vehicles.map((v) => v.make), ["Kia", "Ford"]);
  await s.stop();
});

test("an uploaded capture survives a restart and stays at the top", async () => {
  const ws = workspace();
  let s = await start(ws);
  const up = { id: "upload-1", camera: "Manual upload", time: "10:30", make: "Kia", model: "Rio" };
  assert.equal((await s.call("POST", "/api/captures", up)).status, 201);
  assert.equal((await s.call("POST", "/api/captures", { ...up, id: "upload-2" })).status, 201);
  await s.stop();

  s = await start(ws);
  const ids = (await s.call("GET", "/api/captures")).data.map((c) => c.id);
  assert.deepEqual(ids, ["upload-2", "upload-1", "c1", "c2", "c3"]);
  await s.stop();
});

test("an uploaded image is saved as a file and served from /uploads", async () => {
  const ws = workspace();
  const s = await start(ws);
  const r = await s.call("POST", "/api/captures", { id: "u1", camera: "Manual upload", time: "t", imageUrl: TINY_PNG });
  assert.equal(r.status, 201);
  assert.match(r.data.imageUrl, /^\/uploads\/[0-9a-f-]+\.png$/);
  assert.equal(fs.readdirSync(ws.uploadsDir).length, 1);

  const img = await fetch(s.url + r.data.imageUrl);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/png");

  // The database holds the short link, not the image itself.
  const stored = s.store.getCapture("u1").doc;
  assert.equal(stored.imageUrl, r.data.imageUrl);
  await s.stop();
});

test("uploads that are not real PNG or JPEG images are rejected and nothing is saved", async () => {
  const ws = workspace();
  const s = await start(ws);
  const post = (imageUrl) => s.call("POST", "/api/captures", { id: "bad", camera: "c", time: "t", imageUrl });
  const html = "data:text/html;base64," + Buffer.from("<script>alert(1)</script>").toString("base64");
  const fakePng = "data:image/png;base64," + Buffer.from("this is not a png at all").toString("base64");
  const noType = "data:;base64,AAAA";
  for (const bad of [html, fakePng, noType]) {
    const r = await post(bad);
    assert.equal(r.status, 400, bad.slice(0, 30));
  }
  assert.equal(fs.existsSync(ws.uploadsDir) ? fs.readdirSync(ws.uploadsDir).length : 0, 0);
  assert.equal(s.store.hasCapture("bad"), false);
  await s.stop();
});

test("invalid and duplicate uploads are still refused", async () => {
  const ws = workspace();
  const s = await start(ws);
  assert.equal((await s.call("POST", "/api/captures", { id: "x" })).status, 400);
  assert.equal((await s.call("POST", "/api/captures", { id: "c1", camera: "c", time: "t" })).status, 409);
  await s.stop();
});

test("ingested captures are loaded, and bad ones are skipped", async () => {
  const ws = workspace();
  ws.writeIngested([ingested("img_1", "Kia"), { id: "broken", camera: "c", time: "t", vehicles: [{ id: 1, makeConf: 91 }] }]);
  const s = await start(ws);
  const ids = (await s.call("GET", "/api/captures")).data.map((c) => c.id);
  assert.deepEqual(ids, ["img_1", "c1", "c2", "c3"]);
  assert.deepEqual(s.store.counts(), { total: 4, ingested: 1 });
  await s.stop();
});

test("re-ingesting refreshes untouched captures but never overwrites corrected ones", async () => {
  const ws = workspace();
  ws.writeIngested([ingested("a", "Kia"), ingested("b", "Kia"), ingested("gone", "Kia")]);
  let s = await start(ws);
  await s.call("PATCH", "/api/captures/a", { field: "make", value: "Ford", vehicleId: 1 });
  await s.stop();

  // The ML team sends new output: a and b changed, "gone" is no longer there, "new" appears.
  ws.writeIngested([ingested("a", "Honda"), ingested("b", "Honda"), ingested("new", "Honda")]);
  s = await start(ws);
  const byId = Object.fromEntries((await s.call("GET", "/api/captures")).data.map((c) => [c.id, c]));
  assert.equal(byId.a.vehicles[0].make, "Ford");   // corrected by a person, kept
  assert.equal(byId.b.vehicles[0].make, "Honda");  // untouched, refreshed
  assert.equal(byId.new.vehicles[0].make, "Honda");
  assert.equal(byId.gone, undefined);              // untouched and no longer in the file, removed
  await s.stop();
});

test("a corrected capture that disappears from the ingest file is kept", async () => {
  const ws = workspace();
  ws.writeIngested([ingested("a", "Kia")]);
  let s = await start(ws);
  await s.call("PATCH", "/api/captures/a", { field: "make", value: "Ford", vehicleId: 1 });
  await s.stop();
  ws.writeIngested([]);
  s = await start(ws);
  assert.ok((await s.call("GET", "/api/captures")).data.some((c) => c.id === "a"));
  await s.stop();
});

test("damage null and [] are kept apart after saving and reloading", async () => {
  const ws = workspace();
  const withDamage = { ...ingested("d", "Kia"), vehicles: [{ ...vehicle(1, "Kia"), damage: [] }, { ...vehicle(2, "BMW"), damage: null }] };
  ws.writeIngested([withDamage]);
  const s = await start(ws);
  const c = (await s.call("GET", "/api/captures")).data.find((x) => x.id === "d");
  assert.deepEqual(c.vehicles[0].damage, []);
  assert.equal(c.vehicles[1].damage, null);
  await s.stop();
});

test("a broken captures.json does not stop the server", async () => {
  const ws = workspace();
  fs.writeFileSync(path.join(ws.processedDir, "captures.json"), "{oops");
  const s = await start(ws);
  assert.equal((await s.call("GET", "/api/captures")).data.length, 3);
  await s.stop();
});