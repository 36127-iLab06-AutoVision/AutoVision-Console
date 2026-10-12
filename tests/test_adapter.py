import pytest

from vehicle_metadata_identification_using_machine_learning.adapter import (
    adapt_file, adapt_output, adapt_vehicle, box_to_percent, split_make_model, to_confidence,
)

W, H = 1280, 720


def test_split_known_make():
    assert split_make_model("Toyota Camry") == ("Toyota", "Camry")
    assert split_make_model("Land Rover Defender") == ("Land Rover", "Defender")


def test_split_unknown_make_and_single_word():
    assert split_make_model("Zeekr 001") == ("Zeekr", "001")
    assert split_make_model("Toyota") == ("Toyota", None)


def test_original_ml_sample():
    raw = {"vehicles": [
        {"vehicle_id": 1, "bounding_box": [120, 80, 640, 470], "make_model": "Toyota Camry", "confidence": 0.91},
        {"vehicle_id": 2, "bounding_box": [710, 100, 1100, 430], "make_model": "BMW X5", "confidence": 0.87}]}
    r = adapt_file(raw, W, H)
    v = r["vehicles"]
    assert [x["id"] for x in v] == [1, 2]
    assert (v[0]["make"], v[0]["model"], v[0]["makeConf"], v[0]["modelConf"]) == ("Toyota", "Camry", 0.91, 0.91)
    assert v[0]["box"] == {"x": 9.38, "y": 11.11, "w": 40.62, "h": 54.17}
    assert v[0]["color"] is None and v[0]["colorConf"] is None
    assert r["warnings"] == [] and r["unused_fields"] == []


def test_adapt_output_returns_list():
    assert len(adapt_output([{"bbox": [0, 0, 100, 100], "make_model": "Kia Rio", "score": 0.5}], W, H)) == 1


@pytest.mark.parametrize("key", ["detections", "predictions", "results", "Vehicles", "objects"])
def test_alternate_list_names(key):
    r = adapt_file({key: [{"bbox": [0, 0, 100, 100], "make_model": "Kia Rio", "score": 0.5}]}, W, H)
    assert len(r["vehicles"]) == 1


def test_top_level_list_and_single_object():
    item = {"bbox": [0, 0, 100, 100], "make_model": "Kia Rio", "score": 0.5}
    assert len(adapt_file([item], W, H)["vehicles"]) == 1
    assert len(adapt_file(item, W, H)["vehicles"]) == 1


def test_unknown_layout_explains_itself():
    with pytest.raises(ValueError, match="Top-level fields are: foo"):
        adapt_file({"foo": 1}, W, H)


@pytest.mark.parametrize("box,settings", [
    ([100, 100, 500, 400], {}),
    ({"x1": 100, "y1": 100, "x2": 500, "y2": 400}, {}),
    ({"xmin": 100, "ymin": 100, "xmax": 500, "ymax": 400}, {}),
    ({"left": 100, "top": 100, "right": 500, "bottom": 400}, {}),
    ([100, 100, 400, 300], {"box_format": "xywh"}),
    ({"x": 100, "y": 100, "width": 400, "height": 300}, {}),
    ({"left": 100, "top": 100, "width": 400, "height": 300}, {}),
    ([300, 250, 400, 300], {"box_format": "cxcywh"}),
    ({"cx": 300, "cy": 250, "w": 400, "h": 300}, {}),
    ([100 / W, 100 / H, 500 / W, 400 / H], {}),                       # normalised, auto
    ([100 / W * 100, 100 / H * 100, 500 / W * 100, 400 / H * 100], {"box_units": "percent"}),
    ([100, 100, 500, 100, 500, 400, 100, 400], {}),                   # polygon
])
def test_box_layouts_all_give_same_result(box, settings):
    from vehicle_metadata_identification_using_machine_learning.adapter import SETTINGS
    s = {**SETTINGS, **settings}
    b = box_to_percent(box, W, H, s)
    assert b["x"] == pytest.approx(7.81, abs=0.02)
    assert b["y"] == pytest.approx(13.89, abs=0.02)
    assert b["w"] == pytest.approx(31.25, abs=0.02)
    assert b["h"] == pytest.approx(41.67, abs=0.02)


