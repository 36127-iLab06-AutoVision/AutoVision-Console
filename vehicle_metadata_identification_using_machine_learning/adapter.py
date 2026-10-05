"""Convert raw model output into the review console's format."""

# Longest names first, so multi-word makes match before single-word ones.
KNOWN_MAKES = sorted(
    ["Toyota", "Ford", "Mazda", "Holden", "Subaru", "Nissan", "BMW",
     "Land Rover", "Alfa Romeo", "Mercedes-Benz"],
    key=len,
    reverse=True,
)


def split_make_model(make_model: str) -> tuple[str, str]:
    """'Toyota Camry' -> ('Toyota', 'Camry'). Handles multi-word makes."""
    text = make_model.strip()
    for make in KNOWN_MAKES:
        if text.lower().startswith(make.lower() + " "):
            return make, text[len(make):].strip()
    parts = text.split(" ", 1)
    return parts[0], (parts[1] if len(parts) > 1 else "")


def box_to_percent(box, image_width: int, image_height: int) -> dict:
    """[x1, y1, x2, y2] in pixels -> x/y/w/h as percentages of the image.

    ASSUMPTION: the model gives corner coordinates. Confirm with the ML team.
    """
    x1, y1, x2, y2 = box
    if x2 <= x1 or y2 <= y1:
        raise ValueError(f"Invalid box {box}: needs x2 > x1 and y2 > y1")
    if x2 > image_width or y2 > image_height:
        raise ValueError(f"Box {box} extends outside a {image_width}x{image_height} image")
    return {
        "x": round(x1 / image_width * 100, 2),
        "y": round(y1 / image_height * 100, 2),
        "w": round((x2 - x1) / image_width * 100, 2),
        "h": round((y2 - y1) / image_height * 100, 2),
    }


def adapt_vehicle(vehicle: dict, image_width: int, image_height: int) -> dict:
    confidence = vehicle["confidence"]
    if not 0 <= confidence <= 1:
        raise ValueError(f"Confidence {confidence} must be between 0 and 1")

    make, model = split_make_model(vehicle["make_model"])
    return {
        "id": vehicle["vehicle_id"],
        "make": make,
        "model": model,
        # The model gives one score for make+model together, so both share it.
        "makeConf": confidence,
        "modelConf": confidence,
        # Not produced by the model yet. None means "not available", not zero.
        "color": None,
        "colorConf": None,
        "bodyType": None,
        "bodyTypeConf": None,
        "box": box_to_percent(vehicle["bounding_box"], image_width, image_height),
        "features": [],
        "damage": [],
    }


def adapt_output(raw: dict, image_width: int, image_height: int) -> list[dict]:
    """Convert one model output file into a list of vehicles."""
    return [adapt_vehicle(v, image_width, image_height) for v in raw.get("vehicles", [])]