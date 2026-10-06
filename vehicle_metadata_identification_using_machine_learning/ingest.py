"""Reads the ML team's JSON files and builds captures.json for the review console.

Put each model output in data/raw/ as NAME.json with its image next to it as
NAME.jpg (or .jpeg / .png). Then run:

    python -m vehicle_metadata_identification_using_machine_learning.ingest

A readable report is printed and also saved to data/processed/ingest_report.json.
"""

import json
import shutil
from datetime import datetime
from pathlib import Path

from PIL import Image

from .adapter import SETTINGS, adapt_file, normalize_key

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "data" / "processed"
IMAGE_TYPES = (".jpg", ".jpeg", ".png")


def find_image(json_path):
    for ext in IMAGE_TYPES:
        for candidate in (json_path.with_suffix(ext), json_path.with_suffix(ext.upper())):
            if candidate.exists():
                return candidate
    return None


def declared_size(raw):
    """Image size written inside the JSON, if any. Returns (w, h) or None."""
    if not isinstance(raw, dict):
        return None
    flat = {normalize_key(k): v for k, v in raw.items()}
    pairs = [("imagewidth", "imageheight"), ("width", "height")]
    image = flat.get("image")
    if isinstance(image, dict):
        inner = {normalize_key(k): v for k, v in image.items()}
        flat.update({"iw": inner.get("width"), "ih": inner.get("height")})
        pairs.append(("iw", "ih"))
    for wk, hk in pairs:
        w, h = flat.get(wk), flat.get(hk)
        if isinstance(w, (int, float)) and isinstance(h, (int, float)) and w > 0 and h > 0:
            return int(w), int(h)
    return None


def image_size(image_path, raw, warnings):
    declared = declared_size(raw)
    with Image.open(image_path) as img:
        real = img.size
    if declared and declared != real:
        warnings.append(
            f"JSON says the image is {declared[0]}x{declared[1]} but the file is {real[0]}x{real[1]}; "
            "using the JSON size because boxes are measured against it")
        return declared
    return declared or real


def build_capture(json_path, settings=None):
    """Returns (capture, image_path, warnings, unused_fields). Raises ValueError for a bad file."""
    try:
        raw = json.loads(json_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as e:
        raise ValueError(f"not valid JSON ({e})")
    image_path = find_image(json_path)
    if image_path is None:
        raise ValueError("no image with the same name next to it (.jpg, .jpeg or .png)")
    warnings = []
    width, height = image_size(image_path, raw, warnings)
    result = adapt_file(raw, width, height, settings)
    warnings += result["warnings"]
    capture = {
        "id": json_path.stem,
        "camera": "Imported file",
        "time": datetime.fromtimestamp(json_path.stat().st_mtime).strftime("%Y-%m-%d %H:%M"),
        "conditions": [],
        "images": [{"url": f"/images/{image_path.name}", "confidence": None}],
        "vehicles": result["vehicles"],
    }
    return capture, image_path, warnings, result["unused_fields"]


def main(raw_dir=RAW_DIR, out_dir=OUT_DIR, settings=None):
    settings = settings or SETTINGS
    files = sorted(Path(raw_dir).glob("*.json"))
    image_dir = Path(out_dir) / "images"
    image_dir.mkdir(parents=True, exist_ok=True)

    captures, report = [], []
    for path in files:
        try:
            capture, image_path, warnings, unused = build_capture(path, settings)
        except Exception as e:  # one bad file must never stop the rest
            report.append({"file": path.name, "status": "skipped", "reason": str(e),
                           "warnings": [], "unused_fields": []})
            continue
        shutil.copy2(image_path, image_dir / image_path.name)
        captures.append(capture)
        report.append({"file": path.name, "status": "ok", "vehicles": len(capture["vehicles"]),
                       "warnings": warnings, "unused_fields": unused})

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    (Path(out_dir) / "captures.json").write_text(json.dumps(captures, indent=2), encoding="utf-8")
    (Path(out_dir) / "ingest_report.json").write_text(
        json.dumps({"settings": settings, "files": report}, indent=2), encoding="utf-8")

    print(f"Settings: {settings}\n")
    for r in report:
        if r["status"] == "skipped":
            print(f"SKIPPED  {r['file']}: {r['reason']}")
            continue
        print(f"OK       {r['file']}: {r['vehicles']} vehicle(s)")
        for w in r["warnings"]:
            print(f"           warning: {w}")
        if r["unused_fields"]:
            print(f"           not used by the interface: {', '.join(map(str, r['unused_fields']))}")
    ok = sum(r["status"] == "ok" for r in report)
    print(f"\n{ok} of {len(report)} file(s) imported. Report saved to {Path(out_dir) / 'ingest_report.json'}")
    return report


if __name__ == "__main__":
    main()