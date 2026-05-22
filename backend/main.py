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

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://asczdgonhfaasskhwifc.supabase.co")
# Use an environment variable for the service key in production. The anonymous/anon key is used as a fallback for local testing.
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzY3pkZ29uaGZhYXNza2h3aWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzIwNDgsImV4cCI6MjA5NDM0ODA0OH0.JIFnECFks2QuxbDX-iIYt6R8m7mA7QROZSZTRXfOVlA")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

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
    return _repo_root() / "yolo_service" / "yolo_service.py"


def _yolo_model_path() -> Path:
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
        response = supabase.table("flood_data").select("*").execute()
        rows = response.data or []

        # Normalize records to match FloodDataOut expected fields
        def area_coords(name: str):
            for a in VADODARA_AREAS:
                if a["name"].lower() == (name or "").lower():
                    return a.get("lat"), a.get("lng")
            return None, None

        normalized = []
        for r in rows:
            lat, lng = area_coords(r.get("area_name") or r.get("area") or r.get("sensor_name"))
            water_level = r.get("water_level") or r.get("level") or 0
            severity = r.get("severity") or r.get("status") or (
                "danger" if water_level >= 180 else ("warning" if water_level >= 100 else "safe")
            )
            last_updated = r.get("last_updated") or r.get("updated_at") or r.get("created_at")

            normalized.append({
                "id": r.get("id") or r.get("sensor_id"),
                "sensor_name": r.get("sensor_name") or r.get("sensor") or r.get("sensor_id"),
                "area_name": r.get("area_name") or r.get("area") or r.get("sensor_name"),
                "latitude": lat or 0.0,
                "longitude": lng or 0.0,
                "water_level": float(water_level),
                "max_threshold": r.get("max_threshold", 180),
                "warn_threshold": r.get("warn_threshold", 100),
                "status": r.get("status") or r.get("flood_status") or "online",
                "severity": severity,
                "last_updated": last_updated,
            })

        return normalized
    except Exception as e:
        print(f"Error fetching flood data: {e}")
        return []

@app.post("/api/flood-data")
async def post_flood_data(data: FloodDataIn):
    severity = "danger" if data.water_level >= 180 else (
        "warning" if data.water_level >= 100 else "safe"
    )
    record = {
        "sensor_name": data.sensor_name,
        "area_name": data.area_name,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "water_level": data.water_level,
        "max_threshold": 180,
        "warn_threshold": 100,
        "status": data.status,
        "severity": severity,
        "last_updated": datetime.utcnow().isoformat(),
    }

    # Update or insert to Supabase
    try:
        existing = supabase.table("flood_data").select("id").eq("area_name", data.area_name).execute()
        if existing.data and len(existing.data) > 0:
            record["id"] = existing.data[0]["id"]
            
        result = supabase.table("flood_data").upsert(record).execute()
        if result.data:
            record["id"] = result.data[0]["id"]
        print(f"[DB] Flood data saved: {data.area_name} water_level={data.water_level}")
    except Exception as e:
        print(f"Supabase error (flood upsert): {e}")

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
            result = supabase.table("alerts").insert(alert).execute()
            if result.data:
                alert["id"] = result.data[0]["id"]
        except Exception as e:
            print(f"Supabase alert error: {e}")
        await manager.broadcast({"type": "alert", "data": alert})

    if "id" not in record:
        record["id"] = data.sensor_id  # Fallback for websocket

    await manager.broadcast({"type": "flood_update", "data": record})
    return {"status": "ok", "id": record["id"]}

@app.get("/api/traffic-data", response_model=List[TrafficDataOut])
async def get_traffic_data():
    try:
        response = supabase.table("traffic_data").select("*").execute()
        rows = response.data or []

        # Normalize traffic rows to include last_updated
        normalized = []
        for r in rows:
            last_updated = r.get("last_updated") or r.get("updated_at") or r.get("created_at")
            vehicle_count = r.get("vehicle_count") or (
                (r.get("cars", 0) or 0) + (r.get("bikes", 0) or 0) + (r.get("trucks", 0) or 0) + (r.get("buses", 0) or 0)
            )
            normalized.append({
                "id": r.get("id"),
                "area_name": r.get("area_name"),
                "latitude": r.get("latitude") or 0.0,
                "longitude": r.get("longitude") or 0.0,
                "cars": int(r.get("cars") or 0),
                "bikes": int(r.get("bikes") or r.get("motorcycle") or 0),
                "trucks": int(r.get("trucks") or 0),
                "buses": int(r.get("buses") or 0),
                "vehicle_count": int(vehicle_count),
                "traffic_level": r.get("traffic_level") or r.get("level") or "low",
                "traffic_percentage": int(r.get("traffic_percentage") or 0),
                "last_updated": last_updated,
            })

        return normalized
    except Exception as e:
        print(f"Error fetching traffic data: {e}")
        return []

