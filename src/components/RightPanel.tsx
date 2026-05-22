/* ============================================
   RIGHT PANEL — Selection Details & Live Alerts
   ============================================ */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  Cpu,
  Play,
  Square,
  Clock3,
  Camera,
  MapPinned,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { VADODARA_AREAS } from '../data';
import { Alert, FloodSensor, TrafficData, YoloRuntimeStatus } from '../types';

interface RightPanelProps {
  alerts: Alert[];
  floodSensors: FloodSensor[];
  trafficData: TrafficData[];
  selectedPlot: { type: 'flood' | 'traffic', data: any } | null;
  onClearSelection: () => void;
  yoloStatus: YoloRuntimeStatus;
  isYoloBusy: boolean;
  selectedTrafficArea: string;
  onTrafficAreaChange: (area: string) => void;
  onStartYolo: (area: string, headless?: boolean) => Promise<void>;
  onStopYolo: () => Promise<void>;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
};

const formatRuntime = (startedAt: string | null) => {
  if (!startedAt) return 'Not running';
  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  if (elapsedMs < 60000) return `${Math.floor(elapsedMs / 1000)}s live`;
  if (elapsedMs < 3600000) return `${Math.floor(elapsedMs / 60000)}m live`;
  return `${Math.floor(elapsedMs / 3600000)}h live`;
};



