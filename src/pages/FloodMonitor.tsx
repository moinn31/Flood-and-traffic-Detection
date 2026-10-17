/* ============================================
   FLOOD MONITORING DASHBOARD PAGE
   High-density hydrodynamic telemetry & flood risk
   ============================================ */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Line
} from 'recharts';
import {
  Droplets, Wifi, WifiOff, AlertTriangle,
  TrendingUp, Clock, MapPin, Gauge, BarChart3,
  Waves, ShieldCheck, Activity, Compass, ArrowUpRight
} from 'lucide-react';
import { FloodSensor, Alert } from '../types';
import { generateWaterLevelHistory } from '../data';

interface FloodPageProps {
  floodSensors: FloodSensor[];
  alerts: Alert[];
}

const timeAgo = (iso: string) => {
  if (!iso) return 'Just now';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const severityColors: Record<string, string> = {
  safe: '#10b981',     // Green
  warning: '#f59e0b',  // Amber
  danger: '#ef4444',   // Red
};

export default function FloodMonitor({ floodSensors, alerts }: FloodPageProps) {
  const [selectedSensor, setSelectedSensor] = useState<string>(floodSensors[0]?.id || 'FL-001');

  const floodAlerts = alerts.filter(a => a.alert_type === 'flood');

  // Correct severity: higher water level = danger
  const computeSeverity = (level: number, warn: number = 100, max: number = 180): 'safe' | 'warning' | 'danger' => {
    if (level >= max) return 'danger';
    if (level >= warn) return 'warning';
    return 'safe';
  };

  const dangerSensors = floodSensors.filter(s => computeSeverity(s.water_level, s.warn_threshold, s.max_threshold) === 'danger');
  const warningSensors = floodSensors.filter(s => computeSeverity(s.water_level, s.warn_threshold, s.max_threshold) === 'warning');
  const safeSensors = floodSensors.filter(s => computeSeverity(s.water_level, s.warn_threshold, s.max_threshold) === 'safe');
  const onlineCount = floodSensors.filter(s => s.status === 'online').length;

  const selected = floodSensors.find(s => s.id === selectedSensor) || floodSensors[0];

  const waterHistory = useMemo(
    () => generateWaterLevelHistory(selected?.id || 'FL-001').map(h => ({
      ...h,
      time: new Date(h.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    })),
    [selected?.id]
  );

  const selectedSeverity = selected ? computeSeverity(selected.water_level, selected.warn_threshold, selected.max_threshold) : 'safe';
  const selectedPct = selected ? Math.min(100, Math.round((selected.water_level / selected.max_threshold) * 100)) : 0;

  return (
    <div className="h-full overflow-y-auto bg-grid px-4 py-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
        {/* Top Header & Overview Bar */}
        <div className="glass-card flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
              <Droplets size={22} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold" style={{ color: 'var(--t-text-primary)' }}>
                  Hydrodynamic Flood Command
                </h1>
                <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-500">
                  Vishwamitri Basin
                </span>
                {dangerSensors.length > 0 && (
                  <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                    {dangerSensors.length} Overflow Zones
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--t-text-secondary)' }}>
                Real-time ultrasonic water level sensors, flood crest forecasts, and sluice gate telemetry.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)' }}>
              <Compass size={14} className="text-cyan-500" />
              <span>Catchment: <strong>11 Stations</strong></span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)' }}>
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>Drainage Grid: <strong>Operational</strong></span>
            </div>
          </div>
        </div>

        {/* Dense KPI Grid (Guaranteed Spacing, Zero Clipping) */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-cyan-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Total Stations</div>
              <div className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400 my-1 leading-none">{floodSensors.length}</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>Across 11 Vadodara sectors</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
              <Gauge size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Online Telemetry</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 my-1 leading-none">{onlineCount} <span className="text-xs font-normal text-slate-500">/ {floodSensors.length}</span></div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>100% gateway response</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Wifi size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-rose-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Flood Danger</div>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 my-1 leading-none">{dangerSensors.length}</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>&ge; 180cm critical threshold</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Warning Watch</div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 my-1 leading-none">{warningSensors.length}</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>100cm - 179cm advisory</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <TrendingUp size={22} />
            </div>
          </div>
        </div>

        {/* Main Work Surface (Balanced 2-Column Layout) */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_1fr]">
          {/* Left Column: Sensor Stations List */}
          <div className="glass-card flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={15} className="text-cyan-500" />
                <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>
                  Sensor Stations ({floodSensors.length})
                </h2>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: 'var(--t-text-muted)' }}>Click to inspect</span>
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[640px] pr-1">
              {floodSensors.map((sensor) => {
                const sev = computeSeverity(sensor.water_level, sensor.warn_threshold, sensor.max_threshold);
                const pct = Math.min(100, Math.round((sensor.water_level / sensor.max_threshold) * 100));
                const isSelected = selected?.id === sensor.id;

                const badgeClass =
                  sev === 'danger'
                    ? 'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400'
                    : sev === 'warning'
                    ? 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';

                const barColor =
                  sev === 'danger' ? '#ef4444' : sev === 'warning' ? '#f59e0b' : '#10b981';

                return (
                  <motion.div
                    key={sensor.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedSensor(sensor.id)}
                    className={`cursor-pointer rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-cyan-500/50 bg-cyan-500/10 shadow-sm'
                        : 'hover:border-cyan-500/30'
                    }`}
                    style={!isSelected ? { borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-glass)' } : undefined}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: barColor,
                            boxShadow: sev === 'danger' ? '0 0 8px rgba(239, 68, 68, 0.6)' : 'none',
                          }}
                        />
                        <span className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>
                          {sensor.area_name}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: 'var(--t-text-muted)' }}>
                          {sensor.id}
                        </span>
                      </div>

                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeClass}`}>
                        {sev}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between mt-1">
                      <div>
                        <span className="text-lg font-bold font-mono" style={{ color: barColor }}>
                          {sensor.water_level}
                        </span>
                        <span className="text-xs ml-1" style={{ color: 'var(--t-text-muted)' }}>
                          cm / {sensor.max_threshold} cm
                        </span>
                      </div>
                      <div className="text-[10px] flex items-center gap-1 font-mono" style={{ color: 'var(--t-text-muted)' }}>
                        <Clock size={10} />
                        {timeAgo(sensor.last_updated)}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--t-bg-muted)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Hydrodynamic Inspection Studio */}
          <div className="space-y-4">
            {/* Selected Station Deep-Dive & Telemetry Graph */}
            {selected && (
              <div className="glass-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
                      <BarChart3 size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>
                          {selected.area_name} — Hydrodynamic Sensor Log
                        </h3>
                        <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-600 dark:text-cyan-400">
                          {selected.id}
                        </span>
                      </div>
                      <p className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>
                        Catchment coordinates: {selected.latitude.toFixed(4)}°N, {selected.longitude.toFixed(4)}°E • Last 24 Hours
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xs uppercase font-semibold" style={{ color: 'var(--t-text-muted)' }}>Water Crest</div>
                      <div className="text-xl font-bold font-mono" style={{ color: severityColors[selectedSeverity] }}>
                        {selected.water_level} cm
                      </div>
                    </div>
                    <span className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase ${
                      selectedSeverity === 'danger'
                        ? 'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400'
                        : selectedSeverity === 'warning'
                        ? 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        : 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    }`}>
                      {selectedSeverity} ({selectedPct}%)
                    </span>
                  </div>
                </div>

                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={waterHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="floodWaterGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 240]} />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--t-tooltip-bg)',
                          border: '1px solid var(--t-border-glow)',
                          borderRadius: '10px',
                          fontSize: '12px',
                          color: 'var(--t-text-primary)',
                        }}
                      />
                      {/* Danger Line */}
                      <Line
                        type="monotone"
                        dataKey={() => selected.max_threshold}
                        stroke="#ef4444"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        dot={false}
                        name="Danger (180cm)"
                      />
                      {/* Warning Line */}
                      <Line
                        type="monotone"
                        dataKey={() => selected.warn_threshold}
                        stroke="#f59e0b"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                        dot={false}
                        name="Warning (100cm)"
                      />
                      <Area
                        type="monotone"
                        dataKey="level"
                        stroke="#06b6d4"
                        strokeWidth={2.5}
                        fill="url(#floodWaterGradient)"
                        name="Water Level (cm)"
                        dot={false}
                        activeDot={{ r: 5, fill: '#06b6d4' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Middle Split: Hydrodynamic Diagnostics & Incident Log */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Sluice Gate & Basin Diagnostics */}
              <div className="glass-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Waves size={16} className="text-cyan-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>
                    Basin Drainage Automation
                  </h4>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-elevated)' }}>
                    <span style={{ color: 'var(--t-text-secondary)' }}>Sluice Gate 4 (Ajwa Outlet)</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">OPEN 75% • Auto</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-elevated)' }}>
                    <span style={{ color: 'var(--t-text-secondary)' }}>Storm Drain Velocity</span>
                    <span className="font-semibold text-cyan-600 dark:text-cyan-400 font-mono">2.84 m/s (Rapid)</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-elevated)' }}>
                    <span style={{ color: 'var(--t-text-secondary)' }}>Pump Station Submersible Load</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">48% Capacity</span>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-elevated)' }}>
                    <span style={{ color: 'var(--t-text-secondary)' }}>Forecasted 6h Rainfall Crest</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 font-mono">+12.4 cm Expected</span>
                  </div>
                </div>
              </div>

              {/* Flood Alert History Log */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>
                      Flood Emergency Logs
                    </h4>
                  </div>
                  <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                    {floodAlerts.length} events
                  </span>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[160px] pr-1">
                  {floodAlerts.length === 0 ? (
                    <div className="py-6 text-center text-xs" style={{ color: 'var(--t-text-muted)' }}>
                      No active flood warnings reported.
                    </div>
                  ) : (
                    floodAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="flex items-start gap-2.5 rounded-xl border p-2.5 text-xs transition"
                        style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-elevated)' }}
                      >
                        <span
                          className="mt-1 h-2 w-2 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              alert.severity === 'danger'
                                ? '#ef4444'
                                : alert.severity === 'warning'
                                ? '#f59e0b'
                                : '#10b981',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-semibold truncate" style={{ color: 'var(--t-text-primary)' }}>
                              {alert.area_name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {timeAgo(alert.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-tight" style={{ color: 'var(--t-text-secondary)' }}>
                            {alert.message}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
