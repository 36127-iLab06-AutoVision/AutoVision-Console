# Vehicle Identification Unit: API contract

**Purpose.** This document says exactly what the review console reads and writes, so the ML pipeline can plug in without changes to the interface. It matches the code that is built and tested today.

**Status (what is real and what is not).**

| Part | Status |
|---|---|
| Review console, correction, audit log, flagging, export | Built, tested, live on the demo site |
| Server and SQLite storage | Built, tested |
| ML output adapter and ingest (files in `data/raw/`) | Built, tested (62 Python tests) |
| Detection service (`/analyze`) and the **Run detection** button | Built and tested end to end. Runs in **demo mode** (made-up results) until the ML team fills in `run_model()` |
| Real model inference | Not connected yet |

The public demo site has no model connected, so its **Run detection** button is switched off on purpose. All data on it is fake sample data.

---

## 1. How data reaches the console

Two routes, one result. Both end in the **Capture** shape below.

1. **Files.** The ML team writes one JSON file per image into `data/raw/` with the image next to it (same name). `python -m vehicle_metadata_identification_using_machine_learning.ingest` converts them to `data/processed/captures.json`. The server loads that file when it starts.
2. **Button.** The user uploads an image and clicks **Run detection**. The server sends the image to the detection service (`POST /analyze`), checks what comes back, and saves it as a new capture.

In both cases the ML output goes through the same **adapter**, which accepts several layouts (field names, box formats, confidence scales) and reports anything it had to guess as a warning. See section 6.

---

## 2. The Capture object

One capture is one image. It holds a list of vehicles.

```json
{
  "id": "img_005",
  "camera": "Toll Gantry 4B",
  "time": "2026-10-08 12:57",
  "conditions": [],
  "images": [{ "url": "/images/img_005.jpg", "confidence": null }],
  "vehicles": [
    {
      "id": 1,
      "make": "Toyota", "model": "Camry",
      "makeConf": 0.91, "modelConf": 0.91,
      "color": "White", "colorConf": 0.80,
      "bodyType": "Sedan", "bodyTypeConf": 0.88,
      "box": { "x": 9.38, "y": 11.11, "w": 40.62, "h": 54.17 },
      "features": null,
      "damage": [
        { "label": "dent", "confidence": 0.82,
          "box": { "x": 15.62, "y": 41.67, "w": 9.38, "h": 11.11 } }
      ]
    }
  ]
}
```

### Capture fields

| Field | Type | Rule |
|---|---|---|
| `id` | text | Required, unique. Files use the file name without extension. |
| `camera` | text | Required. Shown in the queue. Defaults to "Imported file" for ingested files. |
| `time` | text | Required. Shown as text, not parsed. |
| `conditions` | list of text | Optional. `[]` when none. |
| `images` | list of `{url, confidence}` | `url` is a path on the server (`/images/...`, `/uploads/...`), a full URL, or `null`. `confidence` is 0 to 1 or `null`. |
| `vehicles` | list | See below. `[]` means "the model looked and found no vehicles". |

### Vehicle fields

| Field | Type | Rule |
|---|---|---|
| `id` | number or text | Unique **within the capture**. If missing or repeated, the adapter renumbers 1, 2, 3. |
| `make`, `model`, `color`, `bodyType` | text up to 60 characters, or `null` | `null` means the model gave no value. |
| `makeConf`, `modelConf`, `colorConf`, `bodyTypeConf` | number 0 to 1, or `null` | A fraction, never a percentage (`0.94`, not `94`). |
| `box` | `{x, y, w, h}` or `null` | Percent of the image (0 to 100). See below. |
| `features` | list, `[]` or `null` | See "Null versus empty list". |
| `damage` | list, `[]` or `null` | See "Null versus empty list". |

### Null versus empty list (important)

| Value | Meaning in the console |
|---|---|
| `damage: []` | The model checked this vehicle and found **no damage**. Shows "No damage detected". |
| `damage: null` or missing | The model did **not check** for damage. Shows "Not assessed". |

The same rule applies to `features`. The server never turns a missing list into `[]`, so the console cannot claim a check happened when it did not. For the same reason, send `null` for any attribute you do not have. Please do not guess.

### Bounding boxes

