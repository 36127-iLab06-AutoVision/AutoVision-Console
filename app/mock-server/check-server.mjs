// Sends requests that the server should REJECT, and checks it does.
// Nothing here changes the server's data. Run while the server is running:
//
//     node check-server.mjs

const base = process.env.API || "http://localhost:4000";
let failures = 0;

async function expectStatus(label, expected, method, path, body, raw) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: raw ?? JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  const ok = res.status === expected;
  if (!ok) failures += 1;
  const detail = data.errors?.[0] || data.error || "";
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${res.status}, wanted ${expected}  ${detail}`);
}

const captures = await (await fetch(base + "/api/captures")).json();
const multi = captures.find((c) => Array.isArray(c.vehicles) && c.vehicles.length > 0);
const single = captures.find((c) => !(Array.isArray(c.vehicles) && c.vehicles.length > 0));

await expectStatus("bad capture (confidence as %, pixel box)", 400, "POST", "/api/captures",
  { id: "bad", camera: "c", time: "t", vehicles: [{ id: 1, makeConf: 91, box: { x: 120, y: 80, w: 520, h: 390 } }] });
await expectStatus("body is not JSON", 400, "POST", "/api/captures", null, "{ nope");
await expectStatus("body over 10 MB", 413, "POST", "/api/captures",
  { id: "big", camera: "c", time: "t", pad: "x".repeat(11 * 1024 * 1024) });
if (single) {
  await expectStatus("duplicate id", 409, "POST", "/api/captures", { id: single.id, camera: "c", time: "t" });
  await expectStatus("vehicleId on a single-vehicle capture", 400, "PATCH", `/api/captures/${single.id}`,
    { field: "make", value: "Ford", vehicleId: 1 });
}
if (multi) {
  await expectStatus("multi-vehicle capture without vehicleId", 400, "PATCH", `/api/captures/${multi.id}`,
    { field: "make", value: "Ford" });
}
await expectStatus("correcting a field that is not allowed", 400, "PATCH", "/api/captures/c1",
  { field: "id", value: "hacked" });
await expectStatus("unknown capture", 404, "PATCH", "/api/captures/does-not-exist",
  { field: "make", value: "Ford" });

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);