"""
============================================
VADODARA SMART CITY — FastAPI Backend
REST API + WebSocket for real-time data
============================================
"""

import asyncio
import json
import os
import random
import subprocess
import signal
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

try:
    from dotenv import load_dotenv
    load_dotenv(ROOT_DIR / ".env")
except Exception:
    pass

from database import db_manager

# Ensure local SQLite database and tables are pre-seeded and ready
db_manager.init_db()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = (
    os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("SUPABASE_SECRET_KEY")
    or ""
)

supabase_client: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[Supabase] Optional client warning: {e}")
else:
    print("[Supabase] Cloud sync not configured (SUPABASE_URL/KEY not found in .env). Operating with local SQLite database.")

# ============================================
# DATA MODELS
# ============================================

class FloodDataIn(BaseModel):
    sensor_id: str
    sensor_name: str
    area_name: str
    latitude: float
    longitude: float
    water_level: float
    status: str = "online"
    max_threshold: Optional[float] = None
    warn_threshold: Optional[float] = None
    severity: Optional[str] = None

class FloodDataOut(BaseModel):
    id: str
    sensor_name: str
    area_name: str
    latitude: float
    longitude: float
    water_level: float
    max_threshold: float
    warn_threshold: float
    status: str
    severity: str
    last_updated: str

class TrafficDataIn(BaseModel):
    area_name: str
    latitude: float
    longitude: float
    cars: int
    bikes: int
    trucks: int
    buses: int

class TrafficDataOut(BaseModel):
    id: str
    area_name: str
    latitude: float
    longitude: float
    cars: int
    bikes: int
    trucks: int
    buses: int
    vehicle_count: int
    traffic_level: str
    traffic_percentage: int
    last_updated: str


class TrafficHistoryOut(BaseModel):
    id: str
    area_name: str
    vehicle_count: int
    traffic_level: str
    traffic_percentage: int
    recorded_at: str

class AlertOut(BaseModel):
    id: str
    alert_type: str
    area_name: str
    severity: str
    message: str
    created_at: str

class SensorStatusIn(BaseModel):
    sensor_id: str
    status: str  # "online" | "offline"

class SimulationIn(BaseModel):
    type: str = "flood"  # "flood" | "traffic"


class IoTTelemetryIn(BaseModel):
    device_id: Optional[str] = "ESP32-VADODARA"
    area_name: str
    water_level: Optional[float] = None
    cars: Optional[int] = None
    bikes: Optional[int] = None
    trucks: Optional[int] = None
    buses: Optional[int] = None
    vehicle_count: Optional[int] = None
    traffic_percentage: Optional[int] = None
    status: Optional[str] = "online"
    battery_pct: Optional[float] = None




class YoloStartIn(BaseModel):
    camera: int = 0
    area: str = "Alkapuri"
    confidence: float = 0.4
    headless: bool = True


class YoloStatusOut(BaseModel):
    running: bool
    pid: Optional[int] = None
    area: Optional[str] = None
    camera: Optional[int] = None
    confidence: Optional[float] = None
    started_at: Optional[str] = None
    command: Optional[str] = None
    headless: Optional[bool] = None

# ============================================
# APP SETUP
# ============================================

