import json
from functools import lru_cache
from pathlib import Path

import torch
from PIL import Image, ImageOps
from torch import nn
from torchvision import models, transforms
from ultralytics import YOLO

from vehicle_metadata_identification_using_machine_learning.config import MODELS_DIR


# ---------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------

CONFIG_DIR = MODELS_DIR / "config"

MAKE_MODEL_CHECKPOINT = (
    MODELS_DIR / "final_training" / "make_model" / "resnet50_final_best.pt"
)
BODY_TYPE_CHECKPOINT = (
    MODELS_DIR / "final_training" / "body_type" / "convnext_tiny_final_best.pt"
)
COLOUR_CHECKPOINT = (
    MODELS_DIR / "final_training" / "colour" / "swin_t_final_best.pt"
)
DAMAGE_CHECKPOINT = (
    MODELS_DIR / "final_training" / "damage" / "yolo11s_negative_aware_final.pt"
)

VEHICLE_DETECTOR_CHECKPOINT = MODELS_DIR / "detector" / "yolo11s.pt"

MAKE_MODEL_MAPPING = CONFIG_DIR / "final_make_model_class_to_id.json"
BODY_TYPE_MAPPING = CONFIG_DIR / "final_body_type_class_to_id.json"
COLOUR_MAPPING = CONFIG_DIR / "final_colour_class_to_id.json"
CONFIDENCE_CONFIG = CONFIG_DIR / "deployment_confidence_settings.json"


# COCO vehicle classes:
# 2 = car, 5 = bus, 7 = truck
VEHICLE_CLASS_IDS = {2, 5, 7}

VEHICLE_DETECTION_CONF = 0.25
DAMAGE_DETECTION_CONF = 0.25


# Same preprocessing used for final validation/test evaluation.
EVAL_TRANSFORM = transforms.Compose(
    [
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ]
)


def _load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _invert_mapping(mapping):
    return {int(class_id): label for label, class_id in mapping.items()}

def _pad_vehicle_crop(crop: Image.Image) -> Image.Image:
    return ImageOps.pad(
        crop,
        (256, 256),
        method=Image.Resampling.LANCZOS,
        color=(0, 0, 0),
        centering=(0.5, 0.5),
    )