`x`, `y` are the top-left corner and `w`, `h` the size, all as **percent of the image** (0 to 100), so they scale with any image size. A box must have `w` and `h` above 0 and stay inside the image. If your model outputs pixels, you do not have to convert them: the adapter does it (section 6).

### Damage findings

Each item in `damage` is either plain text (for example `"dent"`) or an object:

```json
{ "label": "dent", "confidence": 0.82, "box": { "x": 15.62, "y": 41.67, "w": 9.38, "h": 11.11 }, "severity": "Minor" }
```

`label` (or `part`) and `severity` are text up to 60 characters. `confidence` is 0 to 1 or `null`. `box` is optional or `null`. Damage with a box is drawn in red on the image.

### Older single-vehicle captures

The three built-in demo captures (`c1`, `c2`, `c3`) use an older shape with the attributes at the top level and a `boxes` list instead of `vehicles`. This shape is still accepted. New ML output should use `vehicles`.

### How a capture gets flagged for review

The console takes the **weakest available confidence** across a vehicle's make, model, colour and body type (nulls are ignored). If it is below the **flag threshold** (default 75%, adjustable in the UI), the capture is flagged. A capture with no scores at all is flagged too. Damage confidence does not affect flagging yet.

---

## 3. Endpoints (console server)

Base URL: `http://localhost:4000` locally. The published address is set in the front end with `VITE_API_URL`. All bodies are JSON. Errors look like `{ "error": "...", "errors": ["...", "..."] }`, where `errors` lists every problem found so the sender can fix them in one go.

### `GET /api/captures`
All captures, newest uploads first, then ingested and demo ones. `200`, a JSON list of Capture objects.

### `GET /api/audit`
The audit log, newest first, up to 200 entries. `200`, a list of `{ "time": "03:45:12 pm", "text": "make changed from \"Toyota\" to \"Nissan\" on Toll Gantry 4B" }`.

### `PATCH /api/captures/:id`
A reviewer corrects one value.

```json
{ "field": "make", "value": "Nissan", "vehicleId": 2 }
```

- `field`: `make`, `model`, `color` or `bodyType`.
- `value`: text, 1 to 60 characters.
- `vehicleId`: **required** when the capture has a `vehicles` list, and **not allowed** when it does not.

`200`: `{ "success": true, "auditLog": [ ... ] }`. The server is the single source of truth for the audit log. Errors: `400` (invalid correction or missing/extra `vehicleId`), `404` (capture or vehicle not found).

### `POST /api/captures`
Adds a capture you have already built (used by tests and tools). The body is a full Capture. An `imageUrl` starting with `data:` is decoded, checked, saved as a file, and replaced by a link. `201`: the saved capture. Errors: `400` (invalid, or the image is not a real PNG or JPEG), `409` (the `id` already exists).

### `GET /api/detect/status`
`200`: `{ "available": true }` when the server has a detection service configured, otherwise `{ "available": false }`. The console uses this to switch the **Run detection** button on or off.

### `POST /api/detect`
"Run detection". Body: `{ "imageUrl": "data:image/jpeg;base64,..." }` (JPEG or PNG).

The server checks the image, sends it to the detection service, checks the answer against the rules in section 2, saves a new capture (`id` like `upload-1a2b3c4d`, camera "Uploaded image"), and returns:

```json
{ "capture": { ... }, "warnings": ["DEMO MODE: these results are made up. No model ran."] }
```

| Status | Meaning |
|---|---|
| `201` | Saved. |
| `400` | Not a real JPEG or PNG. Nothing saved. |
| `502` | The service failed, or sent something the console cannot accept. Nothing saved. |
| `503` | No detection service is configured on this server. |
| `504` | The service could not be reached, or took longer than 120 seconds. |

A failed request never leaves a stray image or a half-saved capture behind.

### Static files
`/images/<file>`: images from the ingest step. `/uploads/<file>`: images saved from uploads.

### Limits
Request bodies are limited to 10 MB. The upload box refuses images over 7 MB (a picture grows by about a third when sent as text) and anything that is not a JPG or PNG.

---

## 4. Detection service (what the ML team connects)

A small Python (FastAPI) service in `vehicle_metadata_identification_using_machine_learning/service.py`. The ML team fills in **one function**:

