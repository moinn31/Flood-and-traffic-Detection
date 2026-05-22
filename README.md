# 🌊 Vadodara Smart Flood & Traffic Detection System

> Real-time smart city monitoring dashboard for flood detection and AI-powered traffic analysis in Vadodara, Gujarat, India.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Version](https://img.shields.io/badge/version-2.1.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Live Map │ │  Flood   │ │ Traffic  │ │    Alerts    │  │
│  │ Dashboard│ │ Monitor  │ │   AI     │ │    Center    │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘  │
│       └─────────────┴────────────┴──────────────┘          │
│                         │ Socket.IO / REST                  │
├─────────────────────────┼───────────────────────────────────┤
│                    BACKEND (FastAPI)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────┐   │
│  │ REST API │ │WebSocket │ │ Background Simulation    │   │
│  └────┬─────┘ └────┬─────┘ └────────────┬─────────────┘   │
│       └─────────────┴────────────────────┘                  │
│                         │                                   │
├─────────────────────────┼───────────────────────────────────┤
│  ┌──────────────┐  ┌────┴─────────┐  ┌──────────────────┐ │
│  │ YOLOv8 AI    │  │  PostgreSQL  │  │ ESP32 IoT        │ │
│  │ Detection    │  │  (Supabase)  │  │ Simulator        │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### 1. Frontend (React Dashboard)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open: **http://localhost:5173**

### 2. Backend (FastAPI)

```bash
# Install Python dependencies
cd backend
pip install -r requirements.txt

# Start server
uvicorn main:app --reload --port 8000
```

API Docs: **http://localhost:8000/docs**

### 3. YOLOv8 Traffic Detection (Optional)

```bash
# Install AI dependencies
cd yolo_service
pip install -r requirements.txt

# Webcam mode
python yolo_service.py --source webcam

# Video mode
python yolo_service.py --source video --path traffic_video.mp4
```

### 4. IoT Sensor Integration

This project expects real IoT devices (ESP32) to POST sensor readings to the backend or directly to Supabase. The previous built-in simulator has been removed — use your device firmware to send data to:

- Backend endpoint: `POST http://<backend-host>:8000/api/flood-data`
- Or write directly to Supabase `flood_sensors` / `water_level_history` tables.

## 📱 Features

### 🗺️ Live Map Dashboard
- Interactive Vadodara city map (dark theme)
- Real-time flood sensor markers (blue/amber/red)
- Traffic density markers with vehicle counts
- Click markers for detailed popups

### 🌊 Flood Monitoring
- Live water level cards per sensor
- Area chart with 24h water level history
- Danger/warning threshold lines
- Sensor online/offline status
- Alert history panel

### 🚗 Traffic AI Dashboard
- YOLOv8 vehicle detection results
- Vehicle distribution (cars, bikes, trucks, buses)
- Traffic density per area zone
- Peak hour traffic patterns
- Video upload for AI analysis

### 🔔 Alert System
- Real-time toast notifications
- Filter by type (flood/traffic)
- Filter by severity (danger/warning/info)
- Auto-generated alerts on threshold breach

## 🔌 API Endpoints

| Method | Endpoint             | Description              |
|--------|---------------------|--------------------------|
| GET    | `/api/flood-data`   | Get all flood sensors    |
| POST   | `/api/flood-data`   | Submit sensor reading    |
| GET    | `/api/traffic-data` | Get all traffic data     |
| POST   | `/api/traffic-data` | Submit traffic detection |
| GET    | `/api/alerts`       | Get recent alerts        |
| POST   | `/api/sensor-status`| Update sensor status     |
| WS     | `/ws/live`          | Real-time WebSocket      |

## 🗃️ Database Schema

Run `database/schema.sql` in Supabase SQL Editor to create tables.

## 🛠️ Tech Stack

| Layer     | Technology                        |
|-----------|----------------------------------|
| Frontend  | React, TypeScript, Vite          |
| Styling   | Tailwind CSS v4, Framer Motion   |
| Maps      | Leaflet.js, CARTO Dark Tiles    |
| Charts    | Recharts                         |
| Backend   | FastAPI, WebSockets              |
| AI        | YOLOv8, OpenCV                   |
| Database  | PostgreSQL (Supabase)            |
| IoT       | ESP32 (HTTP POST)                |

## 📍 Monitored Areas

- Alkapuri
- Akota
- Manjalpur
- Karelibaug
- Waghodia Road
- Fatehgunj
- Sayajigunj
- Gorwa
- Harni
- Gotri

---

**Vadodara Smart City** — Built for Gujarat's resilient future 🇮🇳
