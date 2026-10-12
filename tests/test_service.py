import base64
import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from vehicle_metadata_identification_using_machine_learning import service

client = TestClient(service.app)


def data_url(fmt="JPEG", size=(1000, 500)):
    buf = io.BytesIO()
    Image.new("RGB", size, "grey").save(buf, fmt)
    mime = "image/jpeg" if fmt == "JPEG" else "image/png"
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode()


def test_no_model_files_gives_501_with_a_clear_message(monkeypatch, tmp_path):
    monkeypatch.delenv("DEMO_MODEL", raising=False)
    monkeypatch.setenv("MODELS_DIR", str(tmp_path))
    r = client.post("/analyze", json={"image": data_url()})
    assert r.status_code == 501
    assert "MODELS_DIR" in r.json()["detail"]


def test_demo_mode_returns_vehicles_scaled_to_the_image_and_says_it_is_fake(monkeypatch):
    monkeypatch.setenv("DEMO_MODEL", "1")
    r = client.post("/analyze", json={"image": data_url(size=(1000, 500))})
    assert r.status_code == 200
    body = r.json()
    assert len(body["vehicles"]) == 2
    assert body["warnings"][0].startswith("DEMO MODE")
    box = body["vehicles"][0]["box"]
    assert box == {"x": 10.0, "y": 15.0, "w": 45.0, "h": 65.0}
    assert body["vehicles"][0]["damage"][0]["label"] == "dent"
    assert body["vehicles"][1]["damage"] == []


def test_a_real_model_output_is_converted_by_the_adapter(monkeypatch):
    monkeypatch.delenv("DEMO_MODEL", raising=False)
    monkeypatch.setattr(service, "run_model", lambda image: [
        {"id": 7, "bbox": [100, 50, 600, 450], "make": "Ford", "model": "Ranger", "make_confidence": 0.9, "model_confidence": 0.8}
    ])
    r = client.post("/analyze", json={"image": data_url(size=(1000, 500))})
    assert r.status_code == 200
    v = r.json()["vehicles"][0]
    assert (v["make"], v["model"], v["makeConf"], v["modelConf"]) == ("Ford", "Ranger", 0.9, 0.8)
    assert v["box"]["x"] == 10.0


def test_a_model_that_finds_nothing_returns_an_empty_list(monkeypatch):
    monkeypatch.delenv("DEMO_MODEL", raising=False)
    monkeypatch.setattr(service, "run_model", lambda image: {"vehicles": []})
    r = client.post("/analyze", json={"image": data_url()})
    assert r.status_code == 200
    assert r.json()["vehicles"] == []


def test_a_crashing_model_gives_500_with_the_reason(monkeypatch):
    monkeypatch.delenv("DEMO_MODEL", raising=False)
    def boom(image):
        raise RuntimeError("out of memory")
    monkeypatch.setattr(service, "run_model", boom)
    r = client.post("/analyze", json={"image": data_url()})
    assert r.status_code == 500
    assert "out of memory" in r.json()["detail"]


def test_output_the_adapter_cannot_find_vehicles_in_gives_502(monkeypatch):
    monkeypatch.delenv("DEMO_MODEL", raising=False)
    monkeypatch.setattr(service, "run_model", lambda image: {"hello": "world"})
    r = client.post("/analyze", json={"image": data_url()})
    assert r.status_code == 502


@pytest.mark.parametrize("bad", [
    "hello",
    "data:image/png;base64,@@@@",
    "data:image/png;base64,AAAA",
    "data:text/plain;base64,aGk=",
])
def test_bad_images_are_rejected_before_the_model_runs(bad, monkeypatch):
    def must_not_run(image):
        raise AssertionError("model should not run")
    monkeypatch.setattr(service, "run_model", must_not_run)
    r = client.post("/analyze", json={"image": bad})
    assert r.status_code == 400


def test_png_images_work(monkeypatch):
    monkeypatch.setenv("DEMO_MODEL", "1")
    assert client.post("/analyze", json={"image": data_url("PNG")}).status_code == 200


def test_health_reports_demo_mode(monkeypatch):
    monkeypatch.setenv("DEMO_MODEL", "1")
    assert client.get("/health").json() == {"ok": True, "demo": True}