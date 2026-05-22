/* ============================================
   FLOOD MONITORING DASHBOARD PAGE
   Water level cards, charts, alert history
   ============================================ */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Droplets, Wifi, WifiOff, AlertTriangle,
  TrendingUp, Clock, MapPin, Gauge, BarChart3
} from 'lucide-react';
import { FloodSensor, Alert } from '../types';
import { generateWaterLevelHistory } from '../data';

interface FloodPageProps {
  floodSensors: FloodSensor[];
  alerts: Alert[];
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const severityColors: Record<string, string> = {
  safe: '#06b6d4',
  warning: '#f59e0b',
  danger: '#ef4444',
};

export default function FloodMonitor({ floodSensors, alerts }: FloodPageProps) {
  const [selectedSensor, setSelectedSensor] = useState<string>(floodSensors[0]?.id || '');

  const floodAlerts = alerts.filter(a => a.alert_type === 'flood');
  const computeInvertedSeverity = (level: number, warn: number, max: number): 'safe' | 'warning' | 'danger' => {
    if (level >= max) return 'safe';
    if (level >= warn) return 'warning';
    return 'danger';
  };

  const mappedSeverities = floodSensors.map(s => computeInvertedSeverity(s.water_level, s.warn_threshold ?? 100, s.max_threshold ?? 180));
  const dangerCount = mappedSeverities.filter(v => v === 'danger').length;
  const warningCount = mappedSeverities.filter(v => v === 'warning').length;
  const onlineCount = floodSensors.filter(s => s.status === 'online').length;

  const waterHistory = useMemo(
    () => generateWaterLevelHistory(selectedSensor).map(h => ({
      ...h,
      time: new Date(h.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }),
    })),
    [selectedSensor]
  );