def test_box_outside_image_rejected_with_hint():
    with pytest.raises(ValueError, match="box_format"):
        box_to_percent([100, 100, 5000, 400], W, H)


def test_box_wrong_layout_rejected():
    with pytest.raises(ValueError):
        box_to_percent([500, 400, 100, 100], W, H)


def test_box_slightly_outside_is_trimmed():
    v, warns = adapt_vehicle({"bbox": [-1, 0, 1281, 720], "make": "Kia"}, W, H)
    assert v["box"]["x"] == 0 and v["box"]["w"] == 100
    assert any("trimmed" in w for w in warns)


def test_percent_confidence():
    assert to_confidence(91, {"confidence_scale": "percent"}) == 0.91
    assert to_confidence("91%", {"confidence_scale": "fraction"}) == 0.91
    with pytest.raises(ValueError, match="confidence_scale"):
        to_confidence(91, {"confidence_scale": "fraction"})


def test_bad_confidence_becomes_warning_not_crash():
    v, warns = adapt_vehicle({"bbox": [0, 0, 100, 100], "make_model": "Kia Rio", "confidence": 91}, W, H)
    assert v["makeConf"] is None
    assert any("confidence_scale" in w for w in warns)


def test_separate_make_model_with_own_scores():
    v, _ = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Ford", "make_confidence": 0.9,
                          "model": "Ranger", "model_confidence": 0.6}, W, H)
    assert (v["make"], v["model"], v["makeConf"], v["modelConf"]) == ("Ford", "Ranger", 0.9, 0.6)


def test_separate_fields_win_over_combined():
    v, warns = adapt_vehicle({"bbox": [0, 0, 100, 100], "make_model": "Toyota Camry",
                              "make": "Ford", "model": "Ranger", "confidence": 0.8}, W, H)
    assert (v["make"], v["model"]) == ("Ford", "Ranger")
    assert any("both" in w for w in warns)


def test_nested_attributes_with_scores():
    v, _ = adapt_vehicle({"bbox": [0, 0, 100, 100],
                          "make_model": {"label": "BMW X5", "confidence": 0.7},
                          "colour": {"name": "Red", "score": 0.82},
                          "body_type": {"value": "SUV", "probability": 0.66}}, W, H)
    assert (v["make"], v["model"], v["makeConf"]) == ("BMW", "X5", 0.7)
    assert (v["color"], v["colorConf"], v["bodyType"], v["bodyTypeConf"]) == ("Red", 0.82, "SUV", 0.66)


def test_colour_as_plain_string_has_no_score():
    v, _ = adapt_vehicle({"bbox": [0, 0, 100, 100], "make_model": "Kia Rio", "confidence": 0.9, "color": "Blue"}, W, H)
    assert v["color"] == "Blue" and v["colorConf"] is None


def test_null_versus_empty_list():
    v, _ = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Kia", "damage": None}, W, H)
    assert v["damage"] is None
    v, _ = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Kia", "damage": []}, W, H)
    assert v["damage"] == []
    v, _ = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Kia"}, W, H)
    assert v["damage"] is None and v["features"] is None


def test_damage_as_strings_becomes_findings():
    v, _ = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Kia", "damage": [{"label": "dent"}, "scratch"]}, W, H)
    assert [d["label"] for d in v["damage"]] == ["dent", "scratch"]
    assert all(d["confidence"] is None and d["box"] is None for d in v["damage"])


def test_damage_detector_output_keeps_class_score_and_box():
    raw = {"bbox": [0, 0, 1280, 720], "make": "Kia", "damage": [
        {"class": "dent", "confidence": 0.82, "bbox": [128, 72, 384, 216]},
        {"label": "scratch", "score": 0.55, "box": {"x1": 640, "y1": 360, "x2": 768, "y2": 432}}]}
    v, warns = adapt_vehicle(raw, W, H)
    d0, d1 = v["damage"]
    assert (d0["label"], d0["confidence"]) == ("dent", 0.82)
    assert d0["box"] == {"x": 10.0, "y": 10.0, "w": 20.0, "h": 20.0}
    assert (d1["label"], d1["confidence"]) == ("scratch", 0.55)
    assert d1["box"] == {"x": 50.0, "y": 50.0, "w": 10.0, "h": 10.0}
    assert warns == []


