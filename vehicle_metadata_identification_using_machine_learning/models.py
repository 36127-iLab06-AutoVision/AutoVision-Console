"""The real models, wired together.

Pipeline for one image:
  1. yolo11s (the standard COCO detector) finds the vehicles: car, motorcycle, bus, truck.
  2. For each vehicle, the crop goes to three classifiers: make/model (ResNet50),
     body type (ConvNeXt-Tiny) and colour (Swin-T). Each one's raw scores are divided by
     its calibration temperature before the softmax, so the confidence is the calibrated one.
  3. The damage detector (yolo11s, negative-aware) runs ONCE on the whole photo. Each damage
     box is given to the vehicle whose box contains its centre (the smallest one, if boxes
     overlap). Damage outside every vehicle box is not shown. It runs on the whole photo
     because it found a scratch there that it missed on a cropped vehicle.

service.run_model() calls predict() here. Nothing is loaded until the first call, and the
models are then kept in memory, so only the first click is slow.

Where the model files live: set MODELS_DIR (cmd: set MODELS_DIR=C:\\path\\to\\models) to the
folder that holds config\\, detector\\ and final_training\\. Default: a "models" folder in the
repo root. Model files are big and must NOT be committed to git.

Settings that the ML team should confirm are the constants just below.

Try it on one image, no server needed:
    python -m vehicle_metadata_identification_using_machine_learning.models photo.jpg
"""

import json
import os
import threading
from pathlib import Path

# ---- Settings to confirm with the ML team ------------------------------------------------
IMAGENET_MEAN = (0.485, 0.456, 0.406)   # normalisation the classifiers were trained with
IMAGENET_STD = (0.229, 0.224, 0.225)
CROP_PADDING = 0.0          # extra space around each vehicle crop, as a fraction of its size
VEHICLE_CLASS_IDS = (2, 3, 5, 7)        # COCO: car, motorcycle, bus, truck
VEHICLE_CONF = float(os.environ.get("VEHICLE_CONF", "0.25"))
DAMAGE_CONF = float(os.environ.get("DAMAGE_CONF", "0.25"))
MAX_VEHICLES = 10
MIN_VEHICLE_PIXELS = 32     # ignore detections smaller than this on either side
# ------------------------------------------------------------------------------------------

DEFAULT_MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

PATHS = {
    "detector": "detector/yolo11s.pt",
    "damage": "final_training/damage/yolo11s_negative_aware_final.pt",
    "body_type": "final_training/body_type/convnext_tiny_final_best.pt",
    "colour": "final_training/colour/swin_t_final_best.pt",
    "make_model": "final_training/make_model/resnet50_final_best.pt",
}
CLASS_FILES = {
    "body_type": "config/final_body_type_class_to_id.json",
    "colour": "config/final_colour_class_to_id.json",
    "make_model": "config/final_make_model_class_to_id.json",
}
SETTINGS_FILE = "config/deployment_confidence_settings.json"


def models_dir():
    return Path(os.environ.get("MODELS_DIR") or DEFAULT_MODELS_DIR)


# ---- Plain helpers (no torch needed, easy to test) ---------------------------------------

