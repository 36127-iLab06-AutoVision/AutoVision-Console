"""The detection service: one image in, vehicle results out.

The review console's "Run detection" button sends the image here. This file does the web
part (reading the image, converting the answer to the console's format). The ML team only
has to fill in ONE function, run_model(), below.

Start it from the repo root:

    pip install fastapi uvicorn
    uvicorn vehicle_metadata_identification_using_machine_learning.service:app --port 8000

Then start the console server pointing at it (cmd):

    set ANALYZE_URL=http://localhost:8000
    npm start

To try the whole button without a model, start this service with DEMO_MODEL=1 (cmd:
set DEMO_MODEL=1). It returns made-up results and says so in a warning.
"""

import base64
import binascii
import io
import os

from fastapi import FastAPI, HTTPException
from PIL import Image
from pydantic import BaseModel

from .adapter import SETTINGS, adapt_file

MAX_IMAGE_BYTES = 8 * 1024 * 1024


def run_model(image):
    """Runs the real models (detector, make/model, body type, colour, damage).

    image: a Pillow image (RGB). The work is in models.py. If the model files or libraries
    are missing this raises NotImplementedError, and the console shows that message.
    """
    from . import models
    return models.predict(image)


def demo_model(image):
    """Made-up output so the button can be tried end to end. Not a real detection."""
    w, h = image.size
    return {
        "vehicles": [
            {"vehicle_id": 1, "bounding_box": [w * 0.10, h * 0.15, w * 0.55, h * 0.80],
             "make_model": "Toyota Camry", "confidence": 0.91,
             "body_type": {"label": "Sedan", "confidence": 0.88},
             "colour": {"label": "White", "confidence": 0.80},
             "damage": [{"class": "dent", "confidence": 0.82,
                         "bbox": [w * 0.20, h * 0.50, w * 0.32, h * 0.62]}]},
            {"vehicle_id": 2, "bounding_box": [w * 0.60, h * 0.20, w * 0.92, h * 0.75],
             "make_model": "BMW X5", "confidence": 0.62, "damage": []},
        ]
    }


app = FastAPI(title="Vehicle detection service")


class AnalyzeRequest(BaseModel):
    image: str  # a data URL such as data:image/jpeg;base64,....


def read_image(data):
    """Decode the data URL into a Pillow image. Raises ValueError with a plain message."""
    cut = data.find(";base64,")
    if not data.startswith("data:image/") or cut == -1:
        raise ValueError("image must be a base64 data URL of a JPEG or PNG")
    try:
        raw = base64.b64decode(data[cut + 8:], validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("image data is not valid base64")
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("image is larger than 8 MB")
    try:
        with Image.open(io.BytesIO(raw)) as img:
            if img.format not in ("JPEG", "PNG"):
                raise ValueError("image must be a JPEG or PNG")
            return img.convert("RGB")
    except OSError:
        raise ValueError("image file could not be read")


@app.get("/health")
def health():
    demo = os.environ.get("DEMO_MODEL") == "1"
    return {"ok": True, "demo": demo}


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        image = read_image(request.image)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    demo = os.environ.get("DEMO_MODEL") == "1"
    try:
        raw = (demo_model if demo else run_model)(image)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:  # a model crash should come back as a readable message
        raise HTTPException(status_code=500, detail=f"model failed: {e}")

    try:
        result = adapt_file(raw, image.width, image.height, SETTINGS)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"model output could not be read: {e}")

    warnings = list(result["warnings"])
    if demo:
        warnings.insert(0, "DEMO MODE: these results are made up. No model ran.")
    return {"vehicles": result["vehicles"], "warnings": warnings, "unused_fields": result["unused_fields"]}
