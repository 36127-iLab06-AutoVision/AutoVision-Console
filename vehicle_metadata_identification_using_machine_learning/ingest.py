"""Read model output files from data/raw and build the file the server loads.

Each model output is a JSON file with an image of the same name beside it:

    data/raw/img_001.jpg
    data/raw/img_001.json

Run from the repo root:

    python -m vehicle_metadata_identification_using_machine_learning.ingest
"""

import json
from datetime import datetime
from pathlib import Path
import shutil

from .adapter import adapt_output
from .config import PROJ_ROOT

RAW_DIR = PROJ_ROOT / "data" / "raw"
OUT_DIR = PROJ_ROOT / "data" / "processed"
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")


def find_image(json_path: Path) -> Path | None:
    """The image shares the JSON file's name, e.g. img_001.json -> img_001.jpg."""
    for ext in IMAGE_EXTENSIONS:
        candidate = json_path.with_suffix(ext)
        if candidate.exists():
            return candidate
    return None


def image_size(raw: dict, image_path: Path) -> tuple[int, int]:
    """Prefer the size written in the model file, otherwise read it from the image."""
    if raw.get("image_width") and raw.get("image_height"):
        return raw["image_width"], raw["image_height"]
    from PIL import Image

    with Image.open(image_path) as img:
        return img.size


def build_capture(json_path: Path) -> tuple[dict, Path]:
    raw = json.loads(json_path.read_text(encoding="utf-8"))
    image_path = find_image(json_path)
    if image_path is None:
        raise FileNotFoundError(f"no image named {json_path.stem}.jpg or .png beside it")

    width, height = image_size(raw, image_path)
    modified = datetime.fromtimestamp(json_path.stat().st_mtime)

    capture = {
        "id": json_path.stem,
        # The model files do not carry these yet. They are used if present.
        "camera": raw.get("camera", "Imported file"),
        "time": raw.get("time", modified.strftime("%H:%M:%S")),
        "conditions": raw.get("conditions", []),
        "images": [{"url": f"/images/{image_path.name}", "confidence": None}],
        "vehicles": adapt_output(raw, width, height),
    }
    return capture, image_path


def main() -> None:
    images_dir = OUT_DIR / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    captures, problems = [], []
    for json_path in sorted(RAW_DIR.glob("*.json")):
        try:
            capture, image_path = build_capture(json_path)
        except (ValueError, KeyError, FileNotFoundError, json.JSONDecodeError) as err:
            problems.append(f"{json_path.name}: {type(err).__name__}: {err}")
            continue
        shutil.copy2(image_path, images_dir / image_path.name)
        captures.append(capture)

    output_file = OUT_DIR / "captures.json"
    output_file.write_text(json.dumps(captures, indent=2), encoding="utf-8")

    print(f"Wrote {len(captures)} captures to {output_file}")
    for problem in problems:
        print(f"SKIPPED {problem}")


if __name__ == "__main__":
    main()