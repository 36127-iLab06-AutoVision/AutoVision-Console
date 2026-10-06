"""Turns whatever JSON the ML team produces into the shape the interface expects.

Nothing here assumes one exact layout. Field names are matched loosely, boxes can
be in several layouts and units, and anything odd becomes a warning instead of a
crash. Change SETTINGS once the ML team confirms their format.
"""

import re

SETTINGS = {
    "box_format": "xyxy",         # xyxy = [x1,y1,x2,y2]; xywh = [x,y,w,h]; cxcywh = centre based
    "box_units": "auto",          # auto | pixels | normalized | percent
    "confidence_scale": "fraction",  # fraction = 0..1; percent = 0..100
}

KNOWN_MAKES = sorted(
    ["Toyota", "Ford", "Mazda", "BMW", "Honda", "Hyundai", "Kia", "Nissan", "Mitsubishi",
     "Holden", "Subaru", "Volkswagen", "Mercedes-Benz", "Mercedes", "Audi", "Tesla",
     "Suzuki", "Isuzu", "Jeep", "Land Rover", "Lexus", "Volvo", "Mini", "Skoda", "Peugeot",
     "Renault", "Fiat", "Porsche", "Chevrolet", "Dodge", "Ram", "GMC", "Cadillac"],
    key=len, reverse=True)


def normalize_key(key):
    return re.sub(r"[^a-z0-9]", "", str(key).lower())


VEHICLE_LIST_NAMES = {"vehicles", "detections", "predictions", "results", "objects", "cars", "items"}
ID_NAMES = {"vehicleid", "id", "objectid", "detectionid", "trackid", "index"}
BOX_NAMES = {"boundingbox", "bbox", "box", "boundingbox2d", "boxes", "rect", "location"}
MAKE_MODEL_NAMES = {"makemodel", "makeandmodel", "vehicletype", "label", "class", "classname",
                    "prediction", "name", "vehiclemakemodel"}
MAKE_NAMES = {"make", "vehiclemake", "brand", "manufacturer"}
MODEL_NAMES = {"model", "vehiclemodel"}
COLOR_NAMES = {"color", "colour", "vehiclecolor", "vehiclecolour"}
BODY_NAMES = {"bodytype", "body", "bodystyle", "vehiclebody", "vehiclebodytype", "category"}
DAMAGE_NAMES = {"damage", "damages", "damagedetection"}
FEATURE_NAMES = {"features", "feature", "accessories", "distinguishingfeatures"}
GENERIC_CONF = {"confidence", "score", "conf", "probability", "prob"}
MAKE_CONF = {"makeconfidence", "makeconf", "makescore"}
MODEL_CONF = {"modelconfidence", "modelconf", "modelscore"}
COLOR_CONF = {"colorconfidence", "colourconfidence", "colorconf", "colourconf", "colorscore", "colourscore"}
BODY_CONF = {"bodytypeconfidence", "bodytypeconf", "bodytypescore", "bodyconfidence"}
MAKE_MODEL_CONF = {"makemodelconfidence", "makemodelconf", "makemodelscore"}

LABEL_KEYS = ("label", "name", "value", "class", "classname", "prediction", "text")
SCORE_KEYS = ("confidence", "score", "conf", "probability", "prob")

# Box objects: each tuple is a set of keys and the layout they imply.
BOX_KEY_SETS = [
    (("x1", "y1", "x2", "y2"), "xyxy"),
    (("xmin", "ymin", "xmax", "ymax"), "xyxy"),
    (("left", "top", "right", "bottom"), "xyxy"),
    (("cx", "cy", "w", "h"), "cxcywh"),
    (("xcenter", "ycenter", "width", "height"), "cxcywh"),
    (("centerx", "centery", "width", "height"), "cxcywh"),
    (("x", "y", "width", "height"), "xywh"),
    (("x", "y", "w", "h"), "xywh"),
    (("left", "top", "width", "height"), "xywh"),
]

PIXEL_TOLERANCE = 2


