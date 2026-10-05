import pytest

from vehicle_metadata_identification_using_machine_learning.adapter import (
    adapt_output,
    box_to_percent,
    split_make_model,
)

SAMPLE = {
    "vehicles": [
        {"vehicle_id": 1, "bounding_box": [120, 80, 640, 470], "make_model": "Toyota Camry", "confidence": 0.91},
        {"vehicle_id": 2, "bounding_box": [710, 100, 1100, 430], "make_model": "BMW X5", "confidence": 0.87},
    ]
}


def test_sample_converts():
    out = adapt_output(SAMPLE, 1280, 720)
    assert len(out) == 2
    assert (out[0]["make"], out[0]["model"]) == ("Toyota", "Camry")
    assert (out[1]["make"], out[1]["model"]) == ("BMW", "X5")
    assert out[0]["box"] == {"x": 9.38, "y": 11.11, "w": 40.62, "h": 54.17}
    assert out[0]["color"] is None


def test_multiword_make():
    assert split_make_model("Land Rover Defender") == ("Land Rover", "Defender")


def test_unknown_make_falls_back_to_first_word():
    assert split_make_model("Tesla Model 3") == ("Tesla", "Model 3")


def test_no_vehicles():
    assert adapt_output({"vehicles": []}, 1280, 720) == []


def test_bad_box_rejected():
    with pytest.raises(ValueError):
        box_to_percent([640, 470, 120, 80], 1280, 720)


def test_box_outside_image_rejected():
    with pytest.raises(ValueError):
        box_to_percent([120, 80, 2000, 470], 1280, 720)


def test_bad_confidence_rejected():
    bad = {"vehicles": [{"vehicle_id": 1, "bounding_box": [1, 1, 5, 5], "make_model": "Ford Ranger", "confidence": 91}]}
    with pytest.raises(ValueError):
        adapt_output(bad, 1280, 720)