def class_names_from_file(path):
    """Read a class file and return a list where the position is the class id.
    Accepts {"name": id} (what the team sent) or {"id": "name"}."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, list):
        return [str(x) for x in data]
    if not isinstance(data, dict) or not data:
        raise ValueError(f"{path}: expected a non-empty JSON object")
    if all(isinstance(v, int) for v in data.values()):
        pairs = [(v, k) for k, v in data.items()]
    elif all(str(k).isdigit() for k in data):
        pairs = [(int(k), v) for k, v in data.items()]
    else:
        raise ValueError(f"{path}: could not tell which side is the class id")
    ids = sorted(i for i, _ in pairs)
    if ids != list(range(len(pairs))):
        raise ValueError(f"{path}: class ids are not 0..{len(pairs) - 1} without gaps")
    names = [None] * len(pairs)
    for i, name in pairs:
        names[i] = str(name)
    return names


def clean_label(text):
    """'toyota_camry' -> 'toyota camry'. Underscores are not shown to reviewers."""
    return " ".join(str(text).replace("_", " ").split())


def split_make_model_label(label):
    """The team's make/model classes look like 'Toyota || Toyota Hilux' (make || model).
    Returns (make, model). A model that repeats the make loses the repeat:
    'Toyota || Toyota Hilux' -> ('Toyota', 'Hilux'). No '||' -> (None, whole label)."""
    if "||" not in str(label):
        return None, clean_label(label)
    make, _, model = str(label).partition("||")
    make, model = clean_label(make), clean_label(model)
    if make and model.lower().startswith(make.lower() + " "):
        model = model[len(make):].strip()
    return make or None, model or None


def sentence_case(text):
    """'black' -> 'Black', 'pickup' -> 'Pickup'. Labels that already have capitals are kept."""
    text = clean_label(text)
    return text[:1].upper() + text[1:] if text.islower() else text


def clamp_box(box, width, height):
    x1, y1, x2, y2 = box
    return (max(0.0, min(float(x1), width)), max(0.0, min(float(y1), height)),
            max(0.0, min(float(x2), width)), max(0.0, min(float(y2), height)))


def padded_crop_box(box, width, height, padding=CROP_PADDING):
    x1, y1, x2, y2 = box
    px, py = (x2 - x1) * padding, (y2 - y1) * padding
    x1, y1, x2, y2 = clamp_box((x1 - px, y1 - py, x2 + px, y2 + py), width, height)
    return int(x1), int(y1), max(int(x1) + 1, int(round(x2))), max(int(y1) + 1, int(round(y2)))


def owner_of_damage(damage_box, vehicle_boxes):
    """Index of the vehicle whose box contains the centre of the damage box, or None.
    If several boxes contain it, the smallest one wins (the vehicle in front or inside)."""
    cx, cy = (damage_box[0] + damage_box[2]) / 2, (damage_box[1] + damage_box[3]) / 2
    best, best_area = None, None
    for i, (x1, y1, x2, y2) in enumerate(vehicle_boxes):
        if x1 <= cx <= x2 and y1 <= cy <= y2:
            area = (x2 - x1) * (y2 - y1)
            if best is None or area < best_area:
                best, best_area = i, area
    return best


class Pipeline:
    """The steps, with the actual models passed in as simple functions so tests can
    replace them.

    detector(image)      -> list of (box_xyxy_pixels, score)
    make_model(crop)     -> (label, confidence 0..1)
    body_type(crop)      -> (label, confidence)
    colour(crop)         -> (label, confidence)
    damage(image)        -> list of (label, confidence, box_xyxy_in_whole_image_pixels)
    """

    def __init__(self, detector, make_model, body_type, colour, damage):
        self.detector = detector
        self.make_model = make_model
        self.body_type = body_type
        self.colour = colour
        self.damage = damage

    def run(self, image):
        width, height = image.size
        found = [(b, s) for b, s in self.detector(image)
                 if (b[2] - b[0]) >= MIN_VEHICLE_PIXELS and (b[3] - b[1]) >= MIN_VEHICLE_PIXELS]
        found.sort(key=lambda d: d[1], reverse=True)
        found = found[:MAX_VEHICLES]
        found.sort(key=lambda d: d[0][0])  # left to right, so vehicle numbers follow the picture

        all_damage = self.damage(image) if found else []
        owners = [owner_of_damage(d[2], [f[0] for f in found]) for d in all_damage]

        vehicles = []
        for n, (box, _score) in enumerate(found, start=1):
            left, top, right, bottom = padded_crop_box(box, width, height)
            crop = image.crop((left, top, right, bottom))
            mm_label, mm_conf = self.make_model(crop)
            bt_label, bt_conf = self.body_type(crop)
            col_label, col_conf = self.colour(crop)
            damage = [
                {"class": sentence_case(label), "confidence": conf,
                 "bbox": [round(v, 1) for v in dbox]}
                for (label, conf, dbox), owner in zip(all_damage, owners)
                if owner == n - 1
            ]
            vehicle = {
                "vehicle_id": n,
                "bounding_box": [round(v, 1) for v in clamp_box(box, width, height)],
                "body_type": {"label": sentence_case(bt_label), "confidence": bt_conf},
                "colour": {"label": sentence_case(col_label), "confidence": col_conf},
                "damage": damage,
            }
            make, model = split_make_model_label(mm_label)
            if make:
                vehicle["make"] = {"label": make, "confidence": mm_conf}
                vehicle["model"] = {"label": model, "confidence": mm_conf} if model else None
            else:
                vehicle["make_model"] = {"label": model, "confidence": mm_conf}
            vehicles.append(vehicle)
        return {"vehicles": vehicles}


# ---- Loading the real models (needs torch, torchvision, ultralytics) ---------------------

_pipeline = None
_lock = threading.Lock()


def _load_checkpoint(torch, path):
    try:
        return torch.load(path, map_location="cpu", weights_only=True)
    except Exception:
        # Older pickles can need full loading. Only do this for files from our own team.
        return torch.load(path, map_location="cpu", weights_only=False)


def _build_classifier(name, root, temperature):
    import torch
    from torchvision import models as tv
    from torchvision import transforms

    builders = {"convnext_tiny": tv.convnext_tiny, "swin_t": tv.swin_t, "resnet50": tv.resnet50}
    ck = _load_checkpoint(torch, root / PATHS[name])
    arch, n_classes, size = ck["architecture"], int(ck["num_classes"]), int(ck["image_size"])
    if arch not in builders:
        raise ValueError(f"{name}: unknown architecture '{arch}'")
    names = class_names_from_file(root / CLASS_FILES[name])
    if len(names) != n_classes:
        raise ValueError(f"{name}: class file has {len(names)} classes, checkpoint has {n_classes}")
    model = builders[arch](weights=None, num_classes=n_classes)
    model.load_state_dict(ck["model_state_dict"])
    model.eval()
    prep = transforms.Compose([
        transforms.Resize((size, size)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    def predict(crop):
        with torch.inference_mode():
            logits = model(prep(crop).unsqueeze(0))[0]
            probs = torch.softmax(logits / temperature, dim=0)
            conf, idx = probs.max(dim=0)
        return names[int(idx)], float(conf)

    return predict


def load_pipeline():
    root = models_dir()
    missing = [str(root / p) for p in list(PATHS.values()) + list(CLASS_FILES.values()) + [SETTINGS_FILE]
               if not (root / p).is_file()]
    if missing:
        raise NotImplementedError(
            f"Model files not found under {root}. Set MODELS_DIR to the folder holding "
            f"config, detector and final_training. First missing: {missing[0]}")
    try:
        from ultralytics import YOLO
    except ImportError as e:
        raise NotImplementedError(f"Model libraries are not installed ({e}). "
                                  "pip install torch torchvision ultralytics") from e

    with open(root / SETTINGS_FILE, encoding="utf-8") as f:
        temps = {k: float(v["temperature"]) for k, v in json.load(f).items()}

    classifiers = {name: _build_classifier(name, root, temps[name]) for name in CLASS_FILES}
    detector_model = YOLO(str(root / PATHS["detector"]))
    damage_model = YOLO(str(root / PATHS["damage"]))

    def detect(image):
        result = detector_model.predict(image, conf=VEHICLE_CONF, classes=list(VEHICLE_CLASS_IDS),
                                        verbose=False)[0]
        return [(box.tolist(), float(score))
                for box, score in zip(result.boxes.xyxy, result.boxes.conf)]

    def find_damage(image):
        result = damage_model.predict(image, conf=DAMAGE_CONF, verbose=False)[0]
        names = result.names
        return [(names[int(c)], float(s), box.tolist())
                for box, s, c in zip(result.boxes.xyxy, result.boxes.conf, result.boxes.cls)]

    return Pipeline(detect, classifiers["make_model"], classifiers["body_type"],
                    classifiers["colour"], find_damage)


def predict(image):
    """Called by service.run_model(). image: a Pillow RGB image."""
    global _pipeline
    with _lock:
        if _pipeline is None:
            _pipeline = load_pipeline()
        return _pipeline.run(image)


if __name__ == "__main__":
    import sys
    from PIL import Image
    from .adapter import SETTINGS, adapt_file

    if len(sys.argv) != 2:
        sys.exit("usage: python -m vehicle_metadata_identification_using_machine_learning.models image.jpg")
    img = Image.open(sys.argv[1]).convert("RGB")
    raw = predict(img)
    print("RAW MODEL OUTPUT")
    print(json.dumps(raw, indent=2))
    out = adapt_file(raw, img.width, img.height, SETTINGS)
    print("\nWARNINGS FROM THE ADAPTER:", out["warnings"] or "none")
    print("VEHICLES THE CONSOLE WILL SHOW:", len(out["vehicles"]))