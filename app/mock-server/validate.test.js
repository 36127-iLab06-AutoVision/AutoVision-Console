import test from "node:test";
import assert from "node:assert/strict";
import { validateCapture, validateCorrection } from "./validate.js";

const goodVehicle = {
  id: 1, make: "Toyota", model: "Camry", color: null, bodyType: null,
  makeConf: 0.91, modelConf: 0.91, colorConf: null, bodyTypeConf: null,
  box: { x: 9.38, y: 11.11, w: 40.62, h: 54.17 },
};
const goodCapture = { id: "img_001", camera: "Toll Gantry 4B", time: "14:02:11", vehicles: [goodVehicle] };

test("a good multi-vehicle capture passes and gets default lists", () => {
  const { errors, capture } = validateCapture(goodCapture);
  assert.deepEqual(errors, []);
  assert.deepEqual(capture.conditions, []);
  assert.deepEqual(capture.vehicles[0].features, []);
  assert.deepEqual(capture.vehicles[0].damage, []);
});

test("an upload-style single capture passes and keeps imageUrl without adding images", () => {
  const upload = {
    id: "upload-1", camera: "Manual upload", time: "10:30", conditions: [],
    make: "Toyota", model: "Corolla", color: "White", bodyType: "Hatchback",
    makeConf: 0.88, modelConf: 0.71, colorConf: 0.95, bodyTypeConf: 0.83,
    imageUrl: "data:image/png;base64,AAAA",
    boxes: [{ label: "Vehicle", color: "#146CFD", x: 15, y: 20, w: 65, h: 50 }], damage: [], features: [],
  };
  const { errors, capture } = validateCapture(upload);
  assert.deepEqual(errors, []);
  assert.equal("images" in capture, false);
});

test("missing conditions is filled in, not rejected", () => {
  const { errors, capture } = validateCapture({ id: "x", camera: "c", time: "t", make: "Ford" });
  assert.deepEqual(errors, []);
  assert.deepEqual(capture.conditions, []);
  assert.deepEqual(capture.boxes, []);
});

test("confidence given as a percentage is rejected", () => {
  const { errors } = validateCapture({ ...goodCapture, vehicles: [{ ...goodVehicle, makeConf: 91 }] });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /vehicles\[0\]\.makeConf.*0 to 1/);
});

test("a box outside the image is rejected", () => {
  const { errors } = validateCapture({ ...goodCapture, vehicles: [{ ...goodVehicle, box: { x: 80, y: 10, w: 40, h: 20 } }] });
  assert.match(errors.join(" "), /extends outside the image/);
});

test("pixel-style boxes are rejected", () => {
  const { errors } = validateCapture({ ...goodCapture, vehicles: [{ ...goodVehicle, box: { x: 120, y: 80, w: 520, h: 390 } }] });
  assert.ok(errors.length > 0);
});

test("duplicate vehicle ids are rejected", () => {
  const { errors } = validateCapture({ ...goodCapture, vehicles: [goodVehicle, goodVehicle] });
  assert.match(errors.join(" "), /used twice/);
});

test("all problems are reported together", () => {
  const { errors } = validateCapture({ id: "", camera: 5, vehicles: "no" });
  assert.ok(errors.length >= 4);
});

test("a non-object is rejected", () => {
  assert.equal(validateCapture(null).errors.length, 1);
  assert.equal(validateCapture([]).errors.length, 1);
});

test("a good correction passes and trims the value", () => {
  const { errors, correction } = validateCorrection({ field: "make", value: " Ford ", vehicleId: 2 });
  assert.deepEqual(errors, []);
  assert.deepEqual(correction, { field: "make", value: "Ford", vehicleId: 2 });
});

test("corrections to other fields are rejected", () => {
  for (const field of ["id", "makeConf", "__proto__", "vehicles"]) {
    assert.ok(validateCorrection({ field, value: "x" }).errors.length > 0, field);
  }
});

test("empty or oversized values are rejected", () => {
  assert.ok(validateCorrection({ field: "make", value: "  " }).errors.length > 0);
  assert.ok(validateCorrection({ field: "make", value: "x".repeat(61) }).errors.length > 0);
  assert.ok(validateCorrection({ field: "make", value: 5 }).errors.length > 0);
});