```python
def run_model(image):
    # image: a Pillow image (RGB)
    # return: the model's output as a dict or list, in the layout you already use
    ...
```

### `POST /analyze`
Request: `{ "image": "data:image/jpeg;base64,..." }`. Up to 8 MB, JPEG or PNG.

Response `200`:
```json
{ "vehicles": [ ... ], "warnings": [ ... ], "unused_fields": [ ... ] }
```
`vehicles` is already in the console's format (the adapter ran). `warnings` lists anything guessed or skipped. `unused_fields` lists keys in the model output that the console does not use.

| Status | Meaning |
|---|---|
| `400` | Bad image. The model does not run. |
| `501` | `run_model()` has not been filled in yet. |
| `500` | The model raised an error. The message is in `detail`. |
| `502` | The adapter could not find any list of vehicles in the output. |

### `GET /health`
`{ "ok": true, "demo": false }`. `demo` is `true` when started with the `DEMO_MODEL=1` environment variable, which returns made-up results and adds a "DEMO MODE" warning. Never use demo mode for real results.

Step-by-step instructions for the ML team are in `docs/ml-handover.md`.

---

## 5. Configuration (environment variables)

| Variable | Where | Meaning |
|---|---|---|
| `ANALYZE_URL` | server | Address of the detection service, for example `http://localhost:8000`. Unset means **Run detection** is switched off. |
| `PROCESSED_DIR` | server | Folder holding `captures.json` and `images/`. Default `data/processed`. Published demo: `demo-data`. |
| `DB_FILE` | server | SQLite file. Default `data/app.db`. |
| `UPLOADS_DIR` | server | Where uploaded images are saved. Default `data/uploads`. |
| `CORS_ORIGIN` | server | The exact address of the published console (several can be given, comma separated). |
| `PORT` | server | Default 4000. |
| `VITE_API_URL` | front end (build time) | The server address baked into the published console. |
| `DEMO_MODEL` | detection service | `1` turns on made-up results. |

**Ingest rules.** When the server starts it loads `captures.json`: captures that nobody has corrected are refreshed from the file, uncorrected captures that disappeared from the file are removed, and captures a reviewer has corrected are never overwritten or removed. Invalid ingested captures are skipped with a message in the server log.

**Hosted demo caveat.** On Render's free tier the disk is wiped on every restart and redeploy, so corrections and uploads reset to the committed demo data.

---

## 6. What ML output the adapter accepts

The adapter (`adapter.py`) is deliberately forgiving, so the ML team does not need to reshape output. It handles:

- **Where the vehicles are:** a list under `vehicles`, `detections`, `predictions`, `results`, `objects` (and similar), or a bare list.
- **Field names:** matched loosely (case, spaces, underscores and dashes ignored). Combined labels such as `"make_model": "Toyota Camry"` are split into make and model, and `"confidence"` is applied to both.
- **Attributes as plain values or objects:** `"colour": "White"` or `"colour": {"label": "White", "confidence": 0.8}`.
- **Boxes:** `[x1, y1, x2, y2]`, `[x, y, w, h]` or `[cx, cy, w, h]`, or an object with named keys; in pixels, 0 to 1, or percent. The layout and units default to `xyxy` and auto-detect, and are set in `SETTINGS` in `adapter.py`.
- **Confidences:** a fraction, or 0 to 100 if `confidence_scale` is changed in `SETTINGS`.
- **Damage:** a list of text, or objects with `class` / `label` / `part`, `confidence`, and `bbox` / `box`. `[]` and missing are kept apart (section 2).
- **Image size:** taken from the image file, or from the JSON if it declares one. If the two disagree, the JSON size is used and a warning is shown.

Anything it could not read becomes a warning, never a crash. After an ingest run, `data/processed/ingest_report.json` lists, for every file, the status, the number of vehicles, the warnings and the unused fields.

---

## 7. Open points to confirm with the ML team

1. Do they have a vehicle detector (one box per car), or do make/model, colour and body type run on the whole image?
2. Box layout and units.
3. Make and model: one combined label or two fields, and the exact field names.
4. Damage output (class, confidence, box), and `[]` versus missing.
5. Confidence scale, and whether it is the calibrated one.
6. Full class lists (for the correction dropdowns) and the recommended flag threshold.
7. Where the models will run, and how long one image takes.