def test_damage_empty_list_means_checked_none_found():
    v, _ = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Kia", "damage": []}, W, H)
    assert v["damage"] == []


def test_damage_bad_box_is_dropped_but_finding_kept():
    v, warns = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Kia",
                              "damage": [{"class": "dent", "confidence": 0.8, "bbox": [0, 0, 9999, 50]}]}, W, H)
    assert v["damage"][0]["label"] == "dent" and v["damage"][0]["box"] is None
    assert any("box ignored" in w for w in warns)


def test_damage_bad_confidence_is_warning():
    v, warns = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Kia",
                              "damage": [{"class": "dent", "confidence": 82, "bbox": [0, 0, 50, 50]}]}, W, H)
    assert v["damage"][0]["confidence"] is None
    assert any("confidence_scale" in w for w in warns)


def test_damage_severity_is_kept_and_missing_class_is_labelled():
    v, warns = adapt_vehicle({"bbox": [0, 0, 100, 100], "make": "Kia",
                              "damage": [{"severity": "minor", "confidence": 0.7, "bbox": [0, 0, 50, 50]}]}, W, H)
    assert v["damage"][0]["label"] == "Damage" and v["damage"][0]["severity"] == "minor"
    assert any("no damage type" in w for w in warns)


def test_missing_box_is_warning():
    v, warns = adapt_vehicle({"make_model": "Kia Rio", "confidence": 0.5}, W, H)
    assert v["box"] is None and any("bounding box" in w for w in warns)


def test_missing_ids_are_renumbered():
    r = adapt_file({"vehicles": [{"bbox": [0, 0, 50, 50], "make": "A"}, {"bbox": [60, 0, 100, 50], "make": "B"}]}, W, H)
    assert [v["id"] for v in r["vehicles"]] == [1, 2]


def test_duplicate_ids_are_renumbered_with_warning():
    r = adapt_file({"vehicles": [{"id": 7, "bbox": [0, 0, 50, 50], "make": "A"},
                                 {"id": 7, "bbox": [60, 0, 100, 50], "make": "B"}]}, W, H)
    assert [v["id"] for v in r["vehicles"]] == [1, 2]
    assert any("renumbered" in w for w in r["warnings"])


def test_bad_vehicle_skipped_others_kept():
    r = adapt_file({"vehicles": [{"bbox": [0, 0, 5000, 50], "make": "A"}, {"bbox": [0, 0, 50, 50], "make": "B"}]}, W, H)
    assert len(r["vehicles"]) == 1 and r["vehicles"][0]["make"] == "B"
    assert any("skipped" in w for w in r["warnings"])


def test_unused_fields_reported():
    r = adapt_file({"model_version": "v2", "vehicles": [{"bbox": [0, 0, 50, 50], "make": "A", "plate": "ABC123"}]}, W, H)
    assert "plate" in r["unused_fields"] and "model_version" in r["unused_fields"]


def test_no_vehicles_is_fine():
    assert adapt_file({"vehicles": []}, W, H)["vehicles"] == []


def test_a_small_damage_box_does_not_trigger_the_tiny_box_warning():
    raw = {"vehicle_id": 1, "bounding_box": [100, 50, 500, 350], "make_model": "Toyota Hilux",
           "damage": [{"class": "scratch", "confidence": 0.46, "bbox": [300, 200, 320, 212]}]}
    vehicle, warnings = adapt_vehicle(raw, 800, 400)
    assert vehicle["damage"][0]["box"] is not None
    assert not any("under 0.5%" in w for w in warnings)


def test_a_tiny_vehicle_box_still_triggers_the_warning():
    raw = {"vehicle_id": 1, "bounding_box": [100, 50, 110, 58], "make_model": "Toyota Hilux"}
    _, warnings = adapt_vehicle(raw, 800, 400)
    assert any("under 0.5%" in w for w in warnings)