"""
============================================
RT-DETR TRAFFIC DETECTION SERVICE
Vehicle counting & traffic density analysis
Using Baidu RT-DETR (Transformer-based, Non-YOLO)
============================================

Usage:
  python rtdetr_service.py --source webcam
  python rtdetr_service.py --source video --path traffic_video.mp4
"""

import argparse
import time
import json
import sys
import signal
import os
from datetime import datetime
import threading
import io
from pathlib import Path
from flask import Flask, Response

import cv2
import requests
import torch
import numpy as np
from PIL import Image
from transformers import RTDetrForObjectDetection, RTDetrImageProcessor

# ============================================
# CONFIGURATION
# ============================================

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000/api/traffic-data")

# COCO label names to target vehicle classes
VEHICLE_LABEL_MAP = {
    "car": "car",
    "motorbike": "motorcycle",
    "motorcycle": "motorcycle",
    "bus": "bus",
    "truck": "truck",
}

AREAS = [
    {"name": "Alkapuri",       "lat": 22.3110, "lng": 73.1725},
    {"name": "Akota",          "lat": 22.2950, "lng": 73.1680},
    {"name": "Manjalpur",      "lat": 22.2760, "lng": 73.1930},
    {"name": "Karelibaug",     "lat": 22.3230, "lng": 73.2000},
    {"name": "Waghodia Road",  "lat": 22.3100, "lng": 73.2200},
    {"name": "Fatehgunj",      "lat": 22.3200, "lng": 73.1850},
    {"name": "Sayajigunj",     "lat": 22.3150, "lng": 73.1900},
    {"name": "Gorwa",          "lat": 22.3300, "lng": 73.1600},
    {"name": "Harni",          "lat": 22.3400, "lng": 73.2100},
    {"name": "Gotri",          "lat": 22.3050, "lng": 73.1450},
    {"name": "Subhanpura",     "lat": 22.3200, "lng": 73.1600},
]

# ============================================
# GLOBAL SHUTDOWN EVENT
# ============================================

_shutdown = threading.Event()


def _request_shutdown(*_args):
    _shutdown.set()


signal.signal(signal.SIGINT, _request_shutdown)
signal.signal(signal.SIGTERM, _request_shutdown)
if os.name == "nt":
    try:
        signal.signal(signal.SIGBREAK, _request_shutdown)
    except (AttributeError, OSError):
        pass

# ============================================
# DETECTION ENGINE (RT-DETR)
# ============================================

