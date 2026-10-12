"""
============================================
YOLOv8 TRAFFIC DETECTION SERVICE
Vehicle counting & traffic density analysis
============================================

Usage:
  python yolo_service.py --source webcam
  python yolo_service.py --source video --path traffic_video.mp4

Requirements:
  pip install ultralytics opencv-python requests
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
from flask import Flask, Response

try:
    import cv2
    import requests
    from ultralytics import YOLO
    HAS_DEPS = True
except ImportError:
    HAS_DEPS = False

# ============================================
# CONFIGURATION
# ============================================

BACKEND_URL = "http://localhost:8000/api/traffic-data"

# COCO class IDs for vehicles
VEHICLE_CLASSES = {
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

# Vadodara area mapping (assign detected traffic to areas)
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
# Allows instant, graceful shutdown from any
# signal (SIGTERM, SIGINT, CTRL_BREAK_EVENT)
# ============================================

_shutdown = threading.Event()


def _request_shutdown(*_args):
    """Signal handler — sets the shutdown flag so all loops exit immediately."""
    _shutdown.set()


# Register signal handlers for clean termination
signal.signal(signal.SIGINT, _request_shutdown)
signal.signal(signal.SIGTERM, _request_shutdown)
# Windows: also handle CTRL_BREAK_EVENT (used by subprocess.terminate)
if os.name == "nt":
    try:
        signal.signal(signal.SIGBREAK, _request_shutdown)
    except (AttributeError, OSError):
        pass

# ============================================
# DETECTION ENGINE
# ============================================

class TrafficDetector:
    def __init__(self, model_path: str = "yolov8n.pt", confidence: float = 0.4, area_name: str = "Alkapuri"):
        if not HAS_DEPS:
            print("ERROR: Missing dependencies. Install with:")
            print("  pip install ultralytics opencv-python requests")
            sys.exit(1)

        print(f"[INIT] Loading YOLOv8 model: {model_path}")
        self.model = YOLO(model_path)
        self.confidence = confidence
        self.selected_area = self._resolve_area(area_name)
        self.latest_frame = None
        self._frame_lock = threading.Lock()
        print("[INIT] Model loaded successfully")

    def _resolve_area(self, area_name: str) -> dict:
        for area in AREAS:
            if area["name"].lower() == (area_name or "").lower():
                return area
        return AREAS[0]

    def detect_frame(self, frame):
        """Run YOLOv8 on a single frame and count vehicles."""
        results = self.model(frame, conf=self.confidence, verbose=False)
        
        counts = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}
        
        for result in results:
            boxes = result.boxes
            if boxes is None:
                continue
            
            for box in boxes:
                cls_id = int(box.cls[0])
                if cls_id in VEHICLE_CLASSES:
                    vehicle_type = VEHICLE_CLASSES[cls_id]
                    counts[vehicle_type] += 1
                    
                    # Draw bounding box
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])
                    
                    # Color coding
                    color = (0, 255, 0) if vehicle_type == "car" else \
                            (0, 255, 255) if vehicle_type == "motorcycle" else \
                            (255, 165, 0) if vehicle_type == "bus" else (0, 0, 255)
                    
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    label = f"{vehicle_type} {conf:.2f}"
                    cv2.putText(frame, label, (x1, y1 - 8),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        return frame, counts

    def calculate_density(self, counts: dict) -> tuple:
        """Calculate traffic density and level."""
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
        """Send detection results to FastAPI backend."""
        total, percentage, level = self.calculate_density(counts)

        if total <= 0:
            return

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
                # use connect/read timeout tuple to avoid long hangs
                response = requests.post(BACKEND_URL, json=payload, timeout=(3, 7))
                if response.status_code == 200:
                    print(f"  -> Sent to backend: {self.selected_area['name']} | {total} vehicles | {level}")
                else:
                    print(f"  x Backend error: {response.status_code} {response.text}")
            except requests.exceptions.ConnectTimeout:
                print(f"  x Backend connect timeout: {BACKEND_URL}")
            except requests.exceptions.ReadTimeout:
                print(f"  x Backend read timeout: {BACKEND_URL}")
            except requests.exceptions.ConnectionError:
                print(f"  x Backend not reachable at {BACKEND_URL}")
            except Exception as e:
                print(f"  x Error sending to backend: {e}")

        # Send in a background thread to avoid blocking main detection loop
        t = threading.Thread(target=_post, daemon=True)
        t.start()

    def process_webcam(self, camera_id: int = 0, headless: bool = False):

        """Process live webcam feed."""
        print(f"\n[WEBCAM] Opening camera {camera_id}...")

        # Use DirectShow backend on Windows for faster camera init
        if os.name == "nt":
            cap = cv2.VideoCapture(camera_id, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(camera_id)

        if not cap.isOpened():
            print("ERROR: Cannot open webcam")
            return

        # Set a modest resolution for speed
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        print("[WEBCAM] Processing... Press 'q' to quit\n")
        frame_count = 0
        last_send = 0
        
        while not _shutdown.is_set():
            ret, frame = cap.read()
            if not ret:
                if _shutdown.is_set():
                    break
                # brief pause then retry (camera may need a moment)
                time.sleep(0.05)
                continue
            
            frame_count += 1

            # Process every 3rd frame for speed
            if frame_count % 3 != 0:
                continue

            annotated, counts = self.detect_frame(frame)
            total, pct, level = self.calculate_density(counts)
            
            # Display stats on frame
            stats = f"Cars:{counts['car']} Bikes:{counts['motorcycle']} Trucks:{counts['truck']} Buses:{counts['bus']} | {level.upper()} ({pct}%)"
            cv2.putText(annotated, stats, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            cv2.putText(annotated, "VADODARA TRAFFIC AI", (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 1)
            
            # Update latest frame for HTTP MJPEG streaming
            try:
                with self._frame_lock:
                    ret_jpg, buf = cv2.imencode('.jpg', annotated)
                    if ret_jpg:
                        self.latest_frame = buf.tobytes()
            except Exception:
                pass

            if not headless:
                cv2.imshow("YOLOv8 Traffic Detection — Vadodara", annotated)

            
            # Send to backend every 5 seconds
            current_time = time.time()
            if current_time - last_send >= 5:
                self.send_to_backend(counts)
                last_send = current_time
            
            if not headless and cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        cap.release()
        if not headless:
            cv2.destroyAllWindows()

        print("\n[WEBCAM] Stopped")

    def process_video(self, video_path: str, headless: bool = False):
        """Process a video file."""
        print(f"\n[VIDEO] Processing: {video_path}")
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            print(f"ERROR: Cannot open video: {video_path}")
            return
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        print(f"[VIDEO] {total_frames} frames @ {fps} FPS")
        print("[VIDEO] Processing... Press 'q' to quit\n")
        
        frame_count = 0
        last_send = 0
        
        while not _shutdown.is_set():
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Process every 3rd frame for performance
            if frame_count % 3 != 0:
                continue
            
            annotated, counts = self.detect_frame(frame)
            total, pct, level = self.calculate_density(counts)
            
            progress = f"Frame {frame_count}/{total_frames} ({int(frame_count/total_frames*100)}%)"
            stats = f"Cars:{counts['car']} Bikes:{counts['motorcycle']} Trucks:{counts['truck']} Buses:{counts['bus']} | {level.upper()}"
            
            cv2.putText(annotated, progress, (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
            cv2.putText(annotated, stats, (10, 60),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            
            if not headless:
                cv2.imshow("YOLOv8 Traffic Detection — Vadodara", annotated)

            
            # Send to backend every 5 seconds
            current_time = time.time()
            if current_time - last_send >= 5:
                self.send_to_backend(counts)
                last_send = current_time
            
            if not headless and cv2.waitKey(1) & 0xFF == ord('q'):
                break
        
        cap.release()
        if not headless:
            cv2.destroyAllWindows()

        print(f"\n[VIDEO] Completed — {frame_count} frames processed")


def start_mjpeg_server(detector: TrafficDetector, port: int = 9000):
    app = Flask(__name__)

    @app.route('/stream')
    def stream():
        def gen():
            boundary = b'--frame'
            while not _shutdown.is_set():
                frame = None
                try:
                    with detector._frame_lock:
                        frame = detector.latest_frame
                except Exception:
                    frame = None

                if frame:
                    yield b'--frame\r\n'
                    yield b'Content-Type: image/jpeg\r\n'
                    yield b'Content-Length: ' + f"{len(frame)}".encode() + b"\r\n\r\n"
                    yield frame + b"\r\n"
                else:
                    # small sleep when no frame available
                    time.sleep(0.05)

        return Response(gen(), mimetype='multipart/x-mixed-replace; boundary=frame')

    # Run Flask server in a daemon thread
    thread = threading.Thread(target=lambda: app.run(host='0.0.0.0', port=port, threaded=True), daemon=True)
    thread.start()


# ============================================
# CLI
# ============================================

def main():
    parser = argparse.ArgumentParser(
        description="YOLOv8 Traffic Detection Service for Vadodara Smart City"
    )
    parser.add_argument(
        "--source", choices=["webcam", "video"],
        default="webcam", help="Input source"
    )
    parser.add_argument(
        "--path", type=str, default="",
        help="Path to video file (for --source video)"
    )
    parser.add_argument(
        "--model", type=str, default="yolov8n.pt",
        help="YOLOv8 model path (default: yolov8n.pt)"
    )
    parser.add_argument(
        "--confidence", type=float, default=0.4,
        help="Detection confidence threshold"
    )
    parser.add_argument(
        "--camera", type=int, default=0,
        help="Camera ID for webcam mode"
    )
    parser.add_argument(
        "--area", type=str, default="Alkapuri",
        help="Area name to assign detections to"
    )
    parser.add_argument(
        "--stream-port", type=int, default=0,
        help="If set, start an HTTP MJPEG stream on this port"
    )
    parser.add_argument(
        "--headless", action="store_true",
        help="Run without displaying a GUI window"
    )

    
    args = parser.parse_args()
    
    # Find area index
    detector = TrafficDetector(model_path=args.model, confidence=args.confidence, area_name=args.area)
    
    print("=" * 50)
    print("  VADODARA SMART CITY")
    print("  YOLOv8 Traffic Detection Service")
    print("=" * 50)
    print(f"  Model:      {args.model}")
    print(f"  Confidence: {args.confidence}")
    print(f"  Backend:    {BACKEND_URL}")
    print(f"  Area:       {detector.selected_area['name']}")
    print("=" * 50)
    
    if args.source == "webcam":
        # Start MJPEG server if requested
        if args.stream_port and args.stream_port > 0:
            try:
                start_mjpeg_server(detector, port=args.stream_port)
                print(f"[STREAM] MJPEG stream available at http://127.0.0.1:{args.stream_port}/stream")
            except Exception as e:
                print(f"[STREAM] Failed to start MJPEG server: {e}")

        detector.process_webcam(camera_id=args.camera, headless=args.headless)

    elif args.source == "video":
        if not args.path:
            print("ERROR: --path required for video mode")
            sys.exit(1)
        detector.process_video(args.path, headless=args.headless)


if __name__ == "__main__":
    main()
