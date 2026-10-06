// Rules for data coming into the server. Every function returns ALL the
// problems it finds, so a sender can fix them in one go.

const ALLOWED_FIELDS = ["make", "model", "color", "bodyType"];
const CONFIDENCE_FIELDS = ["makeConf", "modelConf", "colorConf", "bodyTypeConf"];

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isText = (v, max = 100) => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const isPercent = (v) => isNumber(v) && v >= 0 && v <= 100;
const isConfidence = (v) => isNumber(v) && v >= 0 && v <= 1;
const isId = (v) => isNumber(v) || isText(v);

function checkBox(box, where, errors) {
  if (!isObject(box)) {
    errors.push(`${where} must be an object with x, y, w and h`);
    return;
  }
  for (const key of ["x", "y", "w", "h"]) {
    if (!isPercent(box[key])) {
      errors.push(`${where}.${key} must be a number from 0 to 100 (percent of the image)`);
    }
  }
  if ([box.x, box.y, box.w, box.h].every(isPercent)) {
    if (box.w <= 0 || box.h <= 0) errors.push(`${where} must have a width and height above 0`);
    if (box.x + box.w > 100.01 || box.y + box.h > 100.01) errors.push(`${where} extends outside the image`);
  }
}

// Checks make/model/colour/body type, their confidences, and the lists.
function checkAttributes(item, where, errors) {
  for (const key of ALLOWED_FIELDS) {
    const v = item[key];
    if (v !== undefined && v !== null && !isText(v, 60)) {
      errors.push(`${where}.${key} must be text up to 60 characters, or null`);
    }
  }
  for (const key of CONFIDENCE_FIELDS) {
    const v = item[key];
    if (v !== undefined && v !== null && !isConfidence(v)) {
      errors.push(`${where}.${key} must be a number from 0 to 1 (not a percentage), or null`);
    }
  }
  // null means "not assessed" (the model did not look). [] means "looked, found none".
  for (const key of ["features", "damage"]) {
    if (item[key] !== undefined && item[key] !== null && !Array.isArray(item[key])) {
      errors.push(`${where}.${key} must be a list, [] if none were found, or null if not assessed`);
    }
  }
}

export function validateCapture(input) {
  const errors = [];
  if (!isObject(input)) return { errors: ["Capture must be a JSON object"], capture: null };

  if (!isText(input.id)) errors.push("id must be non-empty text");
  if (!isText(input.camera)) errors.push("camera must be non-empty text");
  if (!isText(input.time)) errors.push("time must be non-empty text");

  if (input.conditions !== undefined && !(Array.isArray(input.conditions) && input.conditions.every((c) => typeof c === "string"))) {
    errors.push("conditions must be a list of text (use [] when empty)");
  }

  if (input.images !== undefined) {
    if (!Array.isArray(input.images)) {
      errors.push("images must be a list");
    } else {
      input.images.forEach((img, i) => {
        if (img === null || typeof img === "string") return;
        if (!isObject(img)) {
          errors.push(`images[${i}] must be an object with url and confidence`);
          return;
        }
        if (img.url !== undefined && img.url !== null && typeof img.url !== "string") {
          errors.push(`images[${i}].url must be text or null`);
        }
        if (img.confidence !== undefined && img.confidence !== null && !isConfidence(img.confidence)) {
          errors.push(`images[${i}].confidence must be a number from 0 to 1, or null`);
        }
      });
    }
  }
  if (input.imageUrl !== undefined && input.imageUrl !== null && typeof input.imageUrl !== "string") {
    errors.push("imageUrl must be text or null");
  }

  if (input.vehicles !== undefined) {
    if (!Array.isArray(input.vehicles)) {
      errors.push("vehicles must be a list");
    } else {
      const seen = new Set();
      input.vehicles.forEach((v, i) => {
        const where = `vehicles[${i}]`;
        if (!isObject(v)) {
          errors.push(`${where} must be an object`);
          return;
        }
        if (!isId(v.id)) errors.push(`${where}.id must be a number or text`);
        else if (seen.has(v.id)) errors.push(`${where}.id ${v.id} is used twice in this capture`);
        else seen.add(v.id);
        checkAttributes(v, where, errors);
        if (v.box !== undefined) checkBox(v.box, `${where}.box`, errors);
      });
    }
  } else {
    checkAttributes(input, "capture", errors);
  }

  if (input.boxes !== undefined) {
    if (!Array.isArray(input.boxes)) errors.push("boxes must be a list (use [] when empty)");
    else input.boxes.forEach((b, i) => checkBox(b, `boxes[${i}]`, errors));
  }

  if (errors.length > 0) return { errors, capture: null };

  // A missing list becomes null ("not assessed"), never [] ("none found"),
  // so the interface cannot claim a check happened when it did not.
  const capture = { ...input, conditions: input.conditions ?? [] };
  if (input.vehicles === undefined) {
    capture.features = input.features ?? null;
    capture.damage = input.damage ?? null;
    capture.boxes = input.boxes ?? [];
  } else {
    capture.vehicles = input.vehicles.map((v) => ({
      ...v,
      features: v.features ?? null,
      damage: v.damage ?? null,
    }));
  }
  return { errors: [], capture };
}

export function validateCorrection(input) {
  const errors = [];
  if (!isObject(input)) return { errors: ["Request body must be a JSON object"], correction: null };

  if (!ALLOWED_FIELDS.includes(input.field)) {
    errors.push(`field must be one of: ${ALLOWED_FIELDS.join(", ")}`);
  }
  if (!isText(input.value, 60)) errors.push("value must be non-empty text up to 60 characters");
  if (input.vehicleId !== undefined && !isId(input.vehicleId)) {
    errors.push("vehicleId must be a number or text");
  }

  if (errors.length > 0) return { errors, correction: null };
  return {
    errors: [],
    correction: { field: input.field, value: input.value.trim(), vehicleId: input.vehicleId },
  };
}