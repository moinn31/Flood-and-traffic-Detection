import { useState } from 'react';
import { FloodSensor, TrafficData, Alert, YoloRuntimeStatus, NavRouteOption } from '../types';
import { GoogleRoutePlanner } from '../components/GoogleRoutePlanner';
import CityMap from '../components/CityMap';
import RightPanel from '../components/RightPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Waves, Car, Cpu, RefreshCw, FileText, 
  X, Printer, ShieldAlert, PanelRightClose, PanelRight, Radio, Route, Compass
} from 'lucide-react';
import { useToast } from '../components/ToastSystem';
import IoTIncidentModal from '../components/IoTIncidentModal';


interface DashboardProps {
  floodSensors: FloodSensor[];
  trafficData: TrafficData[];
  alerts: Alert[];
  theme: 'light' | 'dark';
  isSimplified: boolean;
  yoloStatus: YoloRuntimeStatus;
  isYoloBusy: boolean;
  selectedTrafficArea: string;
  onTrafficAreaChange: (area: string) => void;
  onStartYolo: (area: string, headless?: boolean) => Promise<void>;
  onStopYolo: () => Promise<void>;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
}

export default function Dashboard({ 
  floodSensors, 
  trafficData, 
  alerts, 
  theme, 
  isSimplified,
  yoloStatus,
  isYoloBusy,
  selectedTrafficArea,
  onTrafficAreaChange,
  onStartYolo,
  onStopYolo,
  rightPanelOpen = true,
  onToggleRightPanel,
}: DashboardProps) {
  const [selectedPlot, setSelectedPlot] = useState<{ type: 'flood' | 'traffic', data: any } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showIoTModal, setShowIoTModal] = useState(false);
  const [focusedAreaName, setFocusedAreaName] = useState<string>('Alkapuri');
  const [activeNavRoutes, setActiveNavRoutes] = useState<NavRouteOption[]>([]);
  const [selectedNavRouteId, setSelectedNavRouteId] = useState<string | null>(null);
  const [showRoutePlanner, setShowRoutePlanner] = useState<boolean>(false);
  const { addToast } = useToast();


  const floodDangers = floodSensors.filter(sensor => 
    sensor.severity === 'danger' || sensor.water_level >= (sensor.max_threshold ?? 180)
  ).length;
  const floodWarnings = floodSensors.filter(sensor => sensor.severity === 'warning').length;
  const trafficHotspots = trafficData.filter(item => item.traffic_level === 'heavy').length;
  const unreadAlerts = alerts.filter(alert => !alert.read).length;
  const activeSensors = floodSensors.filter(s => s.status === 'online').length;
  const totalVehicles = trafficData.reduce((acc, t) => acc + (t.vehicle_count || 0), 0);
  const maxWaterLevel = floodSensors.length > 0 
    ? Math.max(...floodSensors.map(s => Number(s.water_level) || 0)) 
    : 0;

  // City Threat Level
  const isCritical = floodDangers > 0 || trafficHotspots >= 3 || unreadAlerts >= 5;
  const isElevated = !isCritical && (floodWarnings > 0 || trafficHotspots > 0);
  const threatLabel = isCritical ? 'Critical (Level 3)' : isElevated ? 'Elevated (Level 2)' : 'Nominal (Level 1)';
  const threatBadgeClass = isCritical 
    ? 'bg-rose-500/15 text-rose-500 border-rose-500/30' 
    : isElevated 
    ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' 
    : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';

  // Simulation Triggers
  const handleSimulate = async (type: 'flood' | 'traffic') => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      }).catch(() => fetch('http://127.0.0.1:8000/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      }));
      if (!res.ok) throw new Error('Simulation failed');
      const data = await res.json();
      addToast({
        type: 'danger',
        category: type === 'flood' ? 'flood' : 'traffic',
        title: `Simulation Active: ${type.toUpperCase()}`,
        message: `Dispatched ${data.alerts_generated} emergency telemetry events across Vadodara grid.`,
      });
    } catch {
      addToast({
        type: 'danger',
        category: 'system',
        title: 'Simulation Error',
        message: 'Could not contact backend simulation controller.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleReset = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/simulate/reset', { method: 'POST' })
        .catch(() => fetch('http://127.0.0.1:8000/api/simulate/reset', { method: 'POST' }));
      if (!res.ok) throw new Error('Reset failed');
      addToast({
        type: 'info',
        category: 'system',
        title: 'Baseline Restored',
        message: 'All flood sensors and traffic nodes calibrated to safe nominal baseline.',
      });
    } catch {
      addToast({
        type: 'danger',
        category: 'system',
        title: 'Reset Error',
        message: 'Could not reset telemetry to baseline.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="h-full w-full overflow-hidden p-2.5 lg:p-4 flex flex-col gap-2.5">
      {/* 1. EXECUTIVE SITUATIONAL TELEMETRY & SIMULATOR RIBBON */}
      {!isSimplified && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border p-2.5 lg:p-3 shadow-md flex flex-wrap items-center justify-between gap-3 shrink-0 transition-colors"
          style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-surface)' }}
        >
          {/* Left: 4 Crisp KPI Badges */}
          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            {/* Threat Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider ${threatBadgeClass}`}>
              <span className="w-2 h-2 rounded-full bg-current animate-ping" />
              <span>{threatLabel}</span>
            </div>

            {/* Flood KPI */}
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
              style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}
            >
              <Waves size={15} className="text-cyan-500 shrink-0" />
              <div className="text-xs">
                <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--t-text-muted)' }}>Flood Sensors</span>
                <span className="font-extrabold" style={{ color: 'var(--t-text-primary)' }}>
                  {activeSensors}/{floodSensors.length} Online {floodDangers > 0 && <span className="text-rose-500 font-black">({floodDangers} Danger)</span>}
                </span>
              </div>
            </div>

            {/* Traffic KPI */}
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
              style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}
            >
              <Car size={15} className="text-amber-500 shrink-0" />
              <div className="text-xs">
                <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--t-text-muted)' }}>Vehicular Flow</span>
                <span className="font-extrabold" style={{ color: 'var(--t-text-primary)' }}>
                  {totalVehicles} Vehicles {trafficHotspots > 0 && <span className="text-rose-500 font-black">({trafficHotspots} Congested)</span>}
                </span>
              </div>
            </div>

            {/* AI Node KPI */}
            <div 
              className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl border"
              style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}
            >
              <Cpu size={15} className="text-emerald-500 shrink-0" />
              <div className="text-xs">
                <span className="text-[10px] uppercase font-bold block" style={{ color: 'var(--t-text-muted)' }}>Edge Vision AI</span>
                <span className="font-extrabold" style={{ color: 'var(--t-text-primary)' }}>98.4% Acc • 14ms</span>
              </div>
            </div>
          </div>

          {/* Right: Simulation & Report Actions */}
          <div className="flex items-center gap-1.5 lg:gap-2 flex-wrap">
            <span className="text-[10px] uppercase font-extrabold tracking-wider mr-1" style={{ color: 'var(--t-text-muted)' }}>
              Simulate:
            </span>

            <button
              onClick={() => setShowRoutePlanner((prev) => !prev)}
              className="px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
              title="Open Google Maps Smart Route Planner with automatic flood/traffic rerouting"
            >
              <Route size={13} className="text-emerald-500" />
              <span>Route Planner</span>
              {activeNavRoutes.some(r => r.isCompromised) && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
              )}
            </button>

            <button
              onClick={() => setShowIoTModal(true)}
              className="px-2.5 py-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-500 dark:text-cyan-400 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-sm"
              title="Connect IoT hardware or simulate specific area conditions (e.g. Alkapuri flood/traffic)"
            >
              <Radio size={13} className="text-cyan-500 animate-pulse" />
              <span>IoT & Incident</span>
            </button>

            <button
              onClick={() => handleSimulate('flood')}
              disabled={isSimulating}
              className="px-2.5 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
              title="Simulate high water monsoon surge in low-lying sectors"
            >
              <Waves size={13} />
              Flood Surge
            </button>

            <button
              onClick={() => handleSimulate('traffic')}
              disabled={isSimulating}
              className="px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
              title="Simulate evening peak gridlock"
            >
              <Car size={13} />
              Peak Traffic
            </button>

            <button
              onClick={handleReset}
              disabled={isSimulating}
              className="px-2.5 py-1.5 rounded-xl border hover:opacity-90 text-xs font-bold transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
              style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' }}
              title="Reset all telemetry back to safe baseline"
            >
              <RefreshCw size={13} className={isSimulating ? 'animate-spin' : ''} />
              Reset
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/25 active:scale-95 cursor-pointer"
            >
              <FileText size={13} />
              Report
            </button>
          </div>
        </motion.div>
      )}

      {/* 2. MAP & TELEMETRY CONTROLS WRAPPER */}
      <div className="relative flex-1 min-h-0 flex gap-2.5 overflow-hidden">
        {/* Map Container */}
        <div
          className="flex-1 h-full rounded-2xl overflow-hidden border shadow-sm relative transition-all duration-300"
          style={{ borderColor: 'var(--t-border)', background: 'var(--t-dashboard-inner)' }}
        >
          <CityMap 
            floodSensors={floodSensors} 
            trafficData={trafficData} 
            alerts={alerts}
            theme={theme} 
            isSimplified={isSimplified}
            onSelect={setSelectedPlot}
            selectedAreaName={focusedAreaName}
            activeRoutes={activeNavRoutes}
            selectedRouteId={selectedNavRouteId}
          />

          {/* Floating Google Maps Route Planner */}
          <div className="absolute top-16 left-4 z-[1001] max-w-sm pointer-events-auto">
            <GoogleRoutePlanner
              floodSensors={floodSensors}
              trafficData={trafficData}
              isOpen={showRoutePlanner}
              onToggleOpen={() => setShowRoutePlanner((prev) => !prev)}
              onRoutesCalculated={(routes, selectedId) => {
                setActiveNavRoutes(routes);
                setSelectedNavRouteId(selectedId);
              }}
              selectedRouteId={selectedNavRouteId}
              onSelectRoute={(id) => setSelectedNavRouteId(id)}
            />
          </div>

          {/* Quick Right Panel Toggle (if collapsed) */}
          {!rightPanelOpen && onToggleRightPanel && (
            <button
              onClick={onToggleRightPanel}
              className="absolute top-4 right-4 z-[1000] p-2 rounded-xl border backdrop-blur-md shadow-lg transition hover:scale-105 cursor-pointer"
              style={{ background: 'var(--t-bg-surface)', borderColor: 'var(--t-border)', color: 'var(--t-text-primary)' }}
              title="Open Telemetry Inspector"
            >
              <PanelRight size={17} />
            </button>
          )}
        </div>
        
        {/* Right Collapsible Telemetry Panel */}
        {!isSimplified && rightPanelOpen && (
          <div 
            className="h-full rounded-2xl overflow-hidden border shadow-lg hidden md:block shrink-0 transition-all duration-300"
            style={{ borderColor: 'var(--t-border)' }}
          >
            <RightPanel 
              alerts={alerts}
              floodSensors={floodSensors}
              trafficData={trafficData}
              selectedPlot={selectedPlot}
              onClearSelection={() => setSelectedPlot(null)}
              yoloStatus={yoloStatus}
              isYoloBusy={isYoloBusy}
              selectedTrafficArea={selectedTrafficArea}
              onTrafficAreaChange={onTrafficAreaChange}
              onStartYolo={onStartYolo}
              onStopYolo={onStopYolo}
              onClosePanel={onToggleRightPanel}
            />
          </div>
        )}
      </div>

      {/* 3. MUNICIPAL EXECUTIVE REPORT MODAL */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-2xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
              style={{ background: 'var(--t-bg-surface)', borderColor: 'var(--t-border)' }}
            >
              {/* Header */}
              <div 
                className="p-4 border-b flex items-center justify-between"
                style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md">
                    <ShieldAlert size={19} />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold uppercase tracking-wide" style={{ color: 'var(--t-text-primary)' }}>
                      Vadodara Municipal Operations Briefing
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                      Disaster Cell & Traffic Flow Executive Telemetry
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setShowReportModal(false)}
                  className="p-1.5 rounded-lg hover:bg-black/5 transition cursor-pointer"
                  style={{ color: 'var(--t-text-muted)' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Printable Body */}
              <div className="p-4 overflow-y-auto space-y-4 text-xs">
                {/* 4 Crisp Square / Rectangular KPI Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-lg border flex flex-col justify-between" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] uppercase font-bold tracking-wider block mb-1 text-slate-500 dark:text-slate-400">Threat Level</span>
                    <span className={`text-base font-extrabold leading-tight ${isCritical ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {threatLabel.split(' ')[0]}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-lg border flex flex-col justify-between" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] uppercase font-bold tracking-wider block mb-1 text-slate-500 dark:text-slate-400">Monitored Zones</span>
                    <span className="text-base font-extrabold leading-tight" style={{ color: 'var(--t-text-primary)' }}>11 Sectors</span>
                  </div>
                  <div className="p-3.5 rounded-lg border flex flex-col justify-between" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] uppercase font-bold tracking-wider block mb-1 text-slate-500 dark:text-slate-400">Peak Water</span>
                    <span className="text-base font-extrabold leading-tight text-cyan-500">{maxWaterLevel.toFixed(1)} cm</span>
                  </div>
                  <div className="p-3.5 rounded-lg border flex flex-col justify-between" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                    <span className="text-[10px] uppercase font-bold tracking-wider block mb-1 text-slate-500 dark:text-slate-400">Active Alerts</span>
                    <span className="text-base font-extrabold leading-tight text-amber-500">{unreadAlerts} Incidents</span>
                  </div>
                </div>

                {/* Flood Diagnostics */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-500 mb-2 flex items-center gap-1.5">
                    <Waves size={14} /> Sector Water Telemetry
                  </h3>
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--t-border)' }}>
                    <table className="w-full text-left text-xs">
                      <thead style={{ background: 'var(--t-bg-elevated)', color: 'var(--t-text-secondary)' }}>
                        <tr>
                          <th className="p-2">Sector</th>
                          <th className="p-2">Water Level</th>
                          <th className="p-2">Safe Threshold</th>
                          <th className="p-2">Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: 'var(--t-border)' }}>
                        {floodSensors.map(s => (
                          <tr key={s.id} className="hover:opacity-80">
                            <td className="p-2 font-semibold" style={{ color: 'var(--t-text-primary)' }}>{s.area_name}</td>
                            <td className="p-2 font-bold text-cyan-600 dark:text-cyan-400">{Number(s.water_level).toFixed(1)} cm</td>
                            <td className="p-2" style={{ color: 'var(--t-text-muted)' }}>180.0 cm Max</td>
                            <td className="p-2">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                                s.severity === 'danger' ? 'bg-red-500/20 text-red-500' :
                                s.severity === 'warning' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'
                              }`}>
                                {s.severity}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Directives */}
                <div 
                  className="p-3.5 rounded-2xl border text-xs space-y-1"
                  style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' }}
                >
                  <span className="font-extrabold uppercase tracking-wider block text-indigo-500">Municipal Directives</span>
                  <p className="leading-relaxed">
                    1. Drainage gates in Karelibaug & Fatehgunj monitored via IoT ultrasonic water sensors.
                    <br />
                    2. Automated traffic light interval regulation active across Alkapuri and Sayajigunj.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div 
                className="p-4 border-t flex items-center justify-between"
                style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}
              >
                <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>
                  Generated on {new Date().toLocaleString('en-IN')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => window.print()}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer size={13} /> Print Briefing
                  </button>
                  <button
                    onClick={() => setShowReportModal(false)}
                    className="px-3.5 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer"
                    style={{ borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* IoT Hardware Ingestion & Scenario Simulator Modal */}
      <IoTIncidentModal
        isOpen={showIoTModal}
        onClose={() => setShowIoTModal(false)}
        onAreaSelected={(area) => {
          setFocusedAreaName(area);
        }}
      />
    </div>
  );
}

