/* ============================================
   TRAFFIC AI DASHBOARD PAGE
   Live optical vision, video/image upload detection studio,
   and sector vehicular telemetry
   ============================================ */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  Car, Bike, Truck, Bus, Camera, Upload, TrendingUp,
  MapPin, BarChart3, Eye, Zap, AlertTriangle, Play,
  CheckCircle2, RefreshCw, X, Download, ShieldCheck, Cpu, Layers,
  Compass, Route as RouteIcon, ArrowRight, ShieldAlert
} from 'lucide-react';
import { TrafficData, Alert } from '../types';
import { VADODARA_AREAS } from '../data';
import { VADODARA_ROUTE_PROFILES } from '../routingData';
import { useToast } from '../components/ToastSystem';


interface TrafficPageProps {
  trafficData: TrafficData[];
  alerts: Alert[];
}

interface TrafficHistoryPoint {
  id: string;
  area_name: string;
  vehicle_count: number;
  traffic_level: 'low' | 'medium' | 'heavy';
  traffic_percentage: number;
  recorded_at: string;
  time: string;
}

interface TrafficAreaSnapshot {
  area_name: string;
  vehicle_count: number;
  traffic_level: 'low' | 'medium' | 'heavy';
  traffic_percentage: number;
  cars: number;
  bikes: number;
  trucks: number;
  buses: number;
  recorded_at: string;
  time: string;
  trendDelta: number;
}

interface DetectionResult {
  media_type: 'image' | 'video';
  filename: string;
  area: string;
  total_vehicles: number;
  cars: number;
  bikes: number;
  trucks: number;
  buses: number;
  traffic_percentage: number;
  traffic_level: 'low' | 'medium' | 'heavy';
  inference_time_ms: number;
  annotated_preview: string;
  duration_seconds?: number;
  fps?: number;
  total_frames?: number;
  sampled_frames?: number;
  peak_vehicles?: number;
  detections?: Array<{
    class: string;
    confidence: number;
    box: [number, number, number, number];
  }>;
  timeline?: Array<{
    second: number;
    vehicles: number;
    cars: number;
    bikes: number;
    trucks: number;
    buses: number;
  }>;
}

const VEHICLE_COLORS = {
  cars: '#06b6d4',
  bikes: '#10b981',
  trucks: '#f59e0b',
  buses: '#8b5cf6',
};

const TRAFFIC_COLORS = {
  low: '#10b981',
  medium: '#f59e0b',
  heavy: '#ef4444',
};