export default function RightPanel({
  alerts,
  floodSensors,
  trafficData,
  selectedPlot,
  onClearSelection,
  yoloStatus,
  isYoloBusy,
  selectedTrafficArea,
  onTrafficAreaChange,
  onStartYolo,
  onStopYolo,
}: RightPanelProps) {
  const dangerSensors = floodSensors.filter(s => s.severity === 'danger').length;
  const heavyTraffic = trafficData.filter(t => t.traffic_level === 'heavy').length;
  const unreadAlerts = alerts.filter(a => !a.read);

  const [graphData, setGraphData] = useState<any[]>([]);

  useEffect(() => {
    if (trafficData.length === 0 && floodSensors.length === 0) return;
    const timeStr = new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const avgTraffic = trafficData.length ? trafficData.reduce((acc, curr) => acc + curr.traffic_percentage, 0) / trafficData.length : 0;
    const avgFlood = floodSensors.length ? floodSensors.reduce((acc, curr) => acc + curr.water_level, 0) / floodSensors.length : 0;
    
    setGraphData(prev => {
      const newGraph = [...prev, { time: timeStr, traffic: Math.round(avgTraffic), flood: Math.round(avgFlood) }];
      if (newGraph.length > 20) newGraph.shift(); // keep last 20 points
      return newGraph;
    });
  }, [trafficData, floodSensors]);

  return (
    <div
      className="right-panel w-[360px] h-full border-l backdrop-blur-md flex flex-col z-[100] shadow-inner"
      style={{ background: 'var(--t-right-panel-bg)', borderColor: 'var(--t-border)' }}
    >
      <AnimatePresence mode="wait">
        {selectedPlot ? (
          <motion.div
            key="details"
            initial={{ x: 350 }}
            animate={{ x: 0 }}
            exit={{ x: 350 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Detail Header - Simplified */}
            <div className="p-5" style={{ borderBottom: '1px solid var(--t-border)' }}>
              <div className="flex items-center justify-between mb-4">
                <div className={`px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase flex items-center gap-2 tracking-wider ${
                  selectedPlot.type === 'flood' ? 'bg-cyan-500/15 text-cyan-500' : 'bg-amber-500/15 text-amber-500'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    selectedPlot.type === 'flood' ? 'bg-cyan-400' : 'bg-amber-400'
                  }`} />
                  {selectedPlot.type.toUpperCase()}
                </div>
                <button 
                  onClick={onClearSelection}
                  className="p-1.5 rounded-lg transition"
                  style={{ color: 'var(--t-text-muted)' }}
                >
                  <X size={16} />
                </button>
              </div>

              <h3 className="text-lg font-extrabold mb-2 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                {selectedPlot.data.area_name}
              </h3>
              <div className="text-[11px] font-medium flex items-center gap-2" style={{ color: 'var(--t-text-muted)' }}>
                {selectedPlot.type === 'flood' ? (
                  <>
                    <span>Water Level</span>
                    <span className="font-bold" style={{ color: 'var(--t-text-primary)' }}>{selectedPlot.data.water_level.toFixed(1)}cm</span>
                  </>
                ) : (
                  <>
                    <span>Traffic</span>
                    <span className="font-bold" style={{ color: 'var(--t-text-primary)' }}>{selectedPlot.data.traffic_level}</span>
                  </>
                )}
              </div>
            </div>

            {/* Stats - Compact */}
            <div className="px-5 py-4 grid grid-cols-2 gap-3" style={{ borderBottom: '1px solid var(--t-border)' }}>
              <div className="p-3 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                <div className="text-[9px] font-semibold uppercase mb-2" style={{ color: 'var(--t-text-muted)' }}>Current Status</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-sm font-extrabold ${selectedPlot.type === 'flood' ? 'text-cyan-500' : 'text-amber-500'}`}>
                      {selectedPlot.type === 'flood' ? (
                        // Inverted mapping for dashboard: high cm => SAFE, low cm => DANGER
                        selectedPlot.data.water_level >= (selectedPlot.data.max_threshold ?? 180) ? 'SAFE' : selectedPlot.data.water_level >= (selectedPlot.data.warn_threshold ?? 100) ? 'WARNING' : 'DANGER'
                      ) : (
                        selectedPlot.data.traffic_level === 'heavy' ? 'HEAVY' : selectedPlot.data.traffic_level === 'medium' ? 'MEDIUM' : 'LOW'
                      )}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>{selectedPlot.type === 'flood' ? `${selectedPlot.data.water_level.toFixed(1)}cm` : `${selectedPlot.data.vehicle_count} vehicles`}</div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border" style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)' }}>
                      {selectedPlot.type === 'flood' ? <AlertTriangle className="text-cyan-400" size={18} /> : <Camera className="text-amber-400" size={18} />}
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-3 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                <div className="text-[9px] font-semibold uppercase mb-2" style={{ color: 'var(--t-text-muted)' }}>Quick Actions</div>
                <div className="flex flex-col gap-2">
                  <button className="w-full py-2 rounded-md bg-emerald-500/90 hover:bg-emerald-500 text-white text-xs font-semibold">Acknowledge</button>
                  <button className="w-full py-2 rounded-md bg-cyan-600/70 hover:bg-cyan-600 text-white text-xs font-semibold">Assign Team</button>
                </div>
              </div>
            </div>

            {/* Details Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="space-y-3">
                <div className="p-3 rounded-lg border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <div className="text-[9px] font-semibold uppercase mb-2" style={{ color: 'var(--t-text-muted)' }}>Details</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--t-text-muted)' }}>Location</span>
                      <span className="font-medium" style={{ color: 'var(--t-text-primary)' }}>{selectedPlot.data.area_name}</span>
                    </div>
                    {selectedPlot.type === 'flood' && (
                      <>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--t-text-muted)' }}>Max Threshold</span>
                          <span className="font-medium" style={{ color: 'var(--t-text-primary)' }}>{selectedPlot.data.max_threshold}cm</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--t-text-muted)' }}>Warning Level</span>
                          <span className="font-medium" style={{ color: 'var(--t-text-primary)' }}>{selectedPlot.data.warn_threshold}cm</span>
                        </div>
                      </>
                    )}
                    {selectedPlot.type === 'traffic' && (
                      <>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--t-text-muted)' }}>Total Vehicles</span>
                          <span className="font-medium" style={{ color: 'var(--t-text-primary)' }}>{selectedPlot.data.vehicle_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span style={{ color: 'var(--t-text-muted)' }}>Congestion %</span>
                          <span className="font-medium" style={{ color: 'var(--t-text-primary)' }}>{selectedPlot.data.traffic_percentage}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="p-5 flex items-center gap-3" style={{ borderTop: '1px solid var(--t-border)' }}>
              <button className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-white text-sm font-bold uppercase tracking-wide transition-transform active:scale-[0.98] inline-flex items-center justify-center gap-2">
                <MapPinned size={14} /> View Details
              </button>
              <a href={yoloStatus.running ? `http://127.0.0.1:9000/stream?ts=${Date.now()}` : '#'} target="_blank" rel="noreferrer" className="w-12 h-12 rounded-lg border flex items-center justify-center" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-glass)' }}>
                {yoloStatus.running ? <img src={`http://127.0.0.1:9000/stream?ts=${Date.now()}`} alt="cam" className="w-full h-full object-cover rounded-md"/> : <Camera size={16} style={{ color: 'var(--t-text-muted)' }} />}
              </a>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Command Control */}
            <div className="p-5 space-y-3" style={{ borderBottom: '1px solid var(--t-border)' }}>
              <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-surface)' }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Cpu size={16} className="text-cyan-400" />
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-500">Live Traffic AI</h2>
                  </div>
                  <span className={`text-[10px] font-semibold ${yoloStatus.running ? 'text-emerald-400' : ''}`} style={yoloStatus.running ? {} : { color: 'var(--t-text-muted)' }}>
                    {yoloStatus.running ? 'RUNNING' : 'IDLE'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-lg border p-2" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                    <div className="text-[9px] uppercase" style={{ color: 'var(--t-text-muted)' }}>Camera</div>
                    <div className="mt-1 text-xs font-semibold flex items-center gap-1" style={{ color: 'var(--t-text-primary)' }}>
                      <Camera size={11} className="text-cyan-400" /> {yoloStatus.camera ?? 0}
                    </div>
                  </div>
                  <div className="rounded-lg border p-2" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                    <div className="text-[9px] uppercase" style={{ color: 'var(--t-text-muted)' }}>Area</div>
                    <select
                      value={selectedTrafficArea}
                      onChange={(e) => onTrafficAreaChange(e.target.value)}
                      className="mt-1 w-full rounded-md border px-2 py-1 text-xs font-semibold outline-none focus:border-cyan-400"
                      style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text-primary)' }}
                    >
                      {VADODARA_AREAS.map((area) => (
                        <option key={area.name} value={area.name}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-lg border p-2" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                    <div className="text-[9px] uppercase" style={{ color: 'var(--t-text-muted)' }}>Runtime</div>
                    <div className="mt-1 text-xs text-emerald-400 font-semibold truncate">{formatRuntime(yoloStatus.started_at)}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => onStartYolo(selectedTrafficArea, false)}
                    disabled={isYoloBusy || yoloStatus.running}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-bold text-white transition"
                  >
                    <Play size={13} /> Start Camera
                  </button>
                  <button
                    onClick={onStopYolo}
                    disabled={isYoloBusy || !yoloStatus.running}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-500/90 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 text-xs font-bold text-white transition"
                  >
                    <Square size={12} /> Stop
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="text-[9px] font-semibold uppercase mb-1" style={{ color: 'var(--t-text-muted)' }}>Flood Risk</div>
                  <div className="text-2xl font-bold text-red-400">{dangerSensors}</div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[9px] font-semibold uppercase mb-1" style={{ color: 'var(--t-text-muted)' }}>Heavy Traffic</div>
                  <div className="text-2xl font-bold text-amber-400">{heavyTraffic}</div>
                </div>
              </div>
            </div>

            {/* Real-Time Graph */}
            <div className="p-5" style={{ borderBottom: '1px solid var(--t-border)' }}>
              <h3 className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--t-text-muted)' }}>Live System Metrics</h3>
              <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={graphData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border)" vertical={false} opacity={0.5} />
                      <XAxis dataKey="time" stroke="var(--t-text-muted)" fontSize={8} tickMargin={5} />
                      <YAxis stroke="var(--t-text-muted)" fontSize={8} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'var(--t-tooltip-bg)', borderColor: 'var(--t-border-glow)', borderRadius: '8px', fontSize: '10px', color: 'var(--t-text-primary)' }}
                        itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                      />
                      <Line type="monotone" dataKey="traffic" name="Traffic (%)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="flood" name="Flood (cm)" stroke="#fbbf24" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
              </div>
            </div>

            {/* Alerts List */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between shrink-0">
                <h3 className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--t-text-muted)' }}>
                  <AlertTriangle size={12} className="text-blue-400" />
                  Incident Feed
                </h3>
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[8px] font-bold">
                  {unreadAlerts.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-2">
                {alerts.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--t-text-muted)' }}>
                    No active alerts
                  </div>
                ) : (
                  alerts.map((alert, i) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`p-3 rounded-lg border transition-colors ${
                        alert.severity === 'danger'
                          ? 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'
                          : 'bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/15'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                          alert.severity === 'danger' ? 'bg-red-400' : 'bg-cyan-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-[10px] font-bold" style={{ color: 'var(--t-text-primary)' }}>{alert.area_name}</span>
                            <span className="text-[8px] shrink-0" style={{ color: 'var(--t-text-muted)' }}>{timeAgo(alert.created_at)}</span>
                          </div>
                          <p className="text-[9px] leading-snug" style={{ color: 'var(--t-text-secondary)' }}>
                            {alert.message}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-[8px] uppercase tracking-wide" style={{ color: 'var(--t-text-muted)' }}>
                            <span className="inline-flex items-center gap-1"><MapPinned size={10} />{alert.area_name}</span>
                            <span className="inline-flex items-center gap-1"><Clock3 size={10} />{timeAgo(alert.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