def split_make_model(text):
    """'Toyota Camry' -> ('Toyota', 'Camry'). Unknown make -> first word is the make."""
    text = str(text).strip()
    if not text:
        return None, None
    lower = text.lower()
    for make in KNOWN_MAKES:
        if lower == make.lower():
            return make, None
        if lower.startswith(make.lower() + " "):
            return make, text[len(make):].strip() or None
    parts = text.split(None, 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    return text, None


def to_confidence(value, settings=None):
    """Return a 0..1 float, or None when the value is missing."""
    settings = settings or SETTINGS
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError(f"confidence {value!r} is not a number")
    if isinstance(value, str):
        text = value.strip()
        pct = text.endswith("%")
        try:
            number = float(text.rstrip("%"))
        except ValueError:
            raise ValueError(f"confidence {value!r} is not a number")
        if pct:
            number /= 100
        elif settings["confidence_scale"] == "percent":
            number /= 100
    elif isinstance(value, (int, float)):
        number = value / 100 if settings["confidence_scale"] == "percent" else float(value)
    else:
        raise ValueError(f"confidence {value!r} is not a number")
    if number < 0 or number > 1:
        raise ValueError(
            f"confidence {value!r} is outside 0 to 1. If the ML team sends percentages, "
            "set confidence_scale to 'percent' in SETTINGS")
    return round(number, 4)


def _lookup(obj, names):
    """Find the first key in obj whose normalised name is in names. Returns (key, value)."""
    for key, value in obj.items():
        if normalize_key(key) in names:
            return key, value
    return None, None


def _read_attribute(value, settings, warnings, label):
    """An attribute may be 'Red' or {'label': 'Red', 'confidence': 0.8}. Returns (text, conf)."""
    if value is None:
        return None, None
    if isinstance(value, dict):
        text = None
        for k, v in value.items():
            if normalize_key(k) in LABEL_KEYS and v is not None:
                text = str(v).strip() or None
                break
        conf = None
        for k, v in value.items():
            if normalize_key(k) in SCORE_KEYS:
                try:
                    conf = to_confidence(v, settings)
                except ValueError as e:
                    warnings.append(f"{label}: {e}")
                break
        return text, conf
    if isinstance(value, (list, tuple)):
        warnings.append(f"{label}: expected one value but got a list; using the first item")
        return _read_attribute(value[0], settings, warnings, label) if value else (None, None)
    text = str(value).strip()
    return (text or None), None


def _box_from_numbers(nums, layout, units, width, height, warnings):
    """Convert four numbers into a percentage box {x,y,w,h}."""
    a, b, c, d = [float(n) for n in nums]
    if units == "auto":
        units = "normalized" if all(0 <= n <= 1 for n in (a, b, c, d)) else "pixels"
    if units == "pixels":
        sx, sy = width, height
    elif units == "normalized":
        sx = sy = None
    elif units == "percent":
        sx = sy = None
    else:
        raise ValueError(f"unknown box_units {units!r}")

    def to_px(v, axis):
        if units == "pixels":
            return v
        full = width if axis == "x" else height
        return v * full if units == "normalized" else v / 100 * full

    if layout == "xyxy":
        x1, y1, x2, y2 = to_px(a, "x"), to_px(b, "y"), to_px(c, "x"), to_px(d, "y")
    elif layout == "xywh":
        x1, y1 = to_px(a, "x"), to_px(b, "y")
        x2, y2 = x1 + to_px(c, "x"), y1 + to_px(d, "y")
    elif layout == "cxcywh":
        cx, cy, bw, bh = to_px(a, "x"), to_px(b, "y"), to_px(c, "x"), to_px(d, "y")
        x1, y1, x2, y2 = cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2
    else:
        raise ValueError(f"unknown box_format {layout!r}")

    if x2 <= x1 or y2 <= y1:
        raise ValueError(
            f"box has no area (x {x1:.0f}-{x2:.0f}, y {y1:.0f}-{y2:.0f}). "
            f"Check box_format in SETTINGS (currently '{layout}')")
    tol = PIXEL_TOLERANCE
    if x1 < -tol or y1 < -tol or x2 > width + tol or y2 > height + tol:
        raise ValueError(
            f"box (x {x1:.0f}-{x2:.0f}, y {y1:.0f}-{y2:.0f}) falls outside the {width}x{height} image. "
            f"Check box_format ('{layout}') and box_units ('{units}') in SETTINGS, or the image size")
    clamped = (x1 < 0 or y1 < 0 or x2 > width or y2 > height)
    x1, y1, x2, y2 = max(0, x1), max(0, y1), min(width, x2), min(height, y2)
    if clamped:
        warnings.append("box slightly outside the image, trimmed to fit")
    box = {
        "x": round(x1 / width * 100, 2),
        "y": round(y1 / height * 100, 2),
        "w": round((x2 - x1) / width * 100, 2),
        "h": round((y2 - y1) / height * 100, 2),
    }
    if box["w"] * box["h"] / 100 < 0.5:
        warnings.append("box covers under 0.5% of the image, is the box format right?")
    return box


def box_to_percent(box, width, height, settings=None):
    """Accepts a list of 4 numbers or an object with named coordinates. Returns {x,y,w,h} percent."""
    settings = settings or SETTINGS
    warnings = []
    return _box_to_percent(box, width, height, settings, warnings)


def _box_to_percent(box, width, height, settings, warnings):
    layout, units = settings["box_format"], settings["box_units"]
    if isinstance(box, dict):
        norm = {normalize_key(k): v for k, v in box.items()}
        for keys, implied in BOX_KEY_SETS:
            if all(k in norm for k in keys):
                nums = [norm[k] for k in keys]
                layout = implied
                break
        else:
            raise ValueError(f"box fields {sorted(box)} are not a layout I know "
                             "(x1/y1/x2/y2, xmin.., left/top/right/bottom, x/y/w/h, cx/cy/w/h)")
    elif isinstance(box, (list, tuple)):
        if len(box) == 8:   # polygon corners: use the outer rectangle
            xs, ys = box[0::2], box[1::2]
            nums, layout = [min(xs), min(ys), max(xs), max(ys)], "xyxy"
            warnings.append("box had 8 numbers (polygon), used its outer rectangle")
        elif len(box) == 4:
            nums = list(box)
        else:
            raise ValueError(f"box needs 4 numbers but has {len(box)}")
    else:
        raise ValueError(f"box {box!r} is not a list or object")
    try:
        nums = [float(n) for n in nums]
    except (TypeError, ValueError):
        raise ValueError(f"box values {nums!r} are not all numbers")
    return _box_from_numbers(nums, layout, units, width, height, warnings)


def _read_list(value, label, warnings):
    """None -> None (not assessed). [] -> []. Strings or objects become a list of strings."""
    if value is None:
        return None
    if isinstance(value, str):
        return [value] if value.strip() else []
    if not isinstance(value, list):
        warnings.append(f"{label}: expected a list, got {type(value).__name__}; ignored")
        return None
    out = []
    for item in value:
        if isinstance(item, dict):
            text, _ = _read_attribute(item, SETTINGS, warnings, label)
            if text:
                out.append(text)
        elif item is not None and str(item).strip():
            out.append(str(item).strip())
    return out


def adapt_vehicle(raw, width, height, settings=None):
    """Convert one raw detection into an interface vehicle. Returns (vehicle, warnings)."""
    settings = settings or SETTINGS
    if not isinstance(raw, dict):
        raise ValueError(f"a vehicle should be an object, got {type(raw).__name__}")
    warnings, used = [], set()

    def take(names):
        key, value = _lookup(raw, names)
        if key is not None:
            used.add(key)
        return value

    vid = take(ID_NAMES)

    box = None
    box_raw = take(BOX_NAMES)
    if box_raw is not None:
        box = _box_to_percent(box_raw, width, height, settings, warnings)
    else:
        warnings.append("no bounding box found, vehicle will not be outlined on the image")

    make_raw, model_raw = take(MAKE_NAMES), take(MODEL_NAMES)
    mm_raw = take(MAKE_MODEL_NAMES)
    color_raw, body_raw = take(COLOR_NAMES), take(BODY_NAMES)
    damage_raw, feat_raw = take(DAMAGE_NAMES), take(FEATURE_NAMES)

    generic = take(GENERIC_CONF)
    conf_values = {name: take(names) for name, names in [
        ("make", MAKE_CONF), ("model", MODEL_CONF), ("color", COLOR_CONF),
        ("body", BODY_CONF), ("makemodel", MAKE_MODEL_CONF)]}

    def conf(value, label):
        try:
            return to_confidence(value, settings)
        except ValueError as e:
            warnings.append(f"{label} confidence: {e}")
            return None

    generic_c = conf(generic, "overall")

    make, make_c = _read_attribute(make_raw, settings, warnings, "make")
    model, model_c = _read_attribute(model_raw, settings, warnings, "model")
    mm_text, mm_c = _read_attribute(mm_raw, settings, warnings, "make_model")

    if mm_text and not (make or model):
        make, model = split_make_model(mm_text)
        specific = conf(conf_values["makemodel"], "make_model")
        shared = specific if specific is not None else (mm_c if mm_c is not None else generic_c)
        make_c = shared
        model_c = shared if model else None
    elif mm_text:
        warnings.append("both make_model and separate make/model were given; used the separate fields")

    specific_make, specific_model = conf(conf_values["make"], "make"), conf(conf_values["model"], "model")
    if specific_make is not None:
        make_c = specific_make
    if specific_model is not None:
        model_c = specific_model
    if make and make_c is None:
        make_c = generic_c
    if model and model_c is None:
        model_c = generic_c
    if not make:
        make_c = None
    if not model:
        model_c = None

    color, color_c = _read_attribute(color_raw, settings, warnings, "colour")
    body, body_c = _read_attribute(body_raw, settings, warnings, "body type")
    for value, label in ((conf_values["color"], "colour"), (conf_values["body"], "body type")):
        c = conf(value, label)
        if c is not None:
            if label == "colour":
                color_c = c
            else:
                body_c = c
    if color is None:
        color_c = None
    if body is None:
        body_c = None

    vehicle = {
        "id": vid,
        "make": make, "model": model,
        "makeConf": make_c, "modelConf": model_c,
        "color": color, "colorConf": color_c,
        "bodyType": body, "bodyTypeConf": body_c,
        "box": box,
        "features": _read_list(feat_raw, "features", warnings),
        "damage": _read_list(damage_raw, "damage", warnings),
    }
    extra = {k: v for k, v in raw.items() if k not in used}
    if extra:
        vehicle["extra"] = extra
    if not (make or model or color or body):
        warnings.append("no make, model, colour or body type found for this vehicle")
    return vehicle, warnings


def _find_vehicle_list(raw):
    if isinstance(raw, list):
        return raw, None
    if isinstance(raw, dict):
        key, value = _lookup(raw, VEHICLE_LIST_NAMES)
        if isinstance(value, list):
            return value, key
        if isinstance(value, dict):   # {"results": {"vehicles": [...]}}
            try:
                return _find_vehicle_list(value)[0], key
            except ValueError:
                pass
        # a single vehicle object
        if _lookup(raw, BOX_NAMES)[0] or _lookup(raw, MAKE_MODEL_NAMES)[0] or _lookup(raw, MAKE_NAMES)[0]:
            return [raw], None
    raise ValueError(
        "could not find a list of vehicles. Top-level fields are: "
        + (", ".join(sorted(map(str, raw))) if isinstance(raw, dict) else type(raw).__name__)
        + ". Expected one of: " + ", ".join(sorted(VEHICLE_LIST_NAMES)))


def adapt_file(raw, width, height, settings=None):
    """Convert a whole ML output. Returns {'vehicles', 'warnings', 'unused_fields'}."""
    settings = settings or SETTINGS
    items, list_key = _find_vehicle_list(raw)
    warnings, unused = [], []

    if isinstance(raw, dict):
        skip = {list_key} if list_key else set()
        unused += [k for k in raw if k not in skip and normalize_key(k) not in
                   {"imagewidth", "imageheight", "width", "height", "image", "filename", "file", "imagename", "imagepath"}]

    vehicles, seen = [], set()
    for i, item in enumerate(items, start=1):
        try:
            vehicle, warns = adapt_vehicle(item, width, height, settings)
        except ValueError as e:
            warnings.append(f"vehicle {i} skipped: {e}")
            continue
        warnings += [f"vehicle {i}: {w}" for w in warns]
        for k in vehicle.pop("extra", {}):
            if k not in unused:
                unused.append(k)
        vehicles.append(vehicle)

    ids = [v["id"] for v in vehicles]
    usable = all(isinstance(x, int) and not isinstance(x, bool) for x in ids) and len(set(ids)) == len(ids)
    if not usable:
        if any(x is not None for x in ids):
            warnings.append("vehicle ids were missing or not unique, renumbered 1, 2, 3")
        for n, v in enumerate(vehicles, start=1):
            v["id"] = n
    if not vehicles and items:
        warnings.append("every vehicle in this file was skipped")
    return {"vehicles": vehicles, "warnings": warnings, "unused_fields": unused}


def adapt_output(raw, width, height, settings=None):
    """Backward compatible: just the vehicles."""
    return adapt_file(raw, width, height, settings)["vehicles"]