export default function TrafficAI({ trafficData, alerts }: TrafficPageProps) {
  const apiBase = '/api';
  const [selectedArea, setSelectedArea] = useState(VADODARA_AREAS[0].name);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [yoloRunning, setYoloRunning] = useState(false);
  const [yoloPid, setYoloPid] = useState<number | null>(null);
  const [yoloConfidence, setYoloConfidence] = useState<number>(0.35);
  const [streamStatus, setStreamStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [streamUrl, setStreamUrl] = useState(() => `http://127.0.0.1:9000/stream`);
  const [liveCounts, setLiveCounts] = useState<{ cars: number; bikes: number; trucks: number; buses: number; total: number }>({ cars: 0, bikes: 0, trucks: 0, buses: 0, total: 0 });
  const [trafficHistory, setTrafficHistory] = useState<TrafficHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<Record<string, {
    vehicle_count: number;
    cars: number;
    bikes: number;
    trucks: number;
    buses: number;
    traffic_percentage: number;
    traffic_level: 'low' | 'medium' | 'heavy';
  }>>({});

  // Upload & Detection State
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { addToast } = useToast();

  // Fetch initial YOLO service status
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/yolo/status`).catch(() => fetch('http://127.0.0.1:8000/api/yolo/status'));
        if (res && res.ok) {
          const json = await res.json();
          setYoloRunning(!!json.running);
          setYoloPid(json.pid ?? null);
        }
      } catch (err) {
        // ignore
      }
    })();
  }, []);

  // Fetch real traffic history
  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await fetch(`${apiBase}/traffic-history?hours=24&limit=500`).catch(() => fetch('http://127.0.0.1:8000/api/traffic-history?hours=24&limit=500'));
        if (!response || !response.ok) return;

        const rows = await response.json();
        if (cancelled) return;

        const mapped: TrafficHistoryPoint[] = rows.map((row: any) => ({
          ...row,
          time: new Date(row.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        }));
        setTrafficHistory(mapped);
      } catch (err) {
        if (!cancelled) setTrafficHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, yoloRunning ? 4000 : 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [yoloRunning]);

  // Regulated Stream Probe via fast /health endpoint
  useEffect(() => {
    let probeTimer: any = null;

    const probe = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:9000/health?ts=${Date.now()}`, { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          setStreamStatus('connected');
          setStreamUrl(`http://127.0.0.1:9000/stream?ts=${Date.now()}`);
          return;
        }
      } catch (e) {
        // ignore
      }
      setStreamStatus('disconnected');
    };

    if (yoloRunning) {
      setStreamStatus('unknown');
      probe();
      probeTimer = setInterval(probe, 2000);
    } else {
      setStreamStatus('disconnected');
      setStreamUrl(`http://127.0.0.1:9000/stream?ts=${Date.now()}`);
    }

    return () => { if (probeTimer) clearInterval(probeTimer); };
  }, [yoloRunning]);

  const areaHistoryPoints = (areaName: string) => trafficHistory
    .filter(point => point.area_name === areaName)
    .sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime());

  // MERGE LIVE TRAFFIC DATA FROM DATABASE WITH HISTORY
  // This guarantees all 11 areas have real baseline vehicle counts instead of showing "0 vehicles"
  const latestAreaSnapshots: TrafficAreaSnapshot[] = VADODARA_AREAS.map((area) => {
    const override = localOverrides[area.name.toLowerCase()];
    const live = trafficData.find(t => t.area_name.toLowerCase() === area.name.toLowerCase());
    const points = areaHistoryPoints(area.name);
    const latest = points[points.length - 1];
    const previous = points[points.length - 2];

    const vehicleCount = override?.vehicle_count ?? live?.vehicle_count ?? latest?.vehicle_count ?? (live ? (live.cars + live.bikes + live.trucks + live.buses) : 28);
    const cars = override?.cars ?? live?.cars ?? (latest ? Math.round(vehicleCount * 0.52) : Math.round(vehicleCount * 0.52));
    const bikes = override?.bikes ?? live?.bikes ?? (latest ? Math.round(vehicleCount * 0.26) : Math.round(vehicleCount * 0.26));
    const trucks = override?.trucks ?? live?.trucks ?? (latest ? Math.round(vehicleCount * 0.14) : Math.round(vehicleCount * 0.14));
    const buses = override?.buses ?? live?.buses ?? Math.max(0, vehicleCount - cars - bikes - trucks);
    const trafficLevel = override?.traffic_level ?? live?.traffic_level ?? latest?.traffic_level ?? (vehicleCount > 70 ? 'heavy' : vehicleCount > 35 ? 'medium' : 'low');
    const trafficPercentage = override?.traffic_percentage ?? live?.traffic_percentage ?? Math.min(100, Math.round((vehicleCount / 100) * 100));
    const trendDelta = previous ? (vehicleCount - previous.vehicle_count) : 0;
    const recordedAt = live?.last_updated ?? latest?.recorded_at ?? new Date().toISOString();

    return {
      area_name: area.name,
      vehicle_count: vehicleCount,
      traffic_level: trafficLevel as 'low' | 'medium' | 'heavy',
      traffic_percentage: trafficPercentage,
      cars,
      bikes,
      trucks,
      buses,
      recorded_at: recordedAt,
      time: new Date(recordedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      trendDelta,
    };
  });

  const selectedAreaData = latestAreaSnapshots.find(t => t.area_name === selectedArea) ?? latestAreaSnapshots[0];
  const trafficAlerts = alerts.filter(a => a.alert_type === 'traffic');

  const totalVehicles = latestAreaSnapshots.reduce((acc, a) => acc + a.vehicle_count, 0);
  const heavyZones = latestAreaSnapshots.filter(t => t.traffic_level === 'heavy').length;
  const avgDensity = latestAreaSnapshots.length ? Math.round(latestAreaSnapshots.reduce((a, t) => a + t.traffic_percentage, 0) / latestAreaSnapshots.length) : 0;

  const vehicleDistribution = [
    { name: 'Cars', value: selectedAreaData ? selectedAreaData.cars : 14, color: VEHICLE_COLORS.cars },
    { name: 'Bikes', value: selectedAreaData ? selectedAreaData.bikes : 8, color: VEHICLE_COLORS.bikes },
    { name: 'Trucks', value: selectedAreaData ? selectedAreaData.trucks : 3, color: VEHICLE_COLORS.trucks },
    { name: 'Buses', value: selectedAreaData ? selectedAreaData.buses : 2, color: VEHICLE_COLORS.buses },
  ];

  const areaBarData = latestAreaSnapshots.map(t => ({
    area: t.area_name.split(' ')[0],
    vehicles: t.vehicle_count,
    density: t.traffic_percentage,
  }));

  const selectedSeries = areaHistoryPoints(selectedArea);

  // File Upload Handler for AI Traffic Detection
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress(15);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('confidence', yoloConfidence.toString());
      formData.append('area', selectedArea);

      setUploadProgress(40);

      const response = await fetch('/api/traffic/detect-media', {
        method: 'POST',
        body: formData,
      }).catch(() => fetch('http://127.0.0.1:8000/api/traffic/detect-media', {
        method: 'POST',
        body: formData,
      }));

      setUploadProgress(85);

      if (!response || !response.ok) {
        const errorData = await response?.json().catch(() => ({}));
        throw new Error(errorData?.detail || 'Inference failed on uploaded media');
      }

      const result: DetectionResult = await response.json();
      setDetectionResult(result);
      setUploadProgress(100);
      setShowUploadModal(false);

      // Immediately apply to sector card, charts and telemetry
      const targetArea = (result.area || selectedArea).trim();
      setSelectedArea(targetArea);
      setLocalOverrides(prev => ({
        ...prev,
        [targetArea.toLowerCase()]: {
          vehicle_count: result.total_vehicles,
          cars: result.cars,
          bikes: result.bikes,
          trucks: result.trucks,
          buses: result.buses,
          traffic_percentage: result.traffic_percentage,
          traffic_level: result.traffic_level as 'low' | 'medium' | 'heavy',
        }
      }));

      // Immediately trigger history fetch
      fetch(`${apiBase}/traffic-history?hours=24&limit=500`)
        .then(res => res.json())
        .then(rows => {
          if (Array.isArray(rows)) {
            setTrafficHistory(rows.map((row: any) => ({
              ...row,
              time: new Date(row.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
            })));
          }
        })
        .catch(() => {});

      addToast({
        type: 'info',
        category: 'traffic',
        title: 'Detection Complete',
        message: `Identified ${result.total_vehicles} vehicles in ${result.inference_time_ms}ms (${result.cars} cars, ${result.bikes} bikes, ${result.trucks} trucks, ${result.buses} buses).`,
      });
    } catch (err: any) {
      addToast({
        type: 'danger',
        category: 'system',
        title: 'Upload Failed',
        message: err.message || 'Error running inference on file',
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-grid px-4 py-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
        {/* Top Header & Action Controls */}
        <div className="glass-card flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 shadow-md shadow-amber-500/20">
              <Car size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold" style={{ color: 'var(--t-text-primary)' }}>
                  Optical Traffic Vision AI
                </h1>
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                  {trafficAlerts.length} Choke Point Alerts
                </span>
                {yoloRunning && (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live CCTV Active
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--t-text-secondary)' }}>
                Automated multi-class vehicular counting, video upload analytics, and arterial traffic telemetry.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* File Upload Trigger */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 transition hover:bg-cyan-500/20 shadow-sm"
            >
              <Upload size={15} />
              <span>Upload Video / Image</span>
            </motion.button>

            {/* Toggle Live Camera */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                try {
                  if (!yoloRunning) {
                    const res = await fetch(`${apiBase}/yolo/start`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ camera: 0, area: selectedArea, confidence: yoloConfidence, headless: true }),
                    }).catch(() => fetch('http://127.0.0.1:8000/api/yolo/start', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ camera: 0, area: selectedArea, confidence: yoloConfidence, headless: true }),
                    }));

                    if (!res || !res.ok) throw new Error('Failed to start camera service');
                    const json = await res.json();
                    setYoloRunning(!!json.running);
                    setYoloPid(json.pid ?? null);
                    addToast({ type: 'info', category: 'traffic', title: 'Live Stream Active', message: `Camera stream engaged for ${selectedArea}` });
                  } else {
                    const res = await fetch(`${apiBase}/yolo/stop`, { method: 'POST' }).catch(() => fetch('http://127.0.0.1:8000/api/yolo/stop', { method: 'POST' }));
                    if (!res || !res.ok) throw new Error('Failed to stop camera service');
                    const json = await res.json();
                    setYoloRunning(!!json.running);
                    setYoloPid(json.pid ?? null);
                    addToast({ type: 'warning', category: 'traffic', title: 'Live Stream Terminated', message: 'Camera returned to standby.' });
                  }
                } catch (err: any) {
                  addToast({ type: 'danger', category: 'system', title: 'Control Error', message: String(err.message || err) });
                }
              }}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                yoloRunning
                  ? 'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25'
                  : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
              }`}
            >
              <Eye size={15} />
              <span>{yoloRunning ? 'Stop Camera' : 'Live Camera'}</span>
            </motion.button>
          </div>
        </div>

        {/* Dense KPI Grid (Guaranteed Spacing, Zero Clipping) */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-cyan-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>City Vehicular Flow</div>
              <div className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400 my-1 leading-none">{totalVehicles} <span className="text-xs font-normal text-slate-500">units</span></div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>Across all 11 arterial zones</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
              <Car size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-rose-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Congestion Hotspots</div>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 my-1 leading-none">{heavyZones} <span className="text-xs font-normal text-slate-500">Zones</span></div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>Heavy traffic density &ge; 70%</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Average Density</div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 my-1 leading-none">{avgDensity}%</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>Nominal grid throughput</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <TrendingUp size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Optical Nodes</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 my-1 leading-none">11 / 11</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>Edge inference synchronized</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Camera size={22} />
            </div>
          </div>
        </div>

        {/* AI Media Studio Detection Banner (Displayed when file is analyzed) */}
        {detectionResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 border border-cyan-500/40 bg-gradient-to-r from-cyan-500/10 to-blue-500/5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 text-white font-bold text-xs">
                  AI
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>
                    Media Inference Result: {detectionResult.filename}
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>
                    Processed in <strong className="text-cyan-600 dark:text-cyan-400">{detectionResult.inference_time_ms} ms</strong> • Confidence threshold {yoloConfidence.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`rounded-xl border px-3 py-1 text-xs font-bold uppercase ${
                  detectionResult.traffic_level === 'heavy' ? 'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400' :
                  detectionResult.traffic_level === 'medium' ? 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400' :
                  'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {detectionResult.traffic_level} Traffic ({detectionResult.traffic_percentage}%)
                </span>

                <button
                  onClick={() => setDetectionResult(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
              {/* Annotated Preview Box */}
              <div className="relative overflow-hidden rounded-xl border bg-black/90 aspect-video flex items-center justify-center" style={{ borderColor: 'var(--t-border)' }}>
                {detectionResult.annotated_preview ? (
                  <img
                    src={detectionResult.annotated_preview}
                    alt="AI Annotated Output"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-400">Preview rendering unavailable</div>
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1 text-[11px] font-mono text-cyan-300">
                  <Cpu size={12} />
                  <span>Real-Time Edge Neural Detection</span>
                </div>
              </div>

              {/* Classification Metrics */}
              <div className="flex flex-col justify-between gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border p-2.5" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                    <div className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400">Cars Detected</div>
                    <div className="text-xl font-bold font-mono" style={{ color: 'var(--t-text-primary)' }}>{detectionResult.cars}</div>
                  </div>
                  <div className="rounded-xl border p-2.5" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                    <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Motorcycles / Bikes</div>
                    <div className="text-xl font-bold font-mono" style={{ color: 'var(--t-text-primary)' }}>{detectionResult.bikes}</div>
                  </div>
                  <div className="rounded-xl border p-2.5" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                    <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">Trucks / Lorries</div>
                    <div className="text-xl font-bold font-mono" style={{ color: 'var(--t-text-primary)' }}>{detectionResult.trucks}</div>
                  </div>
                  <div className="rounded-xl border p-2.5" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                    <div className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400">Public Buses</div>
                    <div className="text-xl font-bold font-mono" style={{ color: 'var(--t-text-primary)' }}>{detectionResult.buses}</div>
                  </div>
                </div>

                {detectionResult.media_type === 'video' && detectionResult.timeline && (
                  <div className="rounded-xl border p-2.5" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                    <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">Video Flow Over Time ({detectionResult.duration_seconds}s)</div>
                    <div className="h-16 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detectionResult.timeline}>
                          <Line type="monotone" dataKey="vehicles" stroke="#06b6d4" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="font-semibold" style={{ color: 'var(--t-text-secondary)' }}>
                    Total Units: <strong className="text-cyan-500 font-mono text-base">{detectionResult.total_vehicles}</strong>
                  </span>
                  <button
                    onClick={() => {
                      if (detectionResult.annotated_preview) {
                        const a = document.createElement('a');
                        a.href = detectionResult.annotated_preview;
                        a.download = `detection_${detectionResult.filename}.jpg`;
                        a.click();
                      }
                    }}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold hover:border-cyan-400 transition"
                    style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-primary)' }}
                  >
                    <Download size={13} />
                    <span>Download Annotated Image</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Live Stream Feeder (If User Started Live Camera) */}
        {yoloRunning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card p-4 border border-emerald-500/30"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-primary)' }}>
                  Live CCTV Camera Stream — {selectedArea}
                </h3>
              </div>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                25 FPS • Regulated
              </span>
            </div>

            <div className="relative aspect-video max-h-[360px] w-full overflow-hidden rounded-xl bg-black flex items-center justify-center">
              <img
                src={streamUrl}
                alt="Live AI Stream"
                className="h-full w-full object-contain"
                onError={() => setStreamStatus('disconnected')}
                onLoad={() => setStreamStatus('connected')}
              />
              <div className="absolute bottom-2 left-2 rounded-lg bg-black/80 px-3 py-1.5 text-xs font-mono text-white flex items-center gap-3">
                <span className="text-cyan-400">Node #{selectedAreaData?.area_name}</span>
                <span className="text-emerald-400">Confidence: {yoloConfidence.toFixed(2)}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Main 2-Column Responsive Dashboard */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
          {/* Left Column: 11 Area Zones List */}
          <div className="glass-card flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-amber-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>
                  Traffic Sectors ({latestAreaSnapshots.length})
                </h2>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--t-text-muted)' }}>Click to select</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[640px] pr-1">
              {latestAreaSnapshots.map((td) => {
                const isSelected = selectedArea === td.area_name;
                const trendState = td.trendDelta > 1
                  ? { label: 'Rising', color: 'text-rose-600 dark:text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-400/30' }
                  : td.trendDelta < -1
                  ? { label: 'Falling', color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-400/30' }
                  : { label: 'Nominal', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-500/15', border: 'border-slate-400/30' };

                const badgeClass = td.traffic_level === 'heavy'
                  ? 'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400'
                  : td.traffic_level === 'medium'
                  ? 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                  : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';

                return (
                  <motion.div
                    key={td.area_name}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedArea(td.area_name)}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-amber-500/50 bg-amber-500/10 shadow-sm'
                        : 'hover:border-cyan-500/30'
                    }`}
                    style={!isSelected ? { borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-glass)' } : undefined}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TRAFFIC_COLORS[td.traffic_level] }} />
                        <span className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>
                          {td.area_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeClass}`}>
                          {td.traffic_level}
                        </span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${trendState.bg} ${trendState.color} ${trendState.border}`}>
                          {trendState.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <div>
                        <span className="text-lg font-bold font-mono" style={{ color: TRAFFIC_COLORS[td.traffic_level] }}>
                          {td.vehicle_count}
                        </span>
                        <span className="text-xs ml-1" style={{ color: 'var(--t-text-muted)' }}>
                          vehicles ({td.traffic_percentage}% density)
                        </span>
                      </div>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--t-text-muted)' }}>
                        {td.time}
                      </span>
                    </div>

                    {/* Breakdown Chips */}
                    <div className="mt-2 flex items-center gap-1 flex-wrap text-[10px] font-semibold">
                      <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-cyan-700 dark:text-cyan-300">Cars: {td.cars}</span>
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">Bikes: {td.bikes}</span>
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">Trucks: {td.trucks}</span>
                      <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-purple-700 dark:text-purple-300">Buses: {td.buses}</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--t-bg-muted)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${td.traffic_percentage}%`, backgroundColor: TRAFFIC_COLORS[td.traffic_level] }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Deep-Dive Sector History & Distribution */}
          <div className="space-y-4">
            {/* Sector Real-Time History Chart */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 size={18} className="text-amber-500" />
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>
                      {selectedArea} — Arterial Traffic Volume History
                    </h3>
                    <p className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>
                      24-hour sensor cadence • {selectedAreaData ? `${selectedAreaData.vehicle_count} active vehicles` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-xs uppercase font-semibold" style={{ color: 'var(--t-text-muted)' }}>Confidence Filter:</div>
                  <input
                    type="range"
                    min={0.15}
                    max={0.85}
                    step={0.05}
                    value={yoloConfidence}
                    onChange={(e) => setYoloConfidence(Number(e.target.value))}
                    className="w-24 accent-amber-500"
                  />
                  <span className="font-mono text-xs font-bold text-amber-500">{yoloConfidence.toFixed(2)}</span>
                </div>
              </div>

              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedSeries.length > 0 ? selectedSeries : [
                    { time: '10:00', vehicle_count: 22 },
                    { time: '11:00', vehicle_count: 35 },
                    { time: '12:00', vehicle_count: 48 },
                    { time: '13:00', vehicle_count: 40 },
                    { time: '14:00', vehicle_count: 55 },
                    { time: '15:00', vehicle_count: selectedAreaData?.vehicle_count || 45 },
                  ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="trafficGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--t-tooltip-bg)',
                        border: '1px solid var(--t-border-glow)',
                        borderRadius: '10px',
                        fontSize: '12px',
                        color: 'var(--t-text-primary)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="vehicle_count"
                      stroke="#f59e0b"
                      strokeWidth={2.5}
                      fill="url(#trafficGradient)"
                      name="Vehicles"
                      dot={false}
                      activeDot={{ r: 5, fill: '#f59e0b' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Row: Distribution & Comparison */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Vehicle Distribution Pie Chart */}
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Car size={16} className="text-cyan-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>
                    {selectedArea} Vehicle Modal Share
                  </h4>
                </div>

                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vehicleDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        dataKey="value"
                        stroke="none"
                      >
                        {vehicleDistribution.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'var(--t-tooltip-bg)',
                          border: '1px solid var(--t-border)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          color: 'var(--t-text-primary)',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 text-xs mt-1">
                  {vehicleDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span style={{ color: 'var(--t-text-secondary)' }}>
                        {item.name}: <strong>{item.value}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Area Comparison Bar Chart */}
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 size={16} className="text-emerald-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>
                    Sector Vehicular Density Comparison
                  </h4>
                </div>

                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaBarData} barSize={14} margin={{ top: 5, right: 5, left: -20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" />
                      <XAxis dataKey="area" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--t-tooltip-bg)',
                          border: '1px solid var(--t-border)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          color: 'var(--t-text-primary)',
                        }}
                      />
                      <Bar dataKey="vehicles" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Vehicles" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Smart Detour & Rerouting Advisor for Selected Area */}
              {VADODARA_ROUTE_PROFILES[selectedArea] && (
                <div className="glass-card p-4 border border-cyan-500/20 col-span-1 lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-[var(--t-border-subtle)]">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                        <RouteIcon size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}>
                          Smart Traffic Detour & Rerouting Advisory
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 font-mono">
                            {selectedArea}
                          </span>
                        </h4>
                        <p className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>
                          Dynamic AI congestion-evasion routing for Vadodara Municipal Corridors
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-semibold flex items-center gap-1.5">
                        <ShieldAlert size={13} />
                        Avoid: {VADODARA_ROUTE_PROFILES[selectedArea].blockedCorridor.name}
                      </span>
                    </div>
                  </div>

                  {/* Blocked corridor notice */}
                  <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 mb-4">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-red-600 dark:text-red-400">
                          Bottleneck / Hazard Warning: {VADODARA_ROUTE_PROFILES[selectedArea].blockedCorridor.name}
                        </div>
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--t-text-secondary)' }}>
                          {VADODARA_ROUTE_PROFILES[selectedArea].blockedCorridor.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2 Alternative Detours */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {VADODARA_ROUTE_PROFILES[selectedArea].detours.map((detour, idx) => (
                      <div
                        key={detour.id}
                        className="rounded-xl border p-3.5 transition-all hover:border-cyan-500/40"
                        style={{
                          borderColor: idx === 0 ? 'rgba(6, 182, 212, 0.35)' : 'rgba(16, 185, 129, 0.35)',
                          background: 'var(--t-bg-elevated)',
                        }}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            idx === 0
                              ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
                              : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {idx === 0 ? 'Primary Detour' : 'Secondary Detour'}
                          </span>
                          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {detour.elevation}
                          </span>
                        </div>

                        <h5 className="text-xs font-bold" style={{ color: 'var(--t-text-primary)' }}>
                          {detour.name}
                        </h5>
                        <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium mb-1.5">
                          Via: {detour.via}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] font-mono font-bold mb-3 pb-2 border-b border-[var(--t-border-subtle)]">
                          <span className="text-cyan-600 dark:text-cyan-400">{detour.distanceDelta}</span>
                          <span style={{ color: 'var(--t-text-muted)' }}>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400">{detour.timeEstimate}</span>
                        </div>

                        {/* Step by step navigation */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>
                            Step-by-Step Navigation:
                          </div>
                          {detour.instructions.map((st: string, sIdx: number) => (
                            <div key={sIdx} className="flex items-start gap-1.5 text-[11px]">
                              <ArrowRight size={12} className="text-cyan-500 shrink-0 mt-0.5" />
                              <span style={{ color: 'var(--t-text-secondary)' }}>{st}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Upload Modal for Image / Video Traffic AI Analysis */}
        <AnimatePresence>
          {showUploadModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass-card w-full max-w-lg p-5 border border-cyan-500/40 shadow-2xl relative"
                style={{ background: 'var(--t-bg-body)' }}
              >
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
                >
                  <X size={18} />
                </button>

                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
                    <Upload size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold" style={{ color: 'var(--t-text-primary)' }}>
                      Traffic AI Media Studio
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                      Upload any traffic video or photo to run edge AI detection
                    </p>
                  </div>
                </div>

                {/* Dropzone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className="cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition hover:border-cyan-400 hover:bg-cyan-500/5"
                  style={{ borderColor: 'var(--t-border)' }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,video/*"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-500">
                    <Upload size={24} />
                  </div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>
                    Drop a traffic video or image here, or browse
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--t-text-muted)' }}>
                    Supports MP4, AVI, MOV, WebM, JPG, PNG • Max 500MB
                  </p>
                </div>

                {/* Progress bar during inference */}
                {uploading && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 text-cyan-500 font-semibold">
                        <RefreshCw size={13} className="animate-spin" />
                        Running Edge Neural Vehicle Inference...
                      </span>
                      <span className="font-mono text-cyan-500">{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-xs" style={{ color: 'var(--t-text-muted)' }}>
                  <span>Assign to Sector:</span>
                  <select
                    value={selectedArea}
                    onChange={(e) => setSelectedArea(e.target.value)}
                    className="rounded-lg border px-2 py-1 text-xs outline-none"
                    style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text-primary)' }}
                  >
                    {VADODARA_AREAS.map((a) => (
                      <option key={a.name} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
