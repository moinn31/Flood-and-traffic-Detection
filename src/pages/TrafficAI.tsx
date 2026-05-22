/* ============================================
   TRAFFIC AI DASHBOARD PAGE
   Vehicle detection, traffic analysis, charts
   ============================================ */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  Car, Bike, Truck, Bus, Camera, Upload, TrendingUp,
  MapPin, BarChart3, Eye, Zap, AlertTriangle
} from 'lucide-react';
import { TrafficData, Alert } from '../types';
import { VADODARA_AREAS } from '../data';
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

interface TrafficHistoryAggregate {
  vehicles: number;
  cars: number;
  bikes: number;
  trucks: number;
  buses: number;
  density: number;
  traffic_level: 'low' | 'medium' | 'heavy';
  latestAt: string | null;
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
  const [showUpload, setShowUpload] = useState(false);
  const [yoloRunning, setYoloRunning] = useState(false);
  const [yoloPid, setYoloPid] = useState<number | null>(null);
  const [yoloConfidence, setYoloConfidence] = useState<number>(0.4);
  const [streamStatus, setStreamStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [streamUrl, setStreamUrl] = useState(() => `http://127.0.0.1:9000/stream`);
  const [liveCounts, setLiveCounts] = useState<{ cars: number; bikes: number; trucks: number; buses: number; total: number }>({ cars: 0, bikes: 0, trucks: 0, buses: 0, total: 0 });
  const [trafficHistory, setTrafficHistory] = useState<TrafficHistoryPoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/yolo/status`);
        const json = await res.json();
        setYoloRunning(!!json.running);
        setYoloPid(json.pid ?? null);
      } catch (err) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const response = await fetch(`${apiBase}/traffic-history?hours=24&limit=500`);
        if (!response.ok) return;

        const rows = await response.json();
        if (cancelled) return;

        const mapped: TrafficHistoryPoint[] = rows.map((row: any) => ({
          ...row,
          time: new Date(row.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        }));
        setTrafficHistory(mapped);

        const latest = mapped.find(point => point.area_name === selectedArea) ?? mapped[0];
        if (latest) {
          setLiveCounts({
            cars: Math.max(0, Math.round(latest.vehicle_count * 0.52)),
            bikes: Math.max(0, Math.round(latest.vehicle_count * 0.26)),
            trucks: Math.max(0, Math.round(latest.vehicle_count * 0.14)),
            buses: Math.max(0, latest.vehicle_count - Math.round(latest.vehicle_count * 0.52) - Math.round(latest.vehicle_count * 0.26) - Math.round(latest.vehicle_count * 0.14)),
            total: latest.vehicle_count,
          });
        }
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
  }, [selectedArea, yoloRunning]);

  // Update stream URL (add timestamp) and probe stream when YOLO starts/stops
  useEffect(() => {
    let probeTimer: any = null;
    const base = 'http://127.0.0.1:9000/stream';

    const probe = async () => {
      try {
        // add timestamp to avoid caching
        const probeUrl = `${base}?ts=${Date.now()}`;
        const res = await fetch(probeUrl, { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          setStreamStatus('connected');
          setStreamUrl(probeUrl);
          return;
        }
      } catch (e) {
        // ignore
      }
      setStreamStatus('disconnected');
    };

    if (yoloRunning) {
      setStreamStatus('unknown');
      // immediate probe
      probe();
      // probe repeatedly for a short period while the stream becomes available
      probeTimer = setInterval(probe, 2000);
    } else {
      // when stopped, mark disconnected and update URL to a fresh ts
      setStreamStatus('disconnected');
      setStreamUrl(`${base}?ts=${Date.now()}`);
    }

    return () => { if (probeTimer) clearInterval(probeTimer); };
  }, [yoloRunning]);

  const latestPerArea = trafficHistory.reduce<Record<string, TrafficHistoryPoint>>((acc, point) => {
    const existing = acc[point.area_name];
    if (!existing || new Date(point.recorded_at).getTime() > new Date(existing.recorded_at).getTime()) {
      acc[point.area_name] = point;
    }
    return acc;
  }, {});

  const areaHistoryPoints = (areaName: string) => trafficHistory
    .filter(point => point.area_name === areaName)
    .sort((left, right) => new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime());

  const latestAreaSnapshots: TrafficAreaSnapshot[] = VADODARA_AREAS.map((area) => {
    const points = areaHistoryPoints(area.name);
    const latest = points[points.length - 1];
    const previous = points[points.length - 2];
    const vehicleCount = latest?.vehicle_count ?? 0;
    const trendDelta = vehicleCount - (previous?.vehicle_count ?? vehicleCount);
    return {
      area_name: area.name,
      vehicle_count: vehicleCount,
      traffic_level: latest?.traffic_level ?? 'low',
      traffic_percentage: latest?.traffic_percentage ?? 0,
      cars: Math.max(0, Math.round(vehicleCount * 0.52)),
      bikes: Math.max(0, Math.round(vehicleCount * 0.26)),
      trucks: Math.max(0, Math.round(vehicleCount * 0.14)),
      buses: Math.max(0, vehicleCount - Math.round(vehicleCount * 0.52) - Math.round(vehicleCount * 0.26) - Math.round(vehicleCount * 0.14)),
      recorded_at: latest?.recorded_at ?? '',
      time: latest?.time ?? '',
      trendDelta,
    };
  });

  const historySummary: TrafficHistoryAggregate = trafficHistory.reduce<TrafficHistoryAggregate>(
    (acc, point, index) => {
      const share = point.vehicle_count;
      const isLatest = index === trafficHistory.length - 1;
      return {
        vehicles: acc.vehicles + point.vehicle_count,
        cars: acc.cars + Math.max(0, Math.round(share * 0.52)),
        bikes: acc.bikes + Math.max(0, Math.round(share * 0.26)),
        trucks: acc.trucks + Math.max(0, Math.round(share * 0.14)),
        buses: acc.buses + Math.max(0, share - Math.round(share * 0.52) - Math.round(share * 0.26) - Math.round(share * 0.14)),
        density: acc.density + point.traffic_percentage,
        traffic_level: point.traffic_level,
        latestAt: isLatest ? point.recorded_at : acc.latestAt,
      };
    },
    { vehicles: 0, cars: 0, bikes: 0, trucks: 0, buses: 0, density: 0, traffic_level: 'low', latestAt: null }
  );

  const trafficAlerts = alerts.filter(a => a.alert_type === 'traffic');
  const selectedAreaData = latestAreaSnapshots.find(t => t.area_name === selectedArea) ?? latestAreaSnapshots[0] ?? null;
  const fallbackAreaData = trafficData.find(t => t.area_name === selectedArea) ?? trafficData[0] ?? null;
  const displayAreaData = selectedAreaData ?? fallbackAreaData;
  const totalVehicles = yoloRunning ? liveCounts.total : displayAreaData?.vehicle_count ?? historySummary.vehicles;
  const totalCars = yoloRunning ? liveCounts.cars : displayAreaData?.cars ?? historySummary.cars;
  const totalBikes = yoloRunning ? liveCounts.bikes : displayAreaData?.bikes ?? historySummary.bikes;
  const heavyZones = latestAreaSnapshots.filter(t => t.traffic_level === 'heavy').length;
  const avgDensity = latestAreaSnapshots.length ? Math.round(latestAreaSnapshots.reduce((a, t) => a + t.traffic_percentage, 0) / latestAreaSnapshots.length) : 0;
  const latestHistoryLabel = historySummary.latestAt ? new Date(historySummary.latestAt).toLocaleString('en-IN', { hour12: false }) : 'No history yet';

  const vehicleDistribution = [
    { name: 'Cars', value: totalCars, color: VEHICLE_COLORS.cars },
    { name: 'Bikes', value: totalBikes, color: VEHICLE_COLORS.bikes },
    { name: 'Trucks', value: yoloRunning ? liveCounts.trucks : displayAreaData?.trucks ?? historySummary.trucks, color: VEHICLE_COLORS.trucks },
    { name: 'Buses', value: yoloRunning ? liveCounts.buses : displayAreaData?.buses ?? historySummary.buses, color: VEHICLE_COLORS.buses },
  ];

  const areaBarData = latestAreaSnapshots.map(t => {
    return {
      area: t.area_name.split(' ')[0],
      vehicles: yoloRunning && t.area_name === selectedArea ? liveCounts.total : t.vehicle_count,
      density: t.traffic_percentage,
    };
  });

  const selectedSeries = areaHistoryPoints(selectedArea);

  return (
    <div className="h-full overflow-y-auto bg-grid px-4 py-5 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-5">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 lg:p-5"
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-red-600 shadow-lg shadow-amber-500/20">
                <Car size={22} className="text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Traffic AI Dashboard</h1>
                  <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-500">
                    {trafficAlerts.length} active alerts
                  </span>
                </div>
                <p className="mt-1 text-sm" style={{ color: 'var(--t-text-secondary)' }}>A simplified view of live traffic zones, detection controls, and recent trends.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowUpload(!showUpload)}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-medium text-cyan-500 transition hover:bg-cyan-500/15"
              >
                <Upload size={16} />
                Upload Video
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={async () => {
                  try {
                    if (!yoloRunning) {
                      const res = await fetch(`${apiBase}/yolo/start`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ camera: 0, area: selectedArea, confidence: yoloConfidence, headless: false }),
                      });
                      if (!res.ok) throw new Error('Failed to start YOLO');
                      const json = await res.json();
                      setYoloRunning(!!json.running);
                      setYoloPid(json.pid ?? null);
                      addToast({ type: 'info', category: 'traffic', title: 'YOLO Started', message: `YOLO started for ${selectedArea}` });
                    } else {
                      const res = await fetch(`${apiBase}/yolo/stop`, { method: 'POST' });
                      if (!res.ok) throw new Error('Failed to stop YOLO');
                      const json = await res.json();
                      setYoloRunning(!!json.running);
                      setYoloPid(json.pid ?? null);
                      addToast({ type: 'warning', category: 'traffic', title: 'YOLO Stopped', message: 'YOLO stopped' });
                    }
                  } catch (err) {
                    console.error('YOLO control error', err);
                    addToast({ type: 'danger', category: 'system', title: 'YOLO Error', message: String(err) });
                  }
                }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium ${yoloRunning ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-green-500/30 bg-green-500/10 text-green-300'}`}
              >
                <Eye size={16} />
                {yoloRunning ? 'Stop AI' : 'Start AI'}
              </motion.button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[1.4fr_1fr_0.8fr]">
            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--t-text-muted)' }}>Traffic Area</div>
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none focus:border-cyan-400"
                style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text-primary)' }}
              >
                {VADODARA_AREAS.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs" style={{ color: 'var(--t-text-muted)' }}>Used for the live feed, YOLO processing, and the selected-area charts.</p>
            </div>

            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--t-text-muted)' }}>Confidence</div>
              <div className="flex items-center gap-3">
                <input type="range" min={0.1} max={0.9} step={0.05} value={yoloConfidence} onChange={(e) => setYoloConfidence(Number(e.target.value))} className="w-full" />
                <div className="w-12 text-right font-mono text-sm" style={{ color: 'var(--t-text-primary)' }}>{yoloConfidence.toFixed(2)}</div>
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--t-text-muted)' }}>Lower values detect more, higher values filter noise.</p>
            </div>

            <div className="rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
              <div className="mb-2 text-[11px] uppercase tracking-[0.18em]" style={{ color: 'var(--t-text-muted)' }}>System</div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>{yoloRunning ? 'Live AI Running' : 'AI Idle'}</div>
                  <div className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{displayAreaData ? `${displayAreaData.area_name} • ${displayAreaData.traffic_percentage}% density` : 'No area selected'}</div>
                </div>
                <div className={`h-3 w-3 rounded-full ${yoloRunning ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              </div>
              <div className="mt-3 text-xs" style={{ color: 'var(--t-text-muted)' }}>Latest sample: {latestHistoryLabel}</div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Total Vehicles', value: totalVehicles, icon: Car, color: '#06b6d4', bg: 'from-cyan-500/10 to-blue-500/10' },
            { label: 'Heavy Zones', value: heavyZones, icon: AlertTriangle, color: '#ef4444', bg: 'from-red-500/10 to-rose-500/10' },
            { label: 'Avg Density', value: `${avgDensity}%`, icon: TrendingUp, color: '#f59e0b', bg: 'from-amber-500/10 to-yellow-500/10' },
            { label: 'AI Cameras', value: trafficData.length, icon: Camera, color: '#10b981', bg: 'from-green-500/10 to-emerald-500/10' },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`glass-card p-4 bg-gradient-to-br ${card.bg}`}
            >
              <div className="flex items-center justify-between">
                <card.icon size={18} style={{ color: card.color }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>{card.label}</span>
              </div>
              <div className="mt-3 text-2xl font-bold font-mono" style={{ color: card.color }}>
                {card.value}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-amber-400" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>Area Zones</h2>
                </div>
                <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>{latestAreaSnapshots.length} areas</span>
              </div>

              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {latestAreaSnapshots.map((td, i) => {
                  const trendState = td.trendDelta > 1 ? { label: 'Rising', color: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-400/20' } : td.trendDelta < -1 ? { label: 'Falling', color: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-400/20' } : { label: 'Stable', color: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-400/20' };
                  const latestStamp = td.recorded_at ? new Date(td.recorded_at).toLocaleString('en-IN', { hour12: false }) : 'No history yet';

                  return (
                  <motion.button
                    key={td.area_name}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedArea(td.area_name)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                      selectedArea === td.area_name
                        ? 'border-amber-400/30 bg-amber-500/8 shadow-[0_0_0_1px_rgba(245,158,11,0.08)]'
                        : 'hover:border-cyan-400/20'
                    }`}
                    style={selectedArea !== td.area_name ? { borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-glass)' } : undefined}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>{td.area_name}</div>
                        <div className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{td.vehicle_count} vehicles</div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`badge ${td.traffic_level === 'heavy' ? 'badge-danger' : td.traffic_level === 'medium' ? 'badge-warning' : 'badge-success'}`}>
                          {td.traffic_level.toUpperCase()}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${trendState.bg} ${trendState.color} ${trendState.border}`}>
                          {trendState.label}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-[10px] text-[#94a3b8]">
                      <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-300">Cars {td.cars}</span>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-300">Bikes {td.bikes}</span>
                      <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-300">Trucks {td.trucks}</span>
                      <span className="rounded-full bg-purple-500/10 px-2 py-1 text-purple-300">Buses {td.buses}</span>
                    </div>

                    <div className="mt-2 text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Latest: {latestStamp}</div>

                    <div className="mt-3 h-1.5 rounded-full" style={{ background: 'var(--t-bg-muted)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: TRAFFIC_COLORS[td.traffic_level] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${td.traffic_percentage}%` }}
                        transition={{ duration: 0.7 }}
                      />
                    </div>
                  </motion.button>
                  );
                })}
              </div>
            </div>

            {showUpload && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-4"
              >
                <div className="mb-3 flex items-center gap-2">
                  <Camera size={18} className="text-cyan-400" />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>Traffic Video Analysis</h3>
                </div>
                <div className="rounded-2xl border border-dashed p-6 text-center" style={{ borderColor: 'var(--t-border)' }}>
                  <Upload size={28} className="mx-auto mb-2" style={{ color: 'var(--t-text-muted)' }} />
                  <p className="text-sm" style={{ color: 'var(--t-text-secondary)' }}>Drop a traffic video or click to upload</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--t-text-muted)' }}>MP4, AVI, MOV • Max 500MB</p>
                </div>
              </motion.div>
            )}
          </div>

          <div className="space-y-4">
            {yoloRunning && (
              <div className="glass-card p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>Live YOLO Stream</h3>
                    <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>{selectedArea}</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)' }}>
                    <span className={`h-2 w-2 rounded-full ${streamStatus === 'connected' ? 'bg-emerald-400' : streamStatus === 'disconnected' ? 'bg-red-500' : 'bg-slate-500'}`} />
                    {streamStatus === 'connected' ? 'Live' : streamStatus === 'disconnected' ? 'Offline' : 'Checking'}
                  </div>
                </div>

                <div className="relative h-64 overflow-hidden rounded-2xl bg-black/40">
                  <img
                    src={streamUrl}
                    alt="YOLO stream"
                    className="h-full w-full object-cover"
                    onLoad={() => setStreamStatus('connected')}
                    onError={() => setStreamStatus('disconnected')}
                  />

                  <div className="absolute left-3 bottom-3 flex flex-wrap gap-2 rounded-xl bg-black/60 px-3 py-2 text-sm text-white">
                    <span className="flex items-center gap-1.5"><Car size={14} className="text-cyan-300" /> {liveCounts.cars}</span>
                    <span className="flex items-center gap-1.5"><Bike size={14} className="text-green-300" /> {liveCounts.bikes}</span>
                    <span className="flex items-center gap-1.5"><Truck size={14} className="text-amber-300" /> {liveCounts.trucks}</span>
                    <span className="flex items-center gap-1.5"><Bus size={14} className="text-purple-300" /> {liveCounts.buses}</span>
                    <span className="ml-1 text-xs text-slate-300">Total {liveCounts.total}</span>
                  </div>
                </div>
              </div>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 size={16} className="text-amber-400" />
                  <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>{selectedArea} — Real-time Traffic History</h3>
                </div>
                <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Last 24 hours</span>
              </div>
              {historyLoading && (
                <div className="mb-2 text-xs" style={{ color: 'var(--t-text-muted)' }}>Loading real traffic history from the database...</div>
              )}
              {!historyLoading && selectedSeries.length === 0 && (
                <div className="mb-2 text-xs text-amber-300">No history found for this area yet. The graph will populate after new samples are inserted.</div>
              )}
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={selectedSeries}>
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
                  <Line type="monotone" dataKey="vehicle_count" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#f59e0b', stroke: '#0a0e1a', strokeWidth: 2 }} name="Vehicles" />
                </LineChart>
              </ResponsiveContainer>
            </motion.div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="glass-card p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>
                  <Car size={14} className="text-cyan-400" />
                  Vehicle Distribution
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={vehicleDistribution} cx="50%" cy="50%" innerRadius={48} outerRadius={74} dataKey="value" stroke="none">
                      {vehicleDistribution.map((entry, index) => <Cell key={index} fill={entry.color} />)}
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
                <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {vehicleDistribution.map((item) => (
                    <div key={item.name} className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[10px]" style={{ color: 'var(--t-text-secondary)' }}>{item.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>
                  <BarChart3 size={14} className="text-green-400" />
                  Area Comparison
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={areaBarData} barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" />
                    <XAxis dataKey="area" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
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
          </div>
        </div>
      </div>
    </div>
  );
}