@app.post("/api/traffic-data")
async def post_traffic_data(data: TrafficDataIn):
    total = data.cars + data.bikes + data.trucks + data.buses
    if total <= 0:
        return {"status": "skipped", "reason": "no vehicles detected", "area": data.area_name}

    pct = min(100, int((total / 350) * 100))
    level = "heavy" if pct >= 75 else ("medium" if pct >= 40 else "low")

    record = {
        "area_name": data.area_name,
        "latitude": data.latitude,
        "longitude": data.longitude,
        "cars": data.cars,
        "bikes": data.bikes,
        "trucks": data.trucks,
        "buses": data.buses,
        "vehicle_count": total,
        "traffic_level": level,
        "traffic_percentage": pct,
        "last_updated": datetime.utcnow().isoformat(),
    }

    # Update or insert to Supabase
    try:
        # Check if exists by area_name
        existing = supabase.table("traffic_data").select("id").eq("area_name", data.area_name).execute()
        if existing.data and len(existing.data) > 0:
            record["id"] = existing.data[0]["id"]
            
        result = supabase.table("traffic_data").upsert(record).execute()
        if result.data:
            record["id"] = result.data[0]["id"]
        print(f"[DB] Traffic data saved: {data.area_name} total={total} level={level}")
    except Exception as e:
        print(f"Supabase error (traffic upsert): {e}")

    # Also save to traffic_history for analytics
    try:
        history_record = {
            "area_name": data.area_name,
            "vehicle_count": total,
            "traffic_level": level,
            "traffic_percentage": pct,
        }
        supabase.table("traffic_history").insert(history_record).execute()
    except Exception as e:
        print(f"Supabase error (traffic_history insert): {e}")

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
            result = supabase.table("alerts").insert(alert).execute()
            if result.data:
                alert["id"] = result.data[0]["id"]
        except Exception as e:
            print(f"Supabase alert error: {e}")
        await manager.broadcast({"type": "alert", "data": alert})

    if "id" not in record:
        record["id"] = f"TR-{uuid.uuid4().hex[:6].upper()}"  # Fallback for websocket

    await manager.broadcast({"type": "traffic_update", "data": record})
    return {"status": "ok", "area": data.area_name}


@app.get("/api/traffic-history", response_model=List[TrafficHistoryOut])
async def get_traffic_history(area_name: Optional[str] = None, hours: int = 24, limit: int = 200):
    try:
        query = supabase.table("traffic_history").select("*").order("recorded_at", desc=True).limit(limit)
        if area_name:
            query = query.eq("area_name", area_name)

        response = query.execute()
        rows = response.data or []

        cutoff = datetime.utcnow().timestamp() - (hours * 3600)
        filtered = []
        for row in rows:
            recorded_at = row.get("recorded_at") or row.get("created_at")
            if not recorded_at:
                continue

            try:
                recorded_dt = datetime.fromisoformat(str(recorded_at).replace("Z", "+00:00"))
                if recorded_dt.timestamp() < cutoff:
                    continue
            except Exception:
                pass

            filtered.append({
                "id": row.get("id"),
                "area_name": row.get("area_name"),
                "vehicle_count": int(row.get("vehicle_count") or 0),
                "traffic_level": row.get("traffic_level") or "low",
                "traffic_percentage": int(row.get("traffic_percentage") or 0),
                "recorded_at": str(recorded_at),
            })

        # Return chronological order for charting
        return list(reversed(filtered))
    except Exception as e:
        print(f"Error fetching traffic history: {e}")
        return []

@app.get("/api/alerts", response_model=List[AlertOut])
async def get_alerts():
    try:
        response = supabase.table("alerts").select("*").order("created_at", desc=True).limit(20).execute()
        return response.data
    except Exception:
        return []

@app.post("/api/sensor-status")
async def update_sensor_status(data: SensorStatusIn):
    try:
        record = supabase.table("flood_data").select("*").eq("id", data.sensor_id).execute()
        if not record.data:
            raise HTTPException(status_code=404, detail="Sensor not found")
            
        updated = record.data[0]
        updated["status"] = data.status
        updated["last_updated"] = datetime.utcnow().isoformat()
        supabase.table("flood_data").upsert(updated).execute()
        
        await manager.broadcast({"type": "sensor_status", "data": updated})
        return {"status": "ok", "sensor_id": data.sensor_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
        # Fetch initial data from Supabase
        flood_data = []
        traffic_data = []
        alerts_data = []
        try:
            flood_data = supabase.table("flood_data").select("*").execute().data
            traffic_data = supabase.table("traffic_data").select("*").execute().data
            alerts_data = supabase.table("alerts").select("*").order("created_at", desc=True).limit(10).execute().data
        except Exception:
            pass

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
