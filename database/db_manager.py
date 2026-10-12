"""
============================================
LOCAL SQLITE DATABASE MANAGER
Reliable local storage with automatic fallback
============================================
"""

import sqlite3
import os
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Dict, Any

DB_PATH = Path(__file__).resolve().parent / "smart_city.db"

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

def get_connection():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Create tables and pre-populate if empty."""
    with get_connection() as conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS flood_data (
            id TEXT PRIMARY KEY,
            sensor_name TEXT,
            area_name TEXT NOT NULL UNIQUE,
            latitude REAL NOT NULL DEFAULT 0,
            longitude REAL NOT NULL DEFAULT 0,
            water_level REAL DEFAULT 0,
            max_threshold REAL DEFAULT 180,
            warn_threshold REAL DEFAULT 100,
            status TEXT DEFAULT 'online',
            severity TEXT DEFAULT 'safe',
            last_updated TEXT,
            created_at TEXT
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS traffic_data (
            id TEXT PRIMARY KEY,
            area_name TEXT NOT NULL UNIQUE,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            cars INTEGER DEFAULT 0,
            bikes INTEGER DEFAULT 0,
            trucks INTEGER DEFAULT 0,
            buses INTEGER DEFAULT 0,
            vehicle_count INTEGER DEFAULT 0,
            traffic_level TEXT DEFAULT 'low',
            traffic_percentage INTEGER DEFAULT 0,
            last_updated TEXT,
            created_at TEXT
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS traffic_history (
            id TEXT PRIMARY KEY,
            area_name TEXT NOT NULL,
            vehicle_count INTEGER NOT NULL,
            traffic_level TEXT NOT NULL,
            traffic_percentage INTEGER DEFAULT 0,
            recorded_at TEXT
        )
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            alert_type TEXT NOT NULL DEFAULT 'traffic',
            area_name TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT
        )
        """)

        # Pre-seed initial data if empty
        cur_flood = conn.execute("SELECT COUNT(*) FROM flood_data").fetchone()[0]
        now = datetime.utcnow().isoformat()
        if cur_flood == 0:
            for idx, area in enumerate(VADODARA_AREAS):
                sensor_id = f"FL-{idx+1:03d}"
                conn.execute("""
                INSERT OR IGNORE INTO flood_data 
                (id, sensor_name, area_name, latitude, longitude, water_level, max_threshold, warn_threshold, status, severity, last_updated, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    sensor_id, f"{area['name']} Sensor", area["name"], 
                    area["lat"], area["lng"], 35.0 + (idx * 7) % 50, 180.0, 100.0, 
                    "online", "safe", now, now
                ))

        cur_traffic = conn.execute("SELECT COUNT(*) FROM traffic_data").fetchone()[0]
        if cur_traffic == 0:
            for idx, area in enumerate(VADODARA_AREAS):
                tr_id = f"TR-{idx+1:03d}"
                conn.execute("""
                INSERT OR IGNORE INTO traffic_data 
                (id, area_name, latitude, longitude, cars, bikes, trucks, buses, vehicle_count, traffic_level, traffic_percentage, last_updated, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    tr_id, area["name"], area["lat"], area["lng"],
                    0, 0, 0, 0, 0, "low", 0, now, now
                ))

        # Also add initial seed history if empty so graphs look active immediately
        cur_hist = conn.execute("SELECT COUNT(*) FROM traffic_history").fetchone()[0]
        if cur_hist == 0:
            base_time = datetime.utcnow()
            for mins in range(60, 0, -10):
                sample_time = (base_time - timedelta(minutes=mins)).isoformat()
                for area in VADODARA_AREAS[:3]:
                    conn.execute("""
                    INSERT INTO traffic_history (id, area_name, vehicle_count, traffic_level, traffic_percentage, recorded_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        str(uuid.uuid4()), area["name"], 15 + (mins % 25), "low", 12 + (mins % 15), sample_time
                    ))

        conn.commit()

# --- Traffic Data Operations ---

def get_all_traffic_data() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM traffic_data").fetchall()
        return [dict(r) for r in rows]

def upsert_traffic_data(record: Dict[str, Any]) -> Dict[str, Any]:
    with get_connection() as conn:
        existing = conn.execute("SELECT id FROM traffic_data WHERE area_name = ?", (record["area_name"],)).fetchone()
        rec_id = existing["id"] if existing else record.get("id") or str(uuid.uuid4())
        record["id"] = rec_id

        conn.execute("""
        INSERT INTO traffic_data (id, area_name, latitude, longitude, cars, bikes, trucks, buses, vehicle_count, traffic_level, traffic_percentage, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(area_name) DO UPDATE SET
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            cars = excluded.cars,
            bikes = excluded.bikes,
            trucks = excluded.trucks,
            buses = excluded.buses,
            vehicle_count = excluded.vehicle_count,
            traffic_level = excluded.traffic_level,
            traffic_percentage = excluded.traffic_percentage,
            last_updated = excluded.last_updated
        """, (
            rec_id, record["area_name"], record["latitude"], record["longitude"],
            record.get("cars", 0), record.get("bikes", 0), record.get("trucks", 0), record.get("buses", 0),
            record.get("vehicle_count", 0), record.get("traffic_level", "low"),
            record.get("traffic_percentage", 0), record.get("last_updated", datetime.utcnow().isoformat())
        ))
        conn.commit()
    return record

def insert_traffic_history(record: Dict[str, Any]) -> Dict[str, Any]:
    with get_connection() as conn:
        rec_id = str(uuid.uuid4())
        rec_time = record.get("recorded_at") or datetime.utcnow().isoformat()
        conn.execute("""
        INSERT INTO traffic_history (id, area_name, vehicle_count, traffic_level, traffic_percentage, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            rec_id, record["area_name"], record["vehicle_count"],
            record["traffic_level"], record["traffic_percentage"], rec_time
        ))
        conn.commit()
        record["id"] = rec_id
        record["recorded_at"] = rec_time
    return record

def get_traffic_history(area_name: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        if area_name:
            rows = conn.execute(
                "SELECT * FROM traffic_history WHERE area_name = ? ORDER BY recorded_at DESC LIMIT ?",
                (area_name, limit)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM traffic_history ORDER BY recorded_at DESC LIMIT ?",
                (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

# --- Flood Data Operations ---

def get_all_flood_data() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM flood_data").fetchall()
        return [dict(r) for r in rows]

def upsert_flood_data(record: Dict[str, Any]) -> Dict[str, Any]:
    with get_connection() as conn:
        rec_id = record.get("id") or str(uuid.uuid4())
        conn.execute("""
        INSERT INTO flood_data (id, sensor_name, area_name, latitude, longitude, water_level, max_threshold, warn_threshold, status, severity, last_updated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(area_name) DO UPDATE SET
            water_level = excluded.water_level,
            status = excluded.status,
            severity = excluded.severity,
            last_updated = excluded.last_updated
        """, (
            rec_id, record.get("sensor_name", "Sensor"), record["area_name"],
            record.get("latitude", 0), record.get("longitude", 0),
            record.get("water_level", 0), record.get("max_threshold", 180),
            record.get("warn_threshold", 100), record.get("status", "online"),
            record.get("severity", "safe"), record.get("last_updated", datetime.utcnow().isoformat())
        ))
        conn.commit()
    return record

# --- Alert Operations ---

def get_all_alerts(limit: int = 20) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
        return [dict(r) for r in rows]

def insert_alert(alert: Dict[str, Any]) -> Dict[str, Any]:
    with get_connection() as conn:
        rec_id = str(uuid.uuid4())
        created_at = alert.get("created_at") or datetime.utcnow().isoformat()
        conn.execute("""
        INSERT INTO alerts (id, alert_type, area_name, severity, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            rec_id, alert.get("alert_type", "traffic"), alert["area_name"],
            alert.get("severity", "info"), alert["message"], created_at
        ))
        conn.commit()
        alert["id"] = rec_id
    return alert