app = FastAPI(
    title="Vadodara Smart City API",
    description="Real-time flood & traffic monitoring backend",
    version="2.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================
# IN-MEMORY DATABASE (replace with Supabase)
# ============================================

VADODARA_AREAS = [
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

flood_db: List[dict] = []
traffic_db: List[dict] = []
alerts_db: List[dict] = []

yolo_process: Optional[subprocess.Popen] = None
yolo_started_at: Optional[str] = None
yolo_config: dict = {
    "area": "Alkapuri",
    "camera": 0,
    "confidence": 0.4,
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _yolo_script_path() -> Path:
    # Always use the fast, optimized YOLOv8 real-time service for instant startup & smooth streaming
    return _repo_root() / "yolo_service" / "yolo_service.py"


def _yolo_model_path() -> Path:
    yolo_file = _repo_root() / "yolov8n.pt"
    if yolo_file.exists():
        return yolo_file
    return _repo_root() / "yolo_service" / "yolov8n.pt"


def _is_yolo_running() -> bool:
    global yolo_process
    return yolo_process is not None and yolo_process.poll() is None


def _yolo_command(camera: int, area: str, confidence: float, headless: bool = True) -> List[str]:
    cmd = [
        sys.executable,
        str(_yolo_script_path()),
        "--source",
        "webcam",
        "--camera",
        str(camera),
        "--area",
        area,
        "--confidence",
        str(confidence),
        "--model",
        str(_yolo_model_path()),
        "--stream-port",
        "9000",
    ]

    # Only include headless flag when requested (default: True to preserve prior behavior)
    if headless:
        cmd.append("--headless")

    return cmd


def _build_yolo_status() -> dict:
    running = _is_yolo_running()
    return {
        "running": running,
        "pid": yolo_process.pid if running and yolo_process else None,
        "area": yolo_config.get("area"),
        "camera": yolo_config.get("camera"),
        "confidence": yolo_config.get("confidence"),
        "started_at": yolo_started_at if running else None,
        "headless": bool(yolo_config.get("headless", True)),
        "command": " ".join(_yolo_command(
            int(yolo_config.get("camera", 0)),
            str(yolo_config.get("area", "Alkapuri")),
            float(yolo_config.get("confidence", 0.4)),
            bool(yolo_config.get("headless", True)),
        )) if running else None,
    }

# Removed init_data(), using Supabase exclusively.

# ============================================
# WEBSOCKET CONNECTION MANAGER
# ============================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# ============================================
# REST API ENDPOINTS
# ============================================

@app.get("/")
async def root():
    return {
        "service": "Vadodara Smart City API",
        "version": "2.2.0",
        "status": "operational",
        "endpoints": {
            "flood_data": "/api/flood-data",
            "traffic_data": "/api/traffic-data",
            "alerts": "/api/alerts",
            "websocket": "/ws/live",
        }
    }

@app.get("/api/flood-data", response_model=List[FloodDataOut])
async def get_flood_data():
    try:
        return db_manager.get_all_flood_data()
    except Exception as e:
        print(f"Error fetching flood data: {e}")
        return []

@app.post("/api/flood-data")
async def post_flood_data(data: FloodDataIn):
    max_thr = data.max_threshold if data.max_threshold is not None else 180.0
    warn_thr = data.warn_threshold if data.warn_threshold is not None else 100.0

    if data.severity and data.severity.lower() in ("safe", "warning", "danger"):
        severity = data.severity.lower()
    elif max_thr < warn_thr:
        severity = "danger" if data.water_level <= max_thr else (
            "warning" if data.water_level <= warn_thr else "safe"
        )
    else:
        severity = "danger" if data.water_level >= max_thr else (
            "warning" if data.water_level >= warn_thr else "safe"
        )

    record = {
        "sensor_name": data.sensor_name,
        "area_name": data.area_name,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "water_level": data.water_level,
        "max_threshold": max_thr,
        "warn_threshold": warn_thr,
        "status": data.status,
        "severity": severity,
        "last_updated": datetime.utcnow().isoformat(),
    }

    # Save to local persistent SQLite database
    try:
        saved = db_manager.upsert_flood_data(record)
        record["id"] = saved.get("id") or data.sensor_id
        print(f"[DB] Flood data saved: {data.area_name} water_level={data.water_level}")
    except Exception as e:
        print(f"DB error (flood upsert): {e}")
        record["id"] = data.sensor_id

    # Optional sync to Supabase
    try:
        if supabase_client:
            supabase_client.table("flood_data").upsert(record).execute()
    except Exception:
        pass

    # Auto-generate alert if danger
    if severity == "danger":
        alert = {
            "alert_type": "flood",
            "area_name": data.area_name,
            "severity": "danger",
            "message": f"Water level critical at {data.water_level}cm in {data.area_name}",
            "created_at": datetime.utcnow().isoformat(),
        }
        try:
            saved_alert = db_manager.insert_alert(alert)
            alert["id"] = saved_alert.get("id")
        except Exception:
            pass
        try:
            if supabase_client:
                supabase_client.table("alerts").insert(alert).execute()
        except Exception:
            pass
        await manager.broadcast({"type": "alert", "data": alert})

    await manager.broadcast({"type": "flood_update", "data": record})
    return {"status": "ok", "id": record["id"]}

@app.get("/api/traffic-data", response_model=List[TrafficDataOut])
async def get_traffic_data():
    try:
        return db_manager.get_all_traffic_data()
    except Exception as e:
        print(f"Error fetching traffic data: {e}")
        return []

@app.post("/api/traffic-data")
async def post_traffic_data(data: TrafficDataIn):
    total = max(0, data.cars + data.bikes + data.trucks + data.buses)
    pct = min(100, int((total / 350) * 100))
    level = "heavy" if pct >= 75 else ("medium" if pct >= 40 else "low")

    record = {
        "area_name": data.area_name,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "cars": max(0, data.cars),
        "bikes": max(0, data.bikes),
        "trucks": max(0, data.trucks),
        "buses": max(0, data.buses),
        "vehicle_count": total,
        "traffic_level": level,
        "traffic_percentage": pct,
        "last_updated": datetime.utcnow().isoformat(),
    }

    # Save to local persistent SQLite database
    try:
        saved = db_manager.upsert_traffic_data(record)
        record["id"] = saved.get("id") or f"TR-{uuid.uuid4().hex[:6].upper()}"
        print(f"[DB] Traffic data saved to database: {data.area_name} total={total} level={level}")
    except Exception as e:
        print(f"DB error (traffic upsert): {e}")
        record["id"] = f"TR-{uuid.uuid4().hex[:6].upper()}"

    # Also save to traffic_history for analytics
    history_record = {
        "area_name": data.area_name,
        "vehicle_count": total,
        "traffic_level": level,
        "traffic_percentage": pct,
        "recorded_at": record["last_updated"],
    }
    try:
        db_manager.insert_traffic_history(history_record)
    except Exception as e:
        print(f"DB error (traffic_history insert): {e}")

    # Optional sync to Supabase
    try:
        if supabase_client:
            supabase_client.table("traffic_data").upsert(record).execute()
            supabase_client.table("traffic_history").insert(history_record).execute()
    except Exception:
        pass

    # Auto-generate alert if heavy
    if level == "heavy":
        alert = {
            "alert_type": "traffic",
            "area_name": data.area_name,
            "severity": "danger",
            "message": f"Heavy traffic in {data.area_name}: {total} vehicles detected",
            "created_at": datetime.utcnow().isoformat(),
        }
        try:
            saved_alert = db_manager.insert_alert(alert)
            alert["id"] = saved_alert.get("id")
        except Exception:
            pass
        try:
            if supabase_client:
                supabase_client.table("alerts").insert(alert).execute()
        except Exception:
            pass
        await manager.broadcast({"type": "alert", "data": alert})

    await manager.broadcast({"type": "traffic_update", "data": record})
    return {"status": "ok", "area": data.area_name, "id": record["id"], "vehicle_count": total}


@app.get("/api/traffic-history", response_model=List[TrafficHistoryOut])
async def get_traffic_history(area_name: Optional[str] = None, hours: int = 24, limit: int = 200):
    try:
        rows = db_manager.get_traffic_history(area_name=area_name, limit=limit)
        cutoff = datetime.utcnow().timestamp() - (hours * 3600)
        filtered = []
        for row in rows:
            recorded_at = row.get("recorded_at")
            if not recorded_at:
                continue

            try:
                recorded_dt = datetime.fromisoformat(str(recorded_at).replace("Z", "+00:00"))
                if recorded_dt.timestamp() < cutoff:
                    continue
            except Exception:
                pass

            filtered.append(row)

        # Return chronological order for charting
        return list(reversed(filtered))
    except Exception as e:
        print(f"Error fetching traffic history: {e}")
        return []

@app.get("/api/alerts", response_model=List[AlertOut])
async def get_alerts():
    try:
        return db_manager.get_all_alerts(limit=20)
    except Exception as e:
        print(f"Error fetching alerts: {e}")
        return []

@app.post("/api/alerts/clear")
async def clear_alerts():
    try:
        db_manager.clear_all_alerts()
        await manager.broadcast({"type": "alerts_cleared"})
        return {"status": "ok", "message": "All alerts cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulate")
async def simulate_event(data: SimulationIn):
    try:
        alerts = db_manager.trigger_simulation(data.type)
        flood = db_manager.get_all_flood_data()
        traffic = db_manager.get_all_traffic_data()
        await manager.broadcast({
            "type": "simulation_triggered",
            "sim_type": data.type,
            "flood": flood,
            "traffic": traffic,
            "alerts": alerts
        })
        return {"status": "ok", "type": data.type, "alerts_generated": len(alerts)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/simulate/reset")
async def simulate_reset():
    try:
        db_manager.reset_baseline()
        flood = db_manager.get_all_flood_data()
        traffic = db_manager.get_all_traffic_data()
        alerts = db_manager.get_all_alerts(10)
        await manager.broadcast({
            "type": "simulation_reset",
            "flood": flood,
            "traffic": traffic,
            "alerts": alerts
        })
        return {"status": "ok", "message": "Baseline restored"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/iot/ingest")
@app.post("/api/simulate/area")
async def ingest_iot_telemetry(payload: IoTTelemetryIn):
    """
    Ingest live telemetry from real IoT hardware (ESP32 / ultrasonic / sensors)
    or custom scenario override. Immediately updates local SQLite and broadcasts
    to Leaflet map clients via WebSocket.
    """
    try:
        res = db_manager.override_area_condition(
            area_name=payload.area_name,
            water_level=payload.water_level,
            cars=payload.cars,
            bikes=payload.bikes,
            trucks=payload.trucks,
            buses=payload.buses,
            vehicle_count=payload.vehicle_count,
            traffic_percentage=payload.traffic_percentage,
            status=payload.status or "online",
        )

        # Broadcast flood update if changed
        if res.get("flood"):
            await manager.broadcast({"type": "flood_update", "data": res["flood"]})

        # Broadcast traffic update if changed
        if res.get("traffic"):
            await manager.broadcast({"type": "traffic_update", "data": res["traffic"]})

        # Broadcast any new alerts generated
        for alert in res.get("alerts", []):
            await manager.broadcast({"type": "alert", "data": alert})

        return {
            "status": "ok",
            "device_id": payload.device_id,
            "area_name": res["area_name"],
            "flood": res.get("flood"),
            "traffic": res.get("traffic"),
            "alerts_generated": len(res.get("alerts", [])),
            "message": f"Telemetry ingested for {res['area_name']} successfully."
        }
    except Exception as e:
        print(f"Error in iot/ingest: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@app.post("/api/sensor-status")
async def update_sensor_status(data: SensorStatusIn):
    try:
        all_sensors = db_manager.get_all_flood_data()
        target = next((s for s in all_sensors if s["id"] == data.sensor_id or s.get("sensor_name") == data.sensor_id or s.get("area_name") == data.sensor_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Sensor not found")

        target["status"] = data.status
        target["last_updated"] = datetime.utcnow().isoformat()
        db_manager.upsert_flood_data(target)

        try:
            if supabase_client:
                supabase_client.table("flood_data").upsert(target).execute()
        except Exception:
            pass

        await manager.broadcast({"type": "sensor_status", "data": target})
        return {"status": "ok", "sensor_id": data.sensor_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/weather")
async def get_live_weather():
    """
    Returns real live meteorological weather data for Vadodara, Gujarat via Open-Meteo.
    """
    import urllib.request
    try:
        url = "https://api.open-meteo.com/v1/forecast?latitude=22.3072&longitude=73.1812&current=temperature_2m,relative_humidity_2m,weather_code,precipitation,wind_speed_10m"
        req = urllib.request.Request(url, headers={"User-Agent": "VadodaraSmartCity/1.0"})
        with urllib.request.urlopen(req, timeout=4) as response:
            data = json.loads(response.read().decode("utf-8"))
            curr = data.get("current", {})
            code = curr.get("weather_code", 0)

            # WMO Weather interpretation
            if code == 0:
                cond, icon = "Clear", "sun"
            elif code in [1, 2]:
                cond, icon = "Partly Cloudy", "cloud-sun"
            elif code == 3:
                cond, icon = "Overcast", "cloud"
            elif code in [45, 48]:
                cond, icon = "Hazy Fog", "cloud-fog"
            elif code in [51, 53, 55, 61, 63, 65, 80, 81, 82]:
                cond, icon = "Monsoon Rain", "cloud-rain"
            elif code in [95, 96, 99]:
                cond, icon = "Thunderstorm", "cloud-lightning"
            else:
                cond, icon = "Monsoon", "cloud-rain"

            return {
                "city": "Vadodara",
                "temperature": round(curr.get("temperature_2m", 32.0)),
                "humidity": curr.get("relative_humidity_2m", 50),
                "condition": cond,
                "icon": icon,
                "weather_code": code,
                "precipitation": curr.get("precipitation", 0.0),
                "wind_speed": curr.get("wind_speed_10m", 5.0),
                "timestamp": curr.get("time", datetime.utcnow().isoformat())
            }
    except Exception as e:
        return {
            "city": "Vadodara",
            "temperature": 32,
            "humidity": 45,
            "condition": "Monsoon Watch",
            "icon": "cloud-rain",
            "weather_code": 61,
            "precipitation": 0.0,
            "wind_speed": 6.0,
            "timestamp": datetime.utcnow().isoformat()
        }


# ============================================
# TRAFFIC AI MEDIA INFERENCE (IMAGE & VIDEO UPLOAD)
# ============================================

_yolo_model_cache = None

def _get_yolo_model():
    global _yolo_model_cache
    if _yolo_model_cache is None:
        from ultralytics import YOLO
        model_path = ROOT_DIR / "yolov8n.pt"
        if not model_path.exists():
            model_path = ROOT_DIR / "yolo_service" / "yolov8n.pt"
        if not model_path.exists():
            model_path = Path("yolov8n.pt")
        _yolo_model_cache = YOLO(str(model_path))
    return _yolo_model_cache


@app.post("/api/traffic/detect-media")
async def detect_traffic_media(
    file: UploadFile = File(...),
    confidence: float = Form(0.30),
    area: Optional[str] = Form("Alkapuri")
):
    """
    Accepts an image or video file upload, runs YOLO vehicle detection,
    and returns annotated imagery, bounding boxes, vehicle classifications,
    and congestion metrics.
    """
    import cv2
    import numpy as np
    import base64
    import tempfile
    import time

    start_time = time.time()
    filename = (file.filename or "").lower()
    is_video = any(filename.endswith(ext) for ext in [".mp4", ".avi", ".mov", ".mkv", ".webm"])

    try:
        model = _get_yolo_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load detection model: {e}")

    # Vehicle COCO IDs: 2: car, 3: motorcycle, 5: bus, 7: truck
    vehicle_map = {2: "car", 3: "bike", 5: "bus", 7: "truck"}
    class_colors = {
        "car": (255, 180, 0),     # Cyan / Light Blue (BGR: B, G, R)
        "bike": (0, 220, 80),     # Emerald Green
        "truck": (0, 165, 255),   # Orange / Amber
        "bus": (200, 50, 220),    # Violet / Purple
    }

    if not is_video:
        # Process Single Image
        file_bytes = await file.read()
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file format")

        # Optimize size for high-speed inference (<80ms)
        h, w, _ = img.shape
        max_dim = max(h, w)
        if max_dim > 1024:
            scale = 1024.0 / max_dim
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
            h, w, _ = img.shape

        results = model.predict(img, conf=confidence, imgsz=640, classes=[2, 3, 5, 7], verbose=False)
        result = results[0]

        counts = {"car": 0, "bike": 0, "truck": 0, "bus": 0}
        detections = []

        annotated = img.copy()

        for box in result.boxes:
            cls_id = int(box.cls[0].item())
            conf_val = float(box.conf[0].item())
            cls_name = vehicle_map.get(cls_id, "vehicle")
            counts[cls_name] = counts.get(cls_name, 0) + 1

            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            detections.append({
                "class": cls_name,
                "confidence": round(conf_val, 3),
                "box": [x1, y1, x2, y2]
            })

            color = class_colors.get(cls_name, (0, 255, 255))
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
            label = f"{cls_name.upper()} {int(conf_val * 100)}%"
            (lw, lh), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(annotated, (x1, max(0, y1 - lh - 8)), (x1 + lw + 8, max(lh + 8, y1)), color, -1)
            cv2.putText(annotated, label, (x1 + 4, max(lh + 4, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

        total_vehicles = counts["car"] + counts["bike"] + counts["truck"] + counts["bus"]
        traffic_pct = min(100, int((total_vehicles / 35.0) * 100))
        traffic_level = "heavy" if traffic_pct >= 70 else ("medium" if traffic_pct >= 35 else "low")

        ret, buf = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
        b64_img = f"data:image/jpeg;base64,{base64.b64encode(buf.tobytes()).decode('utf-8')}" if ret else ""

        elapsed_ms = round((time.time() - start_time) * 1000, 1)

        # Persist detected traffic directly to SQLite database and broadcast to all connected UI clients
        target_area = area or "Alkapuri"
        try:
            db_res = db_manager.override_area_condition(
                area_name=target_area,
                cars=counts["car"],
                bikes=counts["bike"],
                trucks=counts["truck"],
                buses=counts["bus"],
                vehicle_count=total_vehicles,
                traffic_percentage=traffic_pct,
            )
            if db_res.get("traffic"):
                await manager.broadcast({"type": "traffic_update", "data": db_res["traffic"]})
            for alert in db_res.get("alerts", []):
                await manager.broadcast({"type": "alert", "data": alert})
        except Exception as db_err:
            print(f"Warning: Failed to persist traffic detection: {db_err}")

        return {
            "media_type": "image",
            "filename": file.filename,
            "area": area,
            "total_vehicles": total_vehicles,
            "cars": counts["car"],
            "bikes": counts["bike"],
            "trucks": counts["truck"],
            "buses": counts["bus"],
            "traffic_percentage": traffic_pct,
            "traffic_level": traffic_level,
            "inference_time_ms": elapsed_ms,
            "annotated_preview": b64_img,
            "detections": detections,
            "dimensions": {"width": w, "height": h}
        }
    else:
        # Process Video Upload
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

        try:
            cap = cv2.VideoCapture(tmp_path)
            if not cap.isOpened():
                raise HTTPException(status_code=400, detail="Cannot read uploaded video")

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = float(cap.get(cv2.CAP_PROP_FPS) or 25.0)
            duration_sec = round(total_frames / fps, 1) if fps > 0 else 0

            # High-speed smart sampling: 6-8 evenly spaced keyframes
            target_samples = min(8, max(3, int(duration_sec)))
            if total_frames <= target_samples:
                frame_indices = list(range(total_frames))
            else:
                step = total_frames / target_samples
                frame_indices = [int(i * step) for i in range(target_samples)]

            samples = []
            max_detected = -1
            best_annotated = None
            total_cars, total_bikes, total_trucks, total_buses = 0, 0, 0, 0

            for f_idx in frame_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, f_idx)
                ret, frame = cap.read()
                if not ret or frame is None:
                    continue

                fh, fw, _ = frame.shape
                if max(fh, fw) > 720:
                    scale = 720.0 / max(fh, fw)
                    frame = cv2.resize(frame, (int(fw * scale), int(fh * scale)), interpolation=cv2.INTER_AREA)

                res = model.predict(frame, conf=confidence, imgsz=640, classes=[2, 3, 5, 7], verbose=False)[0]
                c_counts = {"car": 0, "bike": 0, "truck": 0, "bus": 0}
                for b in res.boxes:
                    cls_id = int(b.cls[0].item())
                    cls_name = vehicle_map.get(cls_id, "vehicle")
                    c_counts[cls_name] = c_counts.get(cls_name, 0) + 1

                f_total = sum(c_counts.values())
                total_cars += c_counts["car"]
                total_bikes += c_counts["bike"]
                total_trucks += c_counts["truck"]
                total_buses += c_counts["bus"]

                samples.append({
                    "second": round(f_idx / fps, 1),
                    "vehicles": f_total,
                    "cars": c_counts["car"],
                    "bikes": c_counts["bike"],
                    "trucks": c_counts["truck"],
                    "buses": c_counts["bus"]
                })

                if f_total > max_detected or best_annotated is None:
                    max_detected = f_total
                    annotated = frame.copy()
                    for box in res.boxes:
                        cid = int(box.cls[0].item())
                        cname = vehicle_map.get(cid, "vehicle")
                        x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                        color = class_colors.get(cname, (0, 255, 255))
                        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
                        cv2.putText(annotated, cname.upper(), (x1, max(15, y1 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)
                    best_annotated = annotated

            cap.release()

            num_samples = len(samples) or 1
            avg_vehicles = round(sum(s["vehicles"] for s in samples) / num_samples)
            avg_cars = round(total_cars / num_samples)
            avg_bikes = round(total_bikes / num_samples)
            avg_trucks = round(total_trucks / num_samples)
            avg_buses = round(total_buses / num_samples)

            traffic_pct = min(100, int((avg_vehicles / 35.0) * 100))
            traffic_level = "heavy" if traffic_pct >= 70 else ("medium" if traffic_pct >= 35 else "low")

            b64_img = ""
            if best_annotated is not None:
                ret, buf = cv2.imencode(".jpg", best_annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                if ret:
                    b64_img = f"data:image/jpeg;base64,{base64.b64encode(buf.tobytes()).decode('utf-8')}"

            elapsed_ms = round((time.time() - start_time) * 1000, 1)

            # Persist detected video traffic directly to SQLite database and broadcast to all connected UI clients
            target_area = area or "Alkapuri"
            try:
                db_res = db_manager.override_area_condition(
                    area_name=target_area,
                    cars=avg_cars,
                    bikes=avg_bikes,
                    trucks=avg_trucks,
                    buses=avg_buses,
                    vehicle_count=avg_vehicles,
                    traffic_percentage=traffic_pct,
                )
                if db_res.get("traffic"):
                    await manager.broadcast({"type": "traffic_update", "data": db_res["traffic"]})
                for alert in db_res.get("alerts", []):
                    await manager.broadcast({"type": "alert", "data": alert})
            except Exception as db_err:
                print(f"Warning: Failed to persist video traffic detection: {db_err}")

            return {
                "media_type": "video",
                "filename": file.filename,
                "area": area,
                "duration_seconds": duration_sec,
                "fps": fps,
                "total_frames": total_frames,
                "sampled_frames": len(samples),
                "total_vehicles": avg_vehicles,
                "peak_vehicles": max_detected,
                "cars": avg_cars,
                "bikes": avg_bikes,
                "trucks": avg_trucks,
                "buses": avg_buses,
                "traffic_percentage": traffic_pct,
                "traffic_level": traffic_level,
                "inference_time_ms": elapsed_ms,
                "annotated_preview": b64_img,
                "timeline": samples
            }
        finally:
            try:
                os.remove(tmp_path)
            except Exception:
                pass



@app.get("/api/yolo/status", response_model=YoloStatusOut)
async def get_yolo_status():
    return _build_yolo_status()


@app.post("/api/yolo/start", response_model=YoloStatusOut)
async def start_yolo(data: YoloStartIn):
    global yolo_process, yolo_started_at, yolo_config

    if _is_yolo_running():
        return _build_yolo_status()

    script_path = _yolo_script_path()
    if not script_path.exists():
        raise HTTPException(status_code=500, detail="YOLO service script not found")

    # Respect headless flag passed by client (default True)
    # Accept boolean or string values from clients
    if isinstance(data.headless, bool):
        headless_flag = data.headless
    else:
        headless_flag = str(data.headless).lower() in ("1", "true", "yes")

    cmd = _yolo_command(data.camera, data.area, data.confidence, headless=headless_flag)
    creation_flags = 0
    if os.name == "nt":
        # CREATE_NEW_PROCESS_GROUP so we can send CTRL_BREAK_EVENT for fast stop
        creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP

    try:
        yolo_process = subprocess.Popen(
            cmd,
            cwd=str(_repo_root()),
            creationflags=creation_flags,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to start YOLO service: {exc}")

    yolo_started_at = datetime.utcnow().isoformat()
    yolo_config = {
        "area": data.area,
        "camera": data.camera,
        "confidence": data.confidence,
        "headless": headless_flag,
    }
    return _build_yolo_status()


@app.post("/api/yolo/stop", response_model=YoloStatusOut)
async def stop_yolo():
    global yolo_process, yolo_started_at

    if not _is_yolo_running():
        yolo_process = None
        yolo_started_at = None
        return _build_yolo_status()

    assert yolo_process is not None
    try:
        if os.name == "nt":
            # On Windows, send CTRL_BREAK_EVENT which the YOLO service catches
            # via SIGBREAK handler to set _shutdown event — exits in < 1 second.
            os.kill(yolo_process.pid, signal.CTRL_BREAK_EVENT)
        else:
            yolo_process.terminate()

        yolo_process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        # If graceful shutdown didn't work, force kill
        yolo_process.kill()
        try:
            yolo_process.wait(timeout=3)
        except Exception:
            pass
    except Exception as exc:
        # Last resort — force kill
        try:
            yolo_process.kill()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to stop YOLO service: {exc}")

    yolo_process = None
    yolo_started_at = None
    return _build_yolo_status()

# ============================================
# WEBSOCKET ENDPOINT
# ============================================

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Fetch initial data from local SQLite database
        flood_data = []
        traffic_data = []
        alerts_data = []
        try:
            flood_data = db_manager.get_all_flood_data()
            traffic_data = db_manager.get_all_traffic_data()
            alerts_data = db_manager.get_all_alerts(10)
        except Exception as e:
            print(f"Error fetching initial websocket data: {e}")

        await websocket.send_json({
            "type": "init",
            "data": {
                "flood": flood_data,
                "traffic": traffic_data,
                "alerts": alerts_data,
            }
        })

        while True:
            # Keep connection alive and listen for messages
            data = await websocket.receive_text()
            msg = json.loads(data)
            
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