class RTDetrTrafficDetector:
    def __init__(self, model_path: str = "./rtdetr_model", confidence: float = 0.45, area_name: str = "Alkapuri"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[INIT] Loading RT-DETR model from: {model_path} on {self.device}")
        
        self.processor = RTDetrImageProcessor.from_pretrained(model_path)
        self.model = RTDetrForObjectDetection.from_pretrained(model_path).to(self.device)
        self.model.eval()

        self.confidence = confidence
        self.selected_area = self._resolve_area(area_name)
        self.latest_frame = None
        self._frame_lock = threading.Lock()
        print("[INIT] RT-DETR loaded successfully")

    def _resolve_area(self, area_name: str) -> dict:
        for area in AREAS:
            if area["name"].lower() == (area_name or "").lower():
                return area
        return AREAS[0]

    def detect_frame(self, frame):
        """Run RT-DETR detection and count vehicles."""
        h, w = frame.shape[:2]
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(rgb_frame)

        inputs = self.processor(images=pil_img, return_tensors="pt").to(self.device)

        with torch.no_grad():
            outputs = self.model(**inputs)

        results = self.processor.post_process_object_detection(
            outputs,
            target_sizes=torch.tensor([[h, w]], device=self.device),
            threshold=self.confidence
        )[0]

        counts = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}

        scores = results["scores"].detach().cpu().numpy()
        labels = results["labels"].detach().cpu().numpy()
        boxes = results["boxes"].detach().cpu().numpy()

        for score, label_id, box in zip(scores, labels, boxes):
            class_name = self.model.config.id2label.get(int(label_id), "").lower()
            if class_name in VEHICLE_LABEL_MAP:
                vehicle_type = VEHICLE_LABEL_MAP[class_name]
                counts[vehicle_type] += 1

                x1, y1, x2, y2 = map(int, box)
                color = (0, 255, 0) if vehicle_type == "car" else \
                        (0, 255, 255) if vehicle_type == "motorcycle" else \
                        (255, 165, 0) if vehicle_type == "bus" else (0, 0, 255)

                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                caption = f"{vehicle_type} {score:.2f}"
                cv2.putText(frame, caption, (x1, max(y1 - 8, 15)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        return frame, counts

    def calculate_density(self, counts: dict) -> tuple:
        total = sum(counts.values())
        percentage = min(100, int((total / 200) * 100))
        if percentage >= 75:
            level = "heavy"
        elif percentage >= 40:
            level = "medium"
        else:
            level = "low"
        return total, percentage, level

    def send_to_backend(self, counts: dict):
        total, percentage, level = self.calculate_density(counts)

        payload = {
            "area_name": self.selected_area["name"],
            "latitude": self.selected_area["lat"],
            "longitude": self.selected_area["lng"],
            "cars": counts.get("car", 0),
            "bikes": counts.get("motorcycle", 0),
            "trucks": counts.get("truck", 0),
            "buses": counts.get("bus", 0),
        }

        def _post():
            try:
                response = requests.post(BACKEND_URL, json=payload, timeout=(3, 7))
                if response.status_code == 200:
                    print(f"  -> [Traffic AI] Sent to backend: {self.selected_area['name']} | {total} vehicles | {level}")
                else:
                    print(f"  x Backend error: {response.status_code} {response.text}")
            except Exception as e:
                print(f"  x Error sending to backend: {e}")

        t = threading.Thread(target=_post, daemon=True)
        t.start()

    def process_webcam(self, camera_id: int = 0, headless: bool = False):
        print(f"\n[WEBCAM] Opening camera {camera_id}...")
        cap = cv2.VideoCapture(camera_id)
        if not cap.isOpened():
            print(f"ERROR: Cannot open camera {camera_id}")
            return

        self._run_loop(cap, headless=headless)

    def process_video(self, video_path: str, headless: bool = False):
        print(f"\n[VIDEO] Opening {video_path}...")
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"ERROR: Cannot open video {video_path}")
            return

        self._run_loop(cap, headless=headless)

    def _run_loop(self, cap, headless: bool = False):
        last_send = time.time()
        send_interval = 3.0  # send every 3 seconds

        try:
            while not _shutdown.is_set():
                ret, frame = cap.read()
                if not ret:
                    # If video loops or ends
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    time.sleep(0.05)
                    continue

                processed_frame, counts = self.detect_frame(frame)

                with self._frame_lock:
                    self.latest_frame = processed_frame.copy()

                if time.time() - last_send >= send_interval:
                    self.send_to_backend(counts)
                    last_send = time.time()

                if not headless:
                    cv2.imshow("RT-DETR Traffic Detection", processed_frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                else:
                    time.sleep(0.01)

        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("[EXIT] Cleaned up video capture and windows.")


# ============================================
# FLASK MJPEG STREAMING SERVER
# ============================================

def start_stream_server(detector: RTDetrTrafficDetector, port: int = 9000):
    app = Flask("rtdetr_stream")

    def generate_frames():
        while not _shutdown.is_set():
            with detector._frame_lock:
                frame = detector.latest_frame
                if frame is None:
                    time.sleep(0.05)
                    continue
                ret, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if not ret:
                    continue
                frame_bytes = buffer.tobytes()

            yield (b"--frame\r\n"
                   b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n")
            time.sleep(0.04)  # ~25 fps

    @app.route("/stream")
    def video_feed():
        return Response(generate_frames(), mimetype="multipart/x-mixed-replace; boundary=frame")

    @app.route("/health")
    def health():
        return {"status": "ok", "model": "RT-DETR"}

    server_thread = threading.Thread(
        target=lambda: app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False),
        daemon=True
    )
    server_thread.start()
    print(f"[STREAM] MJPEG live stream active at http://localhost:{port}/stream")


# ============================================
# MAIN ENTRYPOINT
# ============================================

def main():
    parser = argparse.ArgumentParser(description="RT-DETR Traffic Detection Service")
    parser.add_argument("--source", choices=["webcam", "video"], default="webcam")
    parser.add_argument("--camera", type=int, default=0)
    parser.add_argument("--path", type=str, default="")
    parser.add_argument("--area", type=str, default="Alkapuri")
    parser.add_argument("--confidence", type=float, default=0.45)
    parser.add_argument("--model", type=str, default="./rtdetr_model")
    parser.add_argument("--stream-port", type=int, default=9000)
    parser.add_argument("--headless", action="store_true", default=True)

    args = parser.parse_args()

    detector = RTDetrTrafficDetector(
        model_path=args.model,
        confidence=args.confidence,
        area_name=args.area
    )

    start_stream_server(detector, port=args.stream_port)

    if args.source == "webcam":
        detector.process_webcam(camera_id=args.camera, headless=args.headless)
    else:
        detector.process_video(video_path=args.path, headless=args.headless)


if __name__ == "__main__":
    main()