  const selected = floodSensors.find(s => s.id === selectedSensor);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 bg-grid">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Droplets size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Flood Monitoring Dashboard</h1>
            <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Real-time water level monitoring across Vadodara</p>
          </div>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Sensors', value: floodSensors.length, icon: Gauge, color: '#06b6d4', bg: 'from-cyan-500/10 to-blue-500/10' },
          { label: 'Online', value: onlineCount, icon: Wifi, color: '#10b981', bg: 'from-green-500/10 to-emerald-500/10' },
          { label: 'Flood Danger', value: dangerCount, icon: AlertTriangle, color: '#ef4444', bg: 'from-red-500/10 to-rose-500/10' },
          { label: 'Warnings', value: warningCount, icon: TrendingUp, color: '#f59e0b', bg: 'from-amber-500/10 to-yellow-500/10' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`glass-card p-4 bg-gradient-to-br ${card.bg}`}
          >
            <div className="flex items-center justify-between mb-2">
              <card.icon size={20} style={{ color: card.color }} />
              <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--t-text-muted)' }}>
                {card.label}
              </span>
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: card.color }}>
              {card.value}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Sensor Cards */}
        <div className="xl:col-span-1 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--t-text-secondary)' }}>
            <MapPin size={14} />
            Sensor Stations
          </h2>
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {floodSensors.map((sensor, i) => (
              <motion.div
                key={sensor.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedSensor(sensor.id)}
                className={`glass-card-sm p-3 cursor-pointer transition-all ${
                  selectedSensor === sensor.id
                    ? 'border-cyan-500/40 bg-cyan-500/5'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: severityColors[computeInvertedSeverity(sensor.water_level, sensor.warn_threshold ?? 100, sensor.max_threshold ?? 180)],
                        boxShadow: computeInvertedSeverity(sensor.water_level, sensor.warn_threshold ?? 100, sensor.max_threshold ?? 180) === 'danger'
                          ? `0 0 8px ${severityColors[computeInvertedSeverity(sensor.water_level, sensor.warn_threshold ?? 100, sensor.max_threshold ?? 180)]}88`
                          : 'none',
                      }}
                    />
                    <span className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>{sensor.area_name}</span>
                  </div>
                  {sensor.status === 'online' ? (
                    <Wifi size={13} className="text-green-400" />
                  ) : (
                    <WifiOff size={13} className="text-red-400" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Water Level</span>
                    <div className="text-lg font-bold font-mono" style={{ color: severityColors[computeInvertedSeverity(sensor.water_level, sensor.warn_threshold ?? 100, sensor.max_threshold ?? 180)] }}>
                      {sensor.water_level} <span className="text-xs font-normal" style={{ color: 'var(--t-text-muted)' }}>cm</span>
                    </div>
                  </div>
                  <div className="text-right">
                    {(() => {
                      const ds = computeInvertedSeverity(sensor.water_level, sensor.warn_threshold ?? 100, sensor.max_threshold ?? 180);
                      return (
                        <span className={`badge ${
                          ds === 'danger' ? 'badge-danger' : ds === 'warning' ? 'badge-warning' : 'badge-success'
                        }`}>
                          {ds.toUpperCase()}
                        </span>
                      );
                    })()}
                    <div className="text-[10px] mt-1 flex items-center gap-1 justify-end" style={{ color: 'var(--t-text-muted)' }}>
                      <Clock size={9} />
                      {timeAgo(sensor.last_updated)}
                    </div>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="mt-2 w-full h-1.5 rounded-full" style={{ background: 'var(--t-bg-muted)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: severityColors[computeInvertedSeverity(sensor.water_level, sensor.warn_threshold ?? 100, sensor.max_threshold ?? 180)] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (sensor.water_level / sensor.max_threshold) * 100)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px]" style={{ color: 'var(--t-text-muted)' }}>0 cm</span>
                    <span className="text-[9px]" style={{ color: 'var(--t-text-muted)' }}>{sensor.max_threshold} cm</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Water Level Chart */}
        <div className="xl:col-span-2 space-y-4">
          {/* Selected sensor info */}
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <BarChart3 size={18} className="text-cyan-400" />
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>
                      {selected.area_name} — Water Level History
                    </h3>
                    <p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>
                      Sensor {selected.id} • Last 24 hours
                    </p>
                  </div>
                </div>
                <span className={`badge ${
                  selected.severity === 'danger' ? 'badge-danger' :
                  selected.severity === 'warning' ? 'badge-warning' : 'badge-success'
                }`}>
                  {selected.water_level} cm
                </span>
              </div>

              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={waterHistory}>
                  <defs>
                    <linearGradient id="waterGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 260]} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--t-tooltip-bg)',
                      border: '1px solid var(--t-border-glow)',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: 'var(--t-text-primary)',
                    }}
                    labelStyle={{ color: 'var(--t-text-secondary)' }}
                  />
                  {/* Danger threshold line */}
                  <Line
                    type="monotone"
                    dataKey={() => selected.max_threshold}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    dot={false}
                    name="Danger Threshold"
                  />
                  {/* Warning threshold line */}
                  <Line
                    type="monotone"
                    dataKey={() => selected.warn_threshold}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    dot={false}
                    name="Warning Threshold"
                  />
                  <Area
                    type="monotone"
                    dataKey="level"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fill="url(#waterGradient)"
                    name="Water Level"
                    dot={false}
                    activeDot={{ r: 4, fill: '#06b6d4', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Alert History */}
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={16} className="text-amber-400" />
              <h3 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>Flood Alert History</h3>
              <span className="badge badge-warning ml-auto">{floodAlerts.length} alerts</span>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {floodAlerts.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: 'var(--t-text-muted)' }}>No flood alerts</p>
              ) : (
                floodAlerts.map((alert, i) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border"
                    style={{ background: 'var(--t-bg-inset)', borderColor: 'var(--t-border-subtle)' }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: severityColors[alert.severity] || '#06b6d4' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] truncate" style={{ color: 'var(--t-text-primary)' }}>{alert.message}</p>
                      <p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>
                        {alert.area_name} • {timeAgo(alert.created_at)}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
