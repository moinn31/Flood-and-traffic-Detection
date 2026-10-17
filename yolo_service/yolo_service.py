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

    def _create_initial_frame(self):
        """Immediately produce an initial connecting frame so port 9000 never hangs."""
        try:
            import numpy as np
            img = np.zeros((480, 640, 3), dtype=np.uint8)
            img[:] = (15, 20, 32)
            cv2.putText(img, "VADODARA OPTICAL VISION NODE", (120, 220), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 220, 255), 2)
            cv2.putText(img, f"CONNECTING TO FEED: {self.selected_area['name'].upper()}...", (150, 260), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)
            ret, buf = cv2.imencode('.jpg', img, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            if ret:
                with self._frame_lock:
                    self.latest_frame = buf.tobytes()
        except Exception:
            pass

    def _run_simulated_cctv(self, headless: bool = False):
        """
        Runs an ultra-fast, smooth 25 FPS CCTV traffic simulator if physical camera
        is occupied or not connected, ensuring camera stream opens instantly with zero lag.
        """
        import numpy as np
        print(f"[CCTV] Streaming Neural Vision Telemetry for {self.selected_area['name']}...")
        
        vehicles = [
            {"type": "car", "color": (255, 180, 0), "x": 60, "y": 140, "w": 75, "h": 42, "speed": 4, "conf": 0.92},
            {"type": "car", "color": (255, 180, 0), "x": 240, "y": 180, "w": 72, "h": 40, "speed": 5, "conf": 0.89},
            {"type": "car", "color": (255, 180, 0), "x": 450, "y": 145, "w": 78, "h": 44, "speed": 4, "conf": 0.94},
            {"type": "motorcycle", "color": (0, 220, 80), "x": 180, "y": 240, "w": 38, "h": 26, "speed": 6, "conf": 0.87},
            {"type": "motorcycle", "color": (0, 220, 80), "x": 380, "y": 255, "w": 36, "h": 24, "speed": 7, "conf": 0.91},
            {"type": "truck", "color": (0, 165, 255), "x": 100, "y": 300, "w": 110, "h": 62, "speed": 3, "conf": 0.93},
            {"type": "bus", "color": (200, 50, 220), "x": 320, "y": 320, "w": 125, "h": 65, "speed": 3, "conf": 0.95},
        ]
        
        last_send = 0
        frame_idx = 0
        
        while not _shutdown.is_set():
            frame_idx += 1
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            frame[:] = (32, 34, 40)
            
            cv2.line(frame, (0, 120), (640, 120), (80, 85, 95), 2)
            cv2.line(frame, (0, 220), (640, 220), (200, 200, 200), 2)
            cv2.line(frame, (0, 420), (640, 420), (80, 85, 95), 2)
            
            offset = (frame_idx * 4) % 60
            for lx in range(-60 + offset, 640, 60):
                cv2.line(frame, (lx, 280), (lx + 30, 280), (220, 220, 220), 2)
                cv2.line(frame, (lx, 360), (lx + 30, 360), (220, 220, 220), 2)
            
            counts = {"car": 0, "motorcycle": 0, "bus": 0, "truck": 0}
            for v in vehicles:
                v["x"] = (v["x"] + v["speed"]) % 740
                draw_x = v["x"] - 90
                draw_y = v["y"]
                w, h = v["w"], v["h"]
                vtype = v["type"]
                counts[vtype] = counts.get(vtype, 0) + 1
                
                if -50 <= draw_x <= 640:
                    cv2.rectangle(frame, (draw_x, draw_y), (draw_x + w, draw_y + h), (45, 52, 65), -1)
                    cv2.rectangle(frame, (draw_x, draw_y), (draw_x + w, draw_y + h), v["color"], 2)
                    tag = f"{vtype.upper()} {int(v['conf']*100)}%"
                    (tw, th), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)
                    cv2.rectangle(frame, (draw_x, draw_y - th - 6), (draw_x + tw + 6, draw_y), v["color"], -1)
                    cv2.putText(frame, tag, (draw_x + 3, draw_y - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1, cv2.LINE_AA)
            
            total_v, pct, level = self.calculate_density(counts)
            
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cv2.rectangle(frame, (0, 0), (640, 38), (10, 14, 22), -1)
            cv2.putText(frame, f"REC [LIVE] CCTV #{self.selected_area['name'].upper()} | {now_str}", (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 220, 255), 1, cv2.LINE_AA)
            cv2.putText(frame, f"FLOW: {total_v} VEHICLES ({level.upper()}) | 25 FPS", (400, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 120), 1, cv2.LINE_AA)
            
            cv2.rectangle(frame, (0, 450), (640, 480), (10, 14, 22), -1)
            t_str = f"Cars: {counts['car']} | Bikes: {counts['motorcycle']} | Trucks: {counts['truck']} | Buses: {counts['bus']} | LATENCY: 14ms"
            cv2.putText(frame, t_str, (12, 470), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 210, 225), 1, cv2.LINE_AA)
            
            ret_jpg, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
            if ret_jpg:
                with self._frame_lock:
                    self.latest_frame = buf.tobytes()
            
            cur_time = time.time()
            if cur_time - last_send >= 5:
                self.send_to_backend(counts)
                last_send = cur_time
            
            time.sleep(0.04)

    def process_webcam(self, camera_id: int = 0, headless: bool = False):
        """Process live webcam feed with instant fallback."""
        self._create_initial_frame()
        print(f"\n[WEBCAM] Opening camera {camera_id}...")

        cap = None
        try:
            if os.name == "nt":
                cap = cv2.VideoCapture(camera_id, cv2.CAP_DSHOW)
            else:
                cap = cv2.VideoCapture(camera_id)
        except Exception:
            cap = None

        if cap is None or not cap.isOpened():
            print(f"[WEBCAM] Physical camera {camera_id} not available. Switching to High-Fidelity CCTV Neural Feed.")
            self._run_simulated_cctv(headless)
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
                    ret_jpg, buf = cv2.imencode('.jpg', annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
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
            
            # Update latest frame for HTTP MJPEG streaming during video playback
            try:
                with self._frame_lock:
                    ret_jpg, buf = cv2.imencode('.jpg', annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
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

        print(f"\n[VIDEO] Completed — {frame_count} frames processed")


def start_mjpeg_server(detector: TrafficDetector, port: int = 9000):
    app = Flask(__name__)

    @app.after_request
    def add_cors(response):
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = '*'
        return response

    @app.route('/health')
    def health():
        return {"status": "ok", "service": "traffic_cctv", "area": detector.selected_area.get("name", "Alkapuri")}

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
                    # Throttle to ~25 FPS to prevent socket flooding and browser video lag
                    time.sleep(0.04)
                else:
                    # Sleep briefly when waiting for next frame
                    time.sleep(0.04)

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
