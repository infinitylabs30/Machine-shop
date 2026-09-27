import base64
import json
import os

import cv2
import numpy as np
from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)


MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

FACE_DETECTOR = os.path.join(
    MODEL_DIR,
    "face_detection_yunet_2023mar.onnx"
)

FACE_RECOGNIZER = os.path.join(
    MODEL_DIR,
    "face_recognition_sface_2021dec.onnx"
)


detector = None
recognizer = None


def initialize_models():
    global detector
    global recognizer

    if not os.path.exists(FACE_DETECTOR):
        raise RuntimeError(
            f"Missing face detector model: {FACE_DETECTOR}"
        )

    if not os.path.exists(FACE_RECOGNIZER):
        raise RuntimeError(
            f"Missing face recognizer model: {FACE_RECOGNIZER}"
        )

    detector = cv2.FaceDetectorYN.create(
        FACE_DETECTOR,
        "",
        (320, 320),
        0.85,
        0.3,
        5000
    )

    recognizer = cv2.FaceRecognizerSF.create(
        FACE_RECOGNIZER,
        ""
    )


def decode_image(image_base64):
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    raw = base64.b64decode(image_base64)

    image_array = np.frombuffer(
        raw,
        dtype=np.uint8
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR
    )

    if image is None:
        raise ValueError("Invalid image")

    return image


def detect_single_face(image):
    height, width = image.shape[:2]

    detector.setInputSize((width, height))

    _, faces = detector.detect(image)

    if faces is None:
        raise ValueError("No face detected")

    if len(faces) != 1:
        raise ValueError(
            f"Expected exactly one face, found {len(faces)}"
        )

    return faces[0]


def create_feature(image):
    face = detect_single_face(image)

    aligned = recognizer.alignCrop(
        image,
        face
    )

    feature = recognizer.feature(
        aligned
    )

    return feature


def cosine_similarity(feature1, feature2):
    return float(
        recognizer.match(
            feature1,
            feature2,
            cv2.FaceRecognizerSF_FR_COSINE
        )
    )


@app.get("/health")
def health():
    return jsonify({
        "success": True,
        "service": "face-service"
    })


@app.post("/register")
def register():
    try:
        data = request.get_json()

        image = decode_image(
            data["image"]
        )

        feature = create_feature(image)

        embedding = feature.flatten().tolist()

        return jsonify({
            "success": True,
            "embedding": embedding
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400


@app.post("/verify")
def verify():
    try:
        data = request.get_json()

        image = decode_image(
            data["image"]
        )

        stored_embedding = np.array(
            data["embedding"],
            dtype=np.float32
        ).reshape(1, -1)

        live_feature = create_feature(image)

        similarity = cosine_similarity(
            live_feature,
            stored_embedding
        )

        # SFace cosine similarity.
        # We keep this threshold configurable.
        threshold = float(
            data.get("threshold", 0.363)
        )

        verified = similarity >= threshold

        return jsonify({
            "success": True,
            "verified": verified,
            "similarity": similarity,
            "threshold": threshold
        })

    except Exception as error:
        return jsonify({
            "success": False,
            "message": str(error)
        }), 400


# Initialize models when imported by Gunicorn or run directly.
initialize_models()

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5100")),
        debug=False
    )
