import json

import pytest
from PIL import Image

from vehicle_metadata_identification_using_machine_learning import models
from vehicle_metadata_identification_using_machine_learning.adapter import SETTINGS, adapt_file


def fake_pipeline(boxes, damage=None):
    return models.Pipeline(
        detector=lambda img: boxes,
        make_model=lambda crop: ("Toyota || Toyota Camry", 0.9),
        body_type=lambda crop: ("Sedan", 0.8),
        colour=lambda crop: ("White", 0.7),
        damage=damage or (lambda crop: []),
    )


def test_class_file_name_to_id(tmp_path):
    p = tmp_path / "c.json"
    p.write_text(json.dumps({"Sedan": 1, "SUV": 0}))
    assert models.class_names_from_file(p) == ["SUV", "Sedan"]


def test_class_file_id_to_name(tmp_path):
    p = tmp_path / "c.json"
    p.write_text(json.dumps({"0": "Red", "1": "Blue"}))
    assert models.class_names_from_file(p) == ["Red", "Blue"]


def test_class_file_with_gaps_is_rejected(tmp_path):
    p = tmp_path / "c.json"
    p.write_text(json.dumps({"Red": 0, "Blue": 2}))
    with pytest.raises(ValueError):
        models.class_names_from_file(p)


def test_split_make_model_label():
    f = models.split_make_model_label
    assert f("Toyota || Toyota Hilux") == ("Toyota", "Hilux")
    assert f("Hyundai || Wagon") == ("Hyundai", "Wagon")
    assert f("Land Rover || Defender") == ("Land Rover", "Defender")
    assert f("Mazda || Mazda") == ("Mazda", "Mazda")
    assert f("Ford Falcon") == (None, "Ford Falcon")


def test_sentence_case():
    assert models.sentence_case("black") == "Black"
    assert models.sentence_case("MPV") == "MPV"
    assert models.sentence_case("lamp_broken") == "Lamp broken"


def test_clean_label():
    assert models.clean_label("lamp_broken") == "lamp broken"
    assert models.clean_label("  glass   shatter ") == "glass shatter"


def test_padded_crop_stays_inside_image():
    box = models.padded_crop_box((-5, -5, 500, 300), 400, 200, padding=0.1)
    assert box[0] == 0 and box[1] == 0 and box[2] == 400 and box[3] == 200


def test_pipeline_builds_one_vehicle_per_detection():
    image = Image.new("RGB", (800, 400))
    out = fake_pipeline([([400, 50, 700, 350], 0.8), ([20, 60, 300, 360], 0.9)]).run(image)
    assert [v["vehicle_id"] for v in out["vehicles"]] == [1, 2]
    assert out["vehicles"][0]["bounding_box"][0] == 20.0  # left to right
    assert out["vehicles"][0]["make"] == {"label": "Toyota", "confidence": 0.9}
    assert out["vehicles"][0]["model"] == {"label": "Camry", "confidence": 0.9}
    assert out["vehicles"][0]["damage"] == []  # checked, none found


def test_damage_is_given_to_the_vehicle_that_contains_it():
    image = Image.new("RGB", (800, 400))
    pipe = fake_pipeline([([20, 50, 300, 350], 0.9), ([400, 50, 780, 350], 0.8)],
                         damage=lambda img: [("dent", 0.77, [450, 120, 520, 180])])
    out = pipe.run(image)["vehicles"]
    assert out[0]["damage"] == []  # checked, none found on the left vehicle
    d = out[1]["damage"][0]
    assert d["bbox"] == [450, 120, 520, 180]  # already in whole-image pixels
    assert d["class"] == "Dent"


def test_damage_outside_every_vehicle_is_not_shown():
    image = Image.new("RGB", (800, 400))
    pipe = fake_pipeline([([100, 50, 300, 350], 0.9)],
                         damage=lambda img: [("scratch", 0.9, [600, 10, 700, 60])])
    assert pipe.run(image)["vehicles"][0]["damage"] == []


def test_overlapping_vehicles_give_damage_to_the_smaller_box():
    owner = models.owner_of_damage([140, 140, 160, 160], [(0, 0, 400, 400), (100, 100, 200, 200)])
    assert owner == 1
    assert models.owner_of_damage([500, 500, 520, 520], [(0, 0, 400, 400)]) is None


def test_tiny_detections_are_ignored():
    image = Image.new("RGB", (800, 400))
    out = fake_pipeline([([10, 10, 30, 25], 0.9)]).run(image)
    assert out["vehicles"] == []


def test_at_most_ten_vehicles_keeping_the_most_confident():
    image = Image.new("RGB", (2000, 400))
    boxes = [([i * 150 + 5, 50, i * 150 + 140, 350], 0.5 + i * 0.01) for i in range(12)]
    out = fake_pipeline(boxes).run(image)
    assert len(out["vehicles"]) == 10
    assert out["vehicles"][0]["bounding_box"][0] == 305.0  # the two weakest (x=5,155) were dropped


def test_output_is_readable_by_the_adapter_without_warnings():
    image = Image.new("RGB", (800, 400))
    pipe = fake_pipeline([([100, 50, 500, 350], 0.9)],
                         damage=lambda img: [("lamp_broken", 0.6, [150, 100, 200, 150])])
    raw = pipe.run(image)
    result = adapt_file(raw, image.width, image.height, SETTINGS)
    assert result["warnings"] == []
    v = result["vehicles"][0]
    assert v["make"] == "Toyota" and v["model"] == "Camry" and v["makeConf"] == 0.9
    assert v["damage"][0]["label"] == "Lamp broken"
    assert v["damage"][0]["box"] is not None


def test_no_vehicles_gives_an_empty_list():
    image = Image.new("RGB", (800, 400))
    assert fake_pipeline([]).run(image) == {"vehicles": []}


def test_missing_model_files_say_where_to_look(tmp_path, monkeypatch):
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    with pytest.raises(NotImplementedError, match="MODELS_DIR"):
        models.load_pipeline()