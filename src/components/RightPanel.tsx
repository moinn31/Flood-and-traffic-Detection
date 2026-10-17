/* ============================================
   RIGHT PANEL — Telemetry Inspector & Incident Stream
   Enterprise collapsible drawer
   ============================================ */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  Radio,
  Clock3,
  MapPinned,
  Droplets,
  Car,
  TrendingUp,
  Activity,
  Layers,
  ChevronRight
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  onClosePanel?: () => void;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

export default function RightPanel({
  alerts,
  floodSensors,
  trafficData,
  selectedPlot,
  onClearSelection,
  onClosePanel,
}: RightPanelProps) {
  const dangerSensors = floodSensors.filter(s => s.severity === 'danger' || s.water_level >= 180).length;
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
      if (newGraph.length > 15) newGraph.shift();
      return newGraph;
    });
  }, [trafficData, floodSensors]);

  return (
    <div
      className="w-[310px] lg:w-[330px] h-full flex flex-col z-[100] transition-colors"
      style={{ background: 'var(--t-right-panel-bg)', borderColor: 'var(--t-border)' }}
    >
      {/* Panel Header */}
      <div 
        className="px-4 py-3.5 border-b flex items-center justify-between shrink-0"
        style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}
      >
        <div className="flex items-center gap-2">
          <Activity size={15} className="text-cyan-500" />
          <h2 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--t-text-primary)' }}>
            Telemetry Inspector
          </h2>
        </div>

        {onClosePanel && (
          <button
            onClick={onClosePanel}
            className="p-1 rounded-lg hover:bg-black/5 transition text-slate-400 hover:text-slate-600 dark:hover:text-white"
            title="Close Panel"
          >
            <X size={15} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {selectedPlot ? (
          /* SECTOR DEEP-DIVE INSPECTOR */
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                selectedPlot.type === 'flood' ? 'bg-cyan-500/15 text-cyan-500 border border-cyan-500/30' : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
              }`}>
                {selectedPlot.type === 'flood' ? <Droplets size={11} /> : <Car size={11} />}
                {selectedPlot.type === 'flood' ? 'Hydro Sensor' : 'Traffic Node'}
              </span>

              <button
                onClick={onClearSelection}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                Clear Selection
              </button>
            </div>

            <div>
              <h3 className="text-base font-extrabold" style={{ color: 'var(--t-text-primary)' }}>
                {selectedPlot.data.area_name}
              </h3>
              <p className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>
                {selectedPlot.type === 'flood' ? 'Ultrasonic Flood Sensor' : 'Optical Vehicle Flow Counter'}
              </p>
            </div>

            {/* Metrics Breakdown */}
            {selectedPlot.type === 'flood' ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-400">Current Depth</span>
                    <span className="text-base font-black text-cyan-500">{Number(selectedPlot.data.water_level).toFixed(1)} cm</span>
                  </div>
                  {/* Gauge Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedPlot.data.water_level >= 180 ? 'bg-rose-500' :
                        selectedPlot.data.water_level >= 100 ? 'bg-amber-500' : 'bg-cyan-400'
                      }`}
                      style={{ width: `${Math.min(100, (selectedPlot.data.water_level / 200) * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 mt-1">
                    <span>0 cm (Safe)</span>
                    <span>100 cm (Warn)</span>
                    <span>180 cm (Max)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] text-slate-400 block font-bold">Severity</span>
                    <span className="font-extrabold uppercase text-xs text-emerald-500">
                      {selectedPlot.data.severity}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] text-slate-400 block font-bold">Sensor State</span>
                    <span className="font-extrabold uppercase text-xs text-cyan-500">Online</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="p-3 rounded-2xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-bold text-slate-400">Total Vehicle Count</span>
                    <span className="text-base font-black text-amber-500">{selectedPlot.data.vehicle_count}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedPlot.data.traffic_level === 'heavy' ? 'bg-rose-500' :
                        selectedPlot.data.traffic_level === 'medium' ? 'bg-amber-500' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${selectedPlot.data.traffic_percentage}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 text-right">
                    {selectedPlot.data.traffic_percentage}% Road Capacity
                  </div>
                </div>

                {/* Class Breakdown */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] text-slate-400 block">Cars</span>
                    <span className="font-black text-slate-800 dark:text-white">{selectedPlot.data.cars || 0}</span>
                  </div>
                  <div className="p-2 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] text-slate-400 block">Bikes</span>
                    <span className="font-black text-slate-800 dark:text-white">{selectedPlot.data.bikes || 0}</span>
                  </div>
                  <div className="p-2 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] text-slate-400 block">Trucks</span>
                    <span className="font-black text-slate-800 dark:text-white">{selectedPlot.data.trucks || 0}</span>
                  </div>
                  <div className="p-2 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] text-slate-400 block">Buses</span>
                    <span className="font-black text-slate-800 dark:text-white">{selectedPlot.data.buses || 0}</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* DEFAULT OVERVIEW & INCIDENT STREAM */
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Risk Summary Tiles */}
            <div className="p-3.5 border-b grid grid-cols-2 gap-2" style={{ borderColor: 'var(--t-border)' }}>
              <div className="p-2.5 rounded-xl border bg-rose-500/10 border-rose-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 block">Flood Risk</span>
                <span className="text-xl font-black text-rose-500">{dangerSensors} Sectors</span>
              </div>
              <div className="p-2.5 rounded-xl border bg-amber-500/10 border-amber-500/20">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">Gridlock</span>
                <span className="text-xl font-black text-amber-500">{heavyTraffic} Sectors</span>
              </div>
            </div>

            {/* Real-Time Sparkline */}
            <div className="p-3.5 border-b" style={{ borderColor: 'var(--t-border)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">City Telemetry Trend</span>
                <div className="flex items-center gap-2 text-[9px] font-semibold text-slate-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"/>Traffic</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Flood</span>
                </div>
              </div>
              <div className="h-[95px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={graphData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--t-border-subtle)" vertical={false} />
                    <XAxis dataKey="time" stroke="var(--t-text-muted)" fontSize={7} tickMargin={4} />
                    <YAxis stroke="var(--t-text-muted)" fontSize={7} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--t-tooltip-bg)', borderColor: 'var(--t-border)', borderRadius: '8px', fontSize: '10px', color: 'var(--t-text-primary)' }}
                    />
                    <Line type="monotone" dataKey="traffic" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="flood" stroke="#fbbf24" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Live Incident Stream */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--t-border)' }}>
                <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 text-slate-400">
                  <AlertTriangle size={12} className="text-amber-500" />
                  Incident Feed
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500/15 text-rose-500">
                  {unreadAlerts.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {alerts.length === 0 ? (
                  <div className="flex items-center justify-center h-28 text-xs text-slate-400">
                    No active emergency incidents
                  </div>
                ) : (
                  alerts.slice(0, 15).map((alert, i) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-2.5 rounded-xl border transition-colors ${
                        alert.severity === 'danger'
                          ? 'bg-red-500/10 border-red-500/25'
                          : 'bg-cyan-500/10 border-cyan-500/25'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                          alert.severity === 'danger' ? 'bg-red-500' : 'bg-cyan-500'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-center gap-1">
                            <span className="text-[10px] font-bold truncate" style={{ color: 'var(--t-text-primary)' }}>
                              {alert.area_name}
                            </span>
                            <span className="text-[8px] text-slate-400 shrink-0 font-medium">
                              {timeAgo(alert.created_at)}
                            </span>
                          </div>
                          <p className="text-[9px] leading-snug mt-0.5 line-clamp-2" style={{ color: 'var(--t-text-secondary)' }}>
                            {alert.message}
                          </p>
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
