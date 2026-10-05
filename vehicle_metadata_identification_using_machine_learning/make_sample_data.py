"""Create fake model output files and matching images in data/raw.

This lets the ingest step and the interface be tested before the real
model files arrive. Run from the repo root:

    python -m vehicle_metadata_identification_using_machine_learning.make_sample_data
"""

import json

from PIL import Image, ImageDraw

from .config import PROJ_ROOT

RAW_DIR = PROJ_ROOT / "data" / "raw"
SIZE = (1280, 720)

# Same shape as the ML team's sample. "camera" is an optional extra.
SAMPLES = {
    "img_001": {
        "camera": "Toll Gantry 4B",
        "vehicles": [
            {"vehicle_id": 1, "bounding_box": [120, 80, 640, 470], "make_model": "Toyota Camry", "confidence": 0.91},
            {"vehicle_id": 2, "bounding_box": [710, 100, 1100, 430], "make_model": "BMW X5", "confidence": 0.87},
        ],
    },
    "img_002": {
        "camera": "Checkpoint North",
        "vehicles": [
            {"vehicle_id": 1, "bounding_box": [300, 150, 980, 600], "make_model": "Ford Ranger", "confidence": 0.96},
        ],
    },
    "img_003": {
        "camera": "Carpark Cam 2",
        "vehicles": [
            {"vehicle_id": 1, "bounding_box": [200, 200, 700, 560], "make_model": "Mazda CX-5", "confidence": 0.62},
        ],
    },
    "img_004": {"camera": "Toll Gantry 4B", "vehicles": []},
}

BODY_COLOURS = [(91, 122, 157), (150, 90, 80), (110, 120, 100)]


def draw_car(draw: ImageDraw.ImageDraw, box, colour) -> None:
    """A simple car shape that fills the given box."""
    x1, y1, x2, y2 = box
    w, h = x2 - x1, y2 - y1
    body_top = y1 + int(h * 0.38)
    wheel_r = int(h * 0.14)
    draw.rounded_rectangle([x1, body_top, x2, y2 - wheel_r], radius=int(h * 0.08), fill=colour)
    draw.rounded_rectangle(
        [x1 + int(w * 0.22), y1 + int(h * 0.08), x2 - int(w * 0.22), body_top + 6],
        radius=int(h * 0.08),
        fill=colour,
    )
    for wheel_x in (x1 + int(w * 0.22), x2 - int(w * 0.22)):
        draw.ellipse(
            [wheel_x - wheel_r, y2 - 2 * wheel_r, wheel_x + wheel_r, y2],
            fill=(10, 13, 16),
            outline=(60, 60, 60),
            width=4,
        )


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for name, sample in SAMPLES.items():
        image = Image.new("RGB", SIZE, (16, 20, 24))
        draw = ImageDraw.Draw(image)
        draw.rectangle([0, 560, SIZE[0], SIZE[1]], fill=(27, 32, 38))
        for i, vehicle in enumerate(sample["vehicles"]):
            draw_car(draw, vehicle["bounding_box"], BODY_COLOURS[i % len(BODY_COLOURS)])
        image.save(RAW_DIR / f"{name}.jpg", quality=85)
        (RAW_DIR / f"{name}.json").write_text(json.dumps(sample, indent=2), encoding="utf-8")
    print(f"Created {len(SAMPLES)} sample files in {RAW_DIR}")


if __name__ == "__main__":
    main()