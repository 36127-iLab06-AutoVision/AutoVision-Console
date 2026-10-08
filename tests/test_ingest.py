import json

from PIL import Image

from vehicle_metadata_identification_using_machine_learning.ingest import build_capture, main, read_camera, read_time


def make_pair(folder, name, data, size=(1280, 720)):
    Image.new("RGB", size, (90, 90, 90)).save(folder / f"{name}.jpg")
    (folder / f"{name}.json").write_text(json.dumps(data))
    return folder / f"{name}.json"


VEHICLE = {"bbox": [100, 100, 500, 400], "make_model": "Kia Rio", "confidence": 0.8}


def test_camera_and_time_are_read_from_the_file(tmp_path):
    path = make_pair(tmp_path, "a", {"camera": "Toll Gantry 4B", "time": "14:02:11", "vehicles": [VEHICLE]})
    capture, _, warnings, unused = build_capture(path)
    assert capture["camera"] == "Toll Gantry 4B"
    assert capture["time"] == "14:02:11"
    assert capture["id"] == "a"
    assert unused == []


def test_other_names_for_camera_and_time(tmp_path):
    path = make_pair(tmp_path, "b", {"camera_id": "CAM-7", "timestamp": 1760000000, "vehicles": [VEHICLE]})
    capture, *_ = build_capture(path)
    assert capture["camera"] == "CAM-7"
    assert capture["time"].startswith("2025-")


def test_defaults_when_the_file_has_no_camera_or_time(tmp_path):
    path = make_pair(tmp_path, "c", {"vehicles": [VEHICLE]})
    capture, *_ = build_capture(path)
    assert capture["camera"] == "Imported file"
    assert capture["time"]


def test_read_helpers_ignore_junk():
    assert read_camera({"camera": ""}) is None
    assert read_camera({"camera": {"x": 1}}) is None
    assert read_time({"time": True}) is None
    assert read_time([]) is None


def test_bad_files_are_skipped_and_good_ones_kept(tmp_path):
    raw, out = tmp_path / "raw", tmp_path / "out"
    raw.mkdir()
    make_pair(raw, "good", {"vehicles": [VEHICLE]})
    (raw / "bad.json").write_text("{oops")
    Image.new("RGB", (10, 10)).save(raw / "bad.jpg")
    make_pair(raw, "weird", {"hello": 1})
    report = main(raw_dir=raw, out_dir=out)
    status = {r["file"]: r["status"] for r in report}
    assert status == {"bad.json": "skipped", "good.json": "ok", "weird.json": "skipped"}
    assert len(json.loads((out / "captures.json").read_text())) == 1
    assert (out / "images" / "good.jpg").exists()