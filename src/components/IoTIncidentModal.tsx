/* ============================================
   IOT SENSOR INGESTION & SMART INCIDENT CONSOLE
   Presentation-grade IoT hardware bridge & scenario generator
   ============================================ */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Radio, Waves, Car, Send, RefreshCw, Cpu, 
  Terminal, Copy, Check, ShieldAlert, Sparkles, AlertTriangle
} from 'lucide-react';
import { VADODARA_AREAS } from '../data';
import { useToast } from './ToastSystem';

interface IoTIncidentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAreaSelected?: (areaName: string) => void;
}

export default function IoTIncidentModal({ isOpen, onClose, onAreaSelected }: IoTIncidentModalProps) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'inject' | 'hardware'>('inject');
  
  // Form State
  const [selectedArea, setSelectedArea] = useState<string>('Alkapuri');
  const [waterLevel, setWaterLevel] = useState<number>(195.0);
  const [trafficPct, setTrafficPct] = useState<number>(88);
  const [deviceId, setDeviceId] = useState<string>('ESP32-HC-SR04-VAD01');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleApplyPreset = (type: 'flood' | 'traffic' | 'both' | 'safe') => {
    if (type === 'flood') {
      setWaterLevel(195.0);
      setTrafficPct(30);
    } else if (type === 'traffic') {
      setWaterLevel(15.0);
      setTrafficPct(92);
    } else if (type === 'both') {
      setWaterLevel(198.5);
      setTrafficPct(95);
    } else {
      setWaterLevel(0.0);
      setTrafficPct(22);
    }
  };

  const handleInjectTelemetry = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        device_id: deviceId,
        area_name: selectedArea,
        water_level: Number(waterLevel),
        traffic_percentage: Number(trafficPct),
        vehicle_count: Math.floor((Number(trafficPct) / 100) * 350),
        cars: Math.floor((Number(trafficPct) / 100) * 160),
        bikes: Math.floor((Number(trafficPct) / 100) * 120),
        trucks: Math.floor((Number(trafficPct) / 100) * 35),
        buses: Math.floor((Number(trafficPct) / 100) * 20),
        status: 'online',
        battery_pct: 98.4,
      };

      const res = await fetch('/api/iot/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => fetch('http://127.0.0.1:8000/api/iot/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }));

      if (!res.ok) {
        throw new Error('Failed to ingest IoT telemetry');
      }

      const data = await res.json();

      addToast({
        type: waterLevel >= 180 || trafficPct >= 75 ? 'danger' : 'info',
        category: waterLevel >= 180 ? 'flood' : 'traffic',
        title: `IoT Data Ingested: ${selectedArea}`,
        message: `Water: ${waterLevel.toFixed(1)}cm | Traffic: ${trafficPct}% (${payload.vehicle_count} vehicles). Map & Rerouting updated.`,
      });

      onAreaSelected?.(selectedArea);
      onClose();
    } catch (err: any) {
      addToast({
        type: 'danger',
        category: 'system',
        title: 'Ingestion Error',
        message: err.message || 'Could not communicate with IoT gateway.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const curlCommand = `curl -X POST http://127.0.0.1:8000/api/iot/ingest \\
  -H "Content-Type: application/json" \\
  -d '{
    "device_id": "${deviceId}",
    "area_name": "${selectedArea}",
    "water_level": ${waterLevel},
    "traffic_percentage": ${trafficPct},
    "status": "online"
  }'`;

  const arduinoCode = `// ESP32 IoT Node for Vadodara Smart City Telemetry
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://192.168.1.100:8000/api/iot/ingest";

// HC-SR04 Ultrasonic Sensor Pins
const int trigPin = 5;
const int echoPin = 18;

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWiFi connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  // 1. Measure water level via ultrasonic pulse
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  
  long duration = pulseIn(echoPin, HIGH);
  float distanceCm = duration * 0.034 / 2;
  float waterLevelCm = max(0.0f, 250.0f - distanceCm); // 250cm sensor mount height

  // 2. Transmit to Vadodara Smart City Backend
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    String payload = "{\\"device_id\\":\\"ESP32-${selectedArea}\\",\\"area_name\\":\\"${selectedArea}\\",\\"water_level\\":" + String(waterLevelCm, 1) + ",\\"status\\":\\"online\\"}";
    int httpResponseCode = http.POST(payload);
    Serial.printf("HTTP Response code: %d\\n", httpResponseCode);
    http.end();
  }
  delay(5000); // Sample every 5 seconds
}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md bg-black/60">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="glass-card flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border shadow-2xl"
        style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--t-border)' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ color: 'var(--t-text-primary)' }}>
                  IoT Hardware & Incident Simulator
                </h2>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-extrabold text-cyan-400 uppercase tracking-wider">
                  Live Bridge
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--t-text-secondary)' }}>
                Inject telemetry into any sector or copy production ESP32 hardware code
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b px-4" style={{ borderColor: 'var(--t-border)' }}>
          <button
            onClick={() => setActiveTab('inject')}
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inject'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={14} />
            <span>Simulate / Inject Incident</span>
          </button>

          <button
            onClick={() => setActiveTab('hardware')}
            className={`py-2.5 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'hardware'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu size={14} />
            <span>ESP32 / Real Device Code</span>
          </button>
        </div>

        {/* Tab 1: Live Incident Injection */}
        {activeTab === 'inject' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {/* Quick 1-Click Presets */}
            <div>
              <label className="text-[11px] uppercase tracking-wider font-extrabold block mb-2" style={{ color: 'var(--t-text-muted)' }}>
                1-Click Presentation Presets:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('flood')}
                  className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition text-left cursor-pointer flex flex-col gap-1"
                >
                  <span className="flex items-center gap-1">
                    <Waves size={13} />
                    <span>Flood Surge</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">195cm Danger Level</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('traffic')}
                  className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition text-left cursor-pointer flex flex-col gap-1"
                >
                  <span className="flex items-center gap-1">
                    <Car size={13} />
                    <span>Peak Gridlock</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">92% Congestion</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('both')}
                  className="p-2.5 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-bold transition text-left cursor-pointer flex flex-col gap-1"
                >
                  <span className="flex items-center gap-1">
                    <AlertTriangle size={13} />
                    <span>Dual Hazard</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Flood + Gridlock</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('safe')}
                  className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold transition text-left cursor-pointer flex flex-col gap-1"
                >
                  <span className="flex items-center gap-1">
                    <RefreshCw size={13} />
                    <span>Restore Safe</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">0cm Nominal Flow</span>
                </button>
              </div>
            </div>

            {/* Target Sector */}
            <div>
              <label className="text-xs font-bold block mb-1.5" style={{ color: 'var(--t-text-primary)' }}>
                Target Vadodara Sector:
              </label>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full rounded-xl border p-2.5 text-xs font-bold outline-none cursor-pointer"
                style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text-primary)' }}
              >
                {VADODARA_AREAS.map((a) => (
                  <option key={a.name} value={a.name} className="dark:bg-slate-900 dark:text-white bg-white text-slate-900">
                    {a.name} {a.name === 'Alkapuri' ? '(Railway Underpass & RC Dutt Rd)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Sliders: Water & Traffic */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Water Level */}
              <div className="p-3.5 rounded-xl border" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-cyan-400">
                    <Waves size={14} />
                    <span>Hydro Water Level</span>
                  </span>
                  <span className={`text-xs font-mono font-black ${waterLevel >= 180 ? 'text-rose-500' : waterLevel >= 100 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {Number(waterLevel).toFixed(1)} cm
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="250"
                  step="1"
                  value={waterLevel}
                  onChange={(e) => setWaterLevel(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>0cm (Dry)</span>
                  <span className="text-amber-400">100cm (Warn)</span>
                  <span className="text-rose-400">180cm (Danger)</span>
                </div>
              </div>

              {/* Traffic Density */}
              <div className="p-3.5 rounded-xl border" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
                    <Car size={14} />
                    <span>Traffic Road Density</span>
                  </span>
                  <span className={`text-xs font-mono font-black ${trafficPct >= 75 ? 'text-rose-500' : trafficPct >= 50 ? 'text-amber-500' : 'text-emerald-500'}`}>
                    {trafficPct}% ({Math.floor((trafficPct / 100) * 350)} veh)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={trafficPct}
                  onChange={(e) => setTrafficPct(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>0% (Empty)</span>
                  <span className="text-amber-400">50% (Moderate)</span>
                  <span className="text-rose-400">75% (Gridlock)</span>
                </div>
              </div>
            </div>

            {/* Ingestion Info Banner */}
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs text-slate-300 leading-relaxed">
              <strong>Live Telemetry Action:</strong> Submitting will instantly write to the SQLite database, dispatch a high-priority WebSocket telemetry event, and trigger the <strong>Smart AI Route Advisor</strong> to display alternative bypass roads around {selectedArea}.
            </div>
          </div>
        )}

        {/* Tab 2: Hardware & Code */}
        {activeTab === 'hardware' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
            {/* cURL Command */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold flex items-center gap-1.5 text-slate-300">
                  <Terminal size={14} className="text-cyan-400" />
                  <span>Terminal cURL Ingestion Request:</span>
                </span>
                <button
                  onClick={() => copyToClipboard(curlCommand)}
                  className="flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy cURL'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 text-cyan-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                {curlCommand}
              </pre>
            </div>

            {/* ESP32 Arduino Code */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold flex items-center gap-1.5 text-slate-300">
                  <Cpu size={14} className="text-emerald-400" />
                  <span>ESP32 Ultrasonic HC-SR04 Arduino Sketch:</span>
                </span>
                <button
                  onClick={() => copyToClipboard(arduinoCode)}
                  className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 cursor-pointer"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>Copy C++ Code</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10.5px] max-h-48 overflow-y-auto border border-slate-800 leading-relaxed">
                {arduinoCode}
              </pre>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-glass)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border text-xs font-bold transition hover:bg-white/5 cursor-pointer"
            style={{ borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' }}
          >
            Cancel
          </button>

          {activeTab === 'inject' ? (
            <button
              type="button"
              onClick={handleInjectTelemetry}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-cyan-500/25 cursor-pointer disabled:opacity-50"
            >
              <Send size={14} />
              <span>{isSubmitting ? 'Transmitting Telemetry...' : `Inject into ${selectedArea} & Calculate Reroute`}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('inject')}
              className="px-4 py-2 rounded-xl bg-cyan-500 text-white text-xs font-bold transition hover:bg-cyan-600 cursor-pointer"
            >
              Back to Simulator
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