class VehicleInferencePipeline:
    def __init__(self):
        self.device = torch.device(
            "cuda" if torch.cuda.is_available() else "cpu"
        )

        self.yolo_device = 0 if torch.cuda.is_available() else "cpu"

        # -------------------------------------------------------------
        # Class mappings
        # -------------------------------------------------------------

        self.make_model_labels = _invert_mapping(
            _load_json(MAKE_MODEL_MAPPING)
        )
        self.body_type_labels = _invert_mapping(
            _load_json(BODY_TYPE_MAPPING)
        )
        self.colour_labels = _invert_mapping(
            _load_json(COLOUR_MAPPING)
        )

        self.confidence_settings = _load_json(CONFIDENCE_CONFIG)

        # -------------------------------------------------------------
        # Make/model - ResNet50
        # -------------------------------------------------------------

        self.make_model_model = models.resnet50(weights=None)
        self.make_model_model.fc = nn.Linear(
            self.make_model_model.fc.in_features,
            1102,
        )

        checkpoint = torch.load(
            MAKE_MODEL_CHECKPOINT,
            map_location=self.device,
            weights_only=False,
        )

        self.make_model_model.load_state_dict(
            checkpoint["model_state_dict"]
        )

        self.make_model_model.to(self.device)
        self.make_model_model.eval()

        # -------------------------------------------------------------
        # Body type - ConvNeXt Tiny
        # -------------------------------------------------------------

        self.body_type_model = models.convnext_tiny(weights=None)
        self.body_type_model.classifier[2] = nn.Linear(
            self.body_type_model.classifier[2].in_features,
            12,
        )

        checkpoint = torch.load(
            BODY_TYPE_CHECKPOINT,
            map_location=self.device,
            weights_only=False,
        )

        self.body_type_model.load_state_dict(
            checkpoint["model_state_dict"]
        )

        self.body_type_model.to(self.device)
        self.body_type_model.eval()

        # -------------------------------------------------------------
        # Colour - Swin-T
        # -------------------------------------------------------------

        self.colour_model = models.swin_t(weights=None)
        self.colour_model.head = nn.Linear(
            self.colour_model.head.in_features,
            10,
        )

        checkpoint = torch.load(
            COLOUR_CHECKPOINT,
            map_location=self.device,
            weights_only=False,
        )

        self.colour_model.load_state_dict(
            checkpoint["model_state_dict"]
        )

        self.colour_model.to(self.device)
        self.colour_model.eval()

        # -------------------------------------------------------------
        # YOLO models
        # -------------------------------------------------------------

        self.vehicle_detector = YOLO(
            str(VEHICLE_DETECTOR_CHECKPOINT)
        )

        self.damage_detector = YOLO(
            str(DAMAGE_CHECKPOINT)
        )

    def _classify(
        self,
        image: Image.Image,
        model,
        labels,
        task_name,
    ):
        tensor = EVAL_TRANSFORM(image).unsqueeze(0).to(self.device)

        with torch.inference_mode():
            logits = model(tensor)

        settings = self.confidence_settings[task_name]

        temperature = float(settings["temperature"])
        threshold = float(settings["confidence_threshold"])

        calibrated_logits = logits / temperature

        probabilities = torch.softmax(
            calibrated_logits,
            dim=1,
        )

        confidence, predicted_id = torch.max(
            probabilities,
            dim=1,
        )

        confidence = float(confidence.item())
        predicted_id = int(predicted_id.item())

        label = labels[predicted_id]

        if confidence < threshold:
            return None, confidence

        return label, confidence

    def _classify_vehicle(self, crop):
        make_model_label, make_model_conf = self._classify(
            crop,
            self.make_model_model,
            self.make_model_labels,
            "make_model",
        )

        body_label, body_conf = self._classify(
            crop,
            self.body_type_model,
            self.body_type_labels,
            "body_type",
        )

        colour_label, colour_conf = self._classify(
            crop,
            self.colour_model,
            self.colour_labels,
            "colour",
        )

        make = None
        model = None

        if make_model_label:
            if " || " in make_model_label:
                make, model = make_model_label.split(
                    " || ",
                    1,
                )
            else:
                make = make_model_label

        return {
            "make": make,
            "model": model,
            "make_confidence": (
                make_model_conf if make else None
            ),
            "model_confidence": (
                make_model_conf if model else None
            ),
            "body_type": (
                {
                    "label": body_label,
                    "confidence": body_conf,
                }
                if body_label
                else None
            ),
            "colour": (
                {
                    "label": colour_label,
                    "confidence": colour_conf,
                }
                if colour_label
                else None
            ),
        }

    def _detect_damage(
        self,
        crop,
        vehicle_x1,
        vehicle_y1,
    ):
        results = self.damage_detector.predict(
            source=crop,
            conf=DAMAGE_DETECTION_CONF,
            device=self.yolo_device,
            verbose=False,
        )

        detections = []

        if not results:
            return detections

        result = results[0]

        if result.boxes is None:
            return detections

        for box in result.boxes:
            xyxy = box.xyxy[0].detach().cpu().tolist()

            x1, y1, x2, y2 = xyxy

            # Convert crop-relative damage coordinates back to
            # original image coordinates.
            x1 += vehicle_x1
            x2 += vehicle_x1
            y1 += vehicle_y1
            y2 += vehicle_y1

            class_id = int(box.cls[0].item())
            confidence = float(box.conf[0].item())

            label = result.names[class_id]

            detections.append(
                {
                    "class": label,
                    "confidence": confidence,
                    "bbox": [
                        x1,
                        y1,
                        x2,
                        y2,
                    ],
                }
            )

        return detections

    def predict(self, image: Image.Image):
        image = image.convert("RGB")

        results = self.vehicle_detector.predict(
            source=image,
            conf=VEHICLE_DETECTION_CONF,
            device=self.yolo_device,
            verbose=False,
        )

        if not results:
            return {"vehicles": []}

        result = results[0]

        if result.boxes is None:
            return {"vehicles": []}

        detected_vehicles = []

        for box in result.boxes:
            class_id = int(box.cls[0].item())

            if class_id not in VEHICLE_CLASS_IDS:
                continue

            x1, y1, x2, y2 = (
                box.xyxy[0]
                .detach()
                .cpu()
                .tolist()
            )

            # Ensure safe integer crop coordinates.
            x1 = max(0, int(round(x1)))
            y1 = max(0, int(round(y1)))
            x2 = min(image.width, int(round(x2)))
            y2 = min(image.height, int(round(y2)))

            if x2 <= x1 or y2 <= y1:
                continue

            detected_vehicles.append(
                (x1, y1, x2, y2)
            )

        # Stable ordering from left to right.
        detected_vehicles.sort(
            key=lambda b: (b[0], b[1])
        )

        vehicles = []

        for vehicle_id, (x1, y1, x2, y2) in enumerate(
            detected_vehicles,
            start=1,
        ):
            crop = image.crop(
                (x1, y1, x2, y2)
            )

            classification_crop = _pad_vehicle_crop(crop)

            attributes = self._classify_vehicle(
                classification_crop
            )

            damage = self._detect_damage(
                crop,
                x1,
                y1,
            )

            vehicles.append(
                {
                    "vehicle_id": vehicle_id,
                    "bounding_box": [
                        x1,
                        y1,
                        x2,
                        y2,
                    ],
                    **attributes,
                    "damage": damage,
                }
            )

        return {
            "vehicles": vehicles,
        }


@lru_cache(maxsize=1)
def get_pipeline():
    """
    Load all models once and reuse them for every request.
    """
    return VehicleInferencePipeline()


def predict_image(image: Image.Image):
    return get_pipeline().predict(image)