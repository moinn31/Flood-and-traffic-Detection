const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json());

// ================= ROBUST .ENV LOADER =================
function loadEnvFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
      return true;
    }
  } catch (e) {
    console.warn(`[Env] Could not load ${filePath}:`, e.message);
  }
  return false;
}

// Try dotenv first, then fallback to manual parsing across potential paths
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
} catch (e) {}

const candidateEnvPaths = [
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
  path.resolve(__dirname, ".env"),
  path.resolve(process.cwd(), ".env"),
];

for (const p of candidateEnvPaths) {
  loadEnvFile(p);
}

// ================= SUPABASE CLIENT INITIALIZATION =================
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://kjfgpaaaoqvffesrernv.supabase.co";

const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

let supabase = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("[Supabase] Client initialized successfully for:", supabaseUrl);
  } catch (err) {
    console.error("[Supabase] Client initialization error:", err.message);
  }
} else {
  console.warn("[Supabase] Warning: SUPABASE_URL or Key missing from environment.");
}

// Vadodara area coordinates mapping to prevent 0,0 positioning
const VADODARA_COORDINATES = {
  "Alkapuri":      { lat: 22.3110, lng: 73.1725 },
  "Akota":         { lat: 22.2950, lng: 73.1680 },
  "Manjalpur":     { lat: 22.2760, lng: 73.1930 },
  "Karelibaug":    { lat: 22.3230, lng: 73.2000 },
  "Waghodia Road": { lat: 22.3100, lng: 73.2200 },
  "Fatehgunj":     { lat: 22.3200, lng: 73.1850 },
  "Sayajigunj":    { lat: 22.3150, lng: 73.1900 },
  "Gorwa":         { lat: 22.3300, lng: 73.1600 },
  "Harni":         { lat: 22.3400, lng: 73.2100 },
  "Gotri":         { lat: 22.3050, lng: 73.1450 },
  "Subhanpura":    { lat: 22.3200, lng: 73.1600 },
};

// ================= TEST & STATUS ROUTE =================
app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "Vadodara Flood Telemetry IoT Server",
    port: 3000,
    supabaseConnected: !!supabase,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    supabase: supabase ? "connected" : "disconnected"
  });
});

// ================= API ENDPOINT =================
app.post("/flood", async (req, res) => {
  try {
    const data = req.body || {};
    console.log("[IoT Ingest] Received Data:", data);

    const areaName = data.area_name || "Gotri";
    const coords = VADODARA_COORDINATES[areaName] || { lat: 22.3050, lng: 73.1450 };

    // Fill valid coordinates if 0 or missing
    const latitude =
      data.latitude && Number(data.latitude) !== 0
        ? Number(data.latitude)
        : coords.lat;

    const longitude =
      data.longitude && Number(data.longitude) !== 0
        ? Number(data.longitude)
        : coords.lng;

    const waterLevel = Number(data.water_level ?? 0);
    const maxThreshold = Number(data.max_threshold ?? 180);
    const warnThreshold = Number(data.warn_threshold ?? 100);

    // Calculate severity
    let severity = (data.severity || "").toLowerCase();
    if (!severity || severity === "unknown") {
      if (warnThreshold < maxThreshold) {
        if (waterLevel >= maxThreshold) severity = "danger";
        else if (waterLevel >= warnThreshold) severity = "warning";
        else severity = "safe";
      } else {
        // Ultrasonic distance mode
        if (waterLevel <= maxThreshold) severity = "danger";
        else if (waterLevel <= warnThreshold) severity = "warning";
        else severity = "safe";
      }
    }

    const record = {
      sensor_name: data.sensor_name || `${areaName} Sensor`,
      area_name: areaName,
      latitude: latitude,
      longitude: longitude,
      water_level: waterLevel,
      max_threshold: maxThreshold,
      warn_threshold: warnThreshold,
      status: data.status || "online",
      severity: severity,
      last_updated: new Date().toISOString()
    };

    // Lazily re-init Supabase client if it wasn't ready earlier
    if (!supabase && supabaseUrl && supabaseKey) {
      try {
        supabase = createClient(supabaseUrl, supabaseKey);
      } catch (e) {
        console.error("[Supabase] Re-init error:", e.message);
      }
    }

    let supabaseSaved = false;
    if (supabase) {
      try {
        const { data: upsertData, error: upsertError } = await supabase
          .from("flood_data")
          .upsert(record, { onConflict: "area_name" })
          .select();

        if (upsertError) {
          console.error("[Supabase] Upsert error:", upsertError.message);
        } else {
          console.log(`[Supabase] Telemetry synced for ${areaName} (Level: ${waterLevel} cm, Severity: ${severity})`);
          supabaseSaved = true;
        }
      } catch (sbErr) {
        console.error("[Supabase] Execution error:", sbErr.message);
      }
    } else {
      console.warn("[Supabase] Skipped cloud sync: client not connected");
    }

    // Optional: Relay to local FastAPI backend for live WebSocket broadcast & SQLite update
    try {
      fetch("http://127.0.0.1:8000/api/flood-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sensor_id: `ESP8266-${areaName}`,
          sensor_name: record.sensor_name,
          area_name: record.area_name,
          water_level: record.water_level,
          latitude: record.latitude,
          longitude: record.longitude,
          max_threshold: record.max_threshold,
          warn_threshold: record.warn_threshold,
          severity: record.severity,
          status: record.status
        }),
        signal: AbortSignal.timeout(1500)
      }).catch(() => {});
    } catch (_) {}

    res.status(200).json({
      success: true,
      message: "Flood telemetry processed successfully",
      supabase_synced: supabaseSaved,
      record: record
    });
  } catch (err) {
    console.error("[Server Error]:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ================= START SERVER =================
const PORT = process.env.FLOOD_SERVER_PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`===========================================`);
  console.log(`  Vadodara Flood IoT Server Running`);
  console.log(`  Port: ${PORT} (0.0.0.0)`);
  console.log(`  Supabase: ${supabase ? "Connected" : "Disconnected"}`);
  console.log(`  Endpoint: POST http://<IP>:${PORT}/flood`);
  console.log(`===========================================`);
});
