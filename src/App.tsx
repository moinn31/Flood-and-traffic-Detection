import { useState, useEffect, useCallback, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { ToastProvider, useToast } from './components/ToastSystem';
import Dashboard from './pages/Dashboard';
import FloodMonitor from './pages/FloodMonitor';
import TrafficAI from './pages/TrafficAI';
import AlertsPage from './pages/AlertsPage';
import YoloService from './pages/YoloService';
import { VADODARA_AREAS } from './data';
import type { FloodSensor, TrafficData, Alert, SystemStatus, YoloRuntimeStatus } from './types';

const defaultYoloStatus: YoloRuntimeStatus = {
  running: false,
  pid: null,
  area: null,
  camera: null,
  confidence: null,
  started_at: null,
  command: null,
};

function AppContent() {
  const [floodSensors, setFloodSensors] = useState<FloodSensor[]>([]);
  const [trafficData, setTrafficData] = useState<TrafficData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    sensors_online: 0,
    sensors_total: 0,
    active_alerts: 0,
    traffic_cameras: 0,
    system_health: 'operational',
    uptime: '99.9%',
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // PROPER THEME INITIALIZATION WITH LOCALSTORAGE
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('smart_city_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  const [isSimplified, setIsSimplified] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [yoloStatus, setYoloStatus] = useState<YoloRuntimeStatus>(defaultYoloStatus);
  const [isYoloBusy, setIsYoloBusy] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [showWeather, setShowWeather] = useState(true);
  const [selectedTrafficArea, setSelectedTrafficArea] = useState(VADODARA_AREAS[0].name);
  const { addToast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);

  // Sync theme changes to DOM and localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('smart_city_theme', theme);
  }, [theme]);

  // Primary REST Data Fetcher
  const updateData = useCallback(async () => {
    try {
      const [floodResponse, trafficResponse, yoloResponse, alertResponse] = await Promise.all([
        fetch('/api/flood-data').catch(() => fetch('http://127.0.0.1:8000/api/flood-data')),
        fetch('/api/traffic-data').catch(() => fetch('http://127.0.0.1:8000/api/traffic-data')),
        fetch('/api/yolo/status').catch(() => fetch('http://127.0.0.1:8000/api/yolo/status')),
        fetch('/api/alerts').catch(() => fetch('http://127.0.0.1:8000/api/alerts')),
      ]);

      let newFlood: FloodSensor[] = [];
      let newTraffic: TrafficData[] = [];
      let newAlerts: Alert[] = [];
      let newYolo: YoloRuntimeStatus = defaultYoloStatus;

      if (floodResponse && floodResponse.ok) {
        newFlood = await floodResponse.json();
        setFloodSensors(newFlood);
      }

      if (trafficResponse && trafficResponse.ok) {
        newTraffic = await trafficResponse.json();
        setTrafficData(newTraffic);
      }

      if (yoloResponse && yoloResponse.ok) {
        newYolo = await yoloResponse.json();
        setYoloStatus(newYolo);
      }
      
      if (alertResponse && alertResponse.ok) {
        newAlerts = await alertResponse.json();
        setAlerts(newAlerts);
      }

      setSystemStatus({
        sensors_online: newFlood.filter(s => s.status === 'online').length,
        sensors_total: newFlood.length || 11,
        active_alerts: newAlerts.length,
        traffic_cameras: newYolo.running ? 1 : 0,
        system_health: newFlood.some(s => s.severity === 'danger') ? 'critical' : 'operational',
        uptime: '99.9%',
      });
    } catch {
      // Keep existing telemetry on network timeout
    }
  }, []);

  // Real-Time WebSocket Connection
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/live`;
    let ws: WebSocket;

    try {
      ws = new WebSocket(wsUrl);
    } catch {
      ws = new WebSocket('ws://127.0.0.1:8000/ws/live');
    }

    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'init') {
          if (payload.data.flood) setFloodSensors(payload.data.flood);
          if (payload.data.traffic) setTrafficData(payload.data.traffic);
          if (payload.data.alerts) setAlerts(payload.data.alerts);
        } else if (payload.type === 'simulation_triggered' || payload.type === 'simulation_reset') {
          if (payload.flood) setFloodSensors(payload.flood);
          if (payload.traffic) setTrafficData(payload.traffic);
          if (payload.alerts) setAlerts(payload.alerts);
        } else if (payload.type === 'alerts_cleared') {
          setAlerts([]);
        } else if (payload.type === 'flood_update') {
          setFloodSensors(prev => {
            const idx = prev.findIndex(s => s.area_name === payload.data.area_name);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = payload.data;
              return copy;
            }
            return [...prev, payload.data];
          });
        } else if (payload.type === 'traffic_update') {
          setTrafficData(prev => {
            const idx = prev.findIndex(t => t.area_name === payload.data.area_name);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = payload.data;
              return copy;
            }
            return [...prev, payload.data];
          });
        } else if (payload.type === 'alert') {
          setAlerts(prev => [payload.data, ...prev]);
        }
      } catch (err) {
        console.error('WebSocket parse error:', err);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  const startYolo = useCallback(async (area: string = selectedTrafficArea, headless: boolean = true) => {
    if (isYoloBusy || yoloStatus.running) return;
    setIsYoloBusy(true);
    try {
      const response = await fetch('/api/yolo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera: 0, area, confidence: 0.4, headless }),
      }).catch(() => fetch('http://127.0.0.1:8000/api/yolo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera: 0, area, confidence: 0.4, headless }),
      }));

      if (!response || !response.ok) {
        const errorData = await response?.json().catch(() => ({}));
        throw new Error(errorData?.detail || 'Failed to start Optical Vision node');
      }

      const payload = await response.json();
      setYoloStatus(payload);
      setSelectedTrafficArea(area);
      addToast({
        type: 'info',
        category: 'traffic',
        title: 'Optical Node Active',
        message: `Traffic telemetry vision node streaming for ${area}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start vision node';
      addToast({
        type: 'danger',
        category: 'system',
        title: 'Start Failed',
        message,
      });
    } finally {
      setIsYoloBusy(false);
    }
  }, [addToast, isYoloBusy, selectedTrafficArea, yoloStatus.running]);

  const stopYolo = useCallback(async () => {
    if (isYoloBusy || !yoloStatus.running) return;
    setIsYoloBusy(true);
    try {
      const response = await fetch('/api/yolo/stop', {
        method: 'POST',
      }).catch(() => fetch('http://127.0.0.1:8000/api/yolo/stop', {
        method: 'POST',
      }));

      if (!response || !response.ok) {
        const errorData = await response?.json().catch(() => ({}));
        throw new Error(errorData?.detail || 'Failed to stop Optical Vision node');
      }

      const payload = await response.json();
      setYoloStatus(payload);
      if (payload.area) {
        setSelectedTrafficArea(payload.area);
      }
      addToast({
        type: 'warning',
        category: 'traffic',
        title: 'Optical Node Terminated',
        message: 'Vision telemetry stream has returned to standby.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to stop vision node';
      addToast({
        type: 'danger',
        category: 'system',
        title: 'Stop Failed',
        message,
      });
    } finally {
      setIsYoloBusy(false);
    }
  }, [addToast, isYoloBusy, yoloStatus.running]);

  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 8000);
    return () => clearInterval(interval);
  }, [updateData]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const toggleEmergency = () => setIsEmergency(prev => !prev);
  const toggleWeather = () => setShowWeather(prev => !prev);
  const toggleRightPanel = () => setRightPanelOpen(prev => !prev);

  const unreadAlertCount = alerts.filter(a => !a.read).length;

  return (
    <div 
      className={`flex flex-col h-screen w-screen overflow-hidden transition-colors duration-300 ${
        isEmergency 
          ? 'bg-rose-950/20' 
          : ''
      }`}
      style={{ background: 'var(--t-bg-body)' }}
    >
      {/* Weather Overlay in Dark Mode */}
      {showWeather && theme === 'dark' && (
        <div className="absolute inset-0 z-[1] pointer-events-none opacity-15 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-screen" />
      )}

      {/* Emergency Siren Border */}
      {isEmergency && (
        <div className="absolute inset-0 z-[9999] pointer-events-none border-[5px] border-red-500/60 shadow-[inset_0_0_120px_rgba(239,68,68,0.25)] animate-pulse" />
      )}

      <div className="relative z-10 flex flex-col h-full w-full">
        {/* Top Header */}
        <Header
          systemStatus={systemStatus}
          alertCount={unreadAlertCount}
          theme={theme}
          onToggleTheme={toggleTheme}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          isEmergency={isEmergency}
          onToggleEmergency={toggleEmergency}
          onToggleWeather={toggleWeather}
          rightPanelOpen={rightPanelOpen}
          onToggleRightPanel={toggleRightPanel}
        />
      
        <div className="flex flex-1 overflow-hidden relative">
          {/* Streamlined Left Navigation Sidebar */}
          <Sidebar
            systemStatus={systemStatus}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            trafficData={trafficData}
          />
          
          {/* Main Viewport Content */}
          <main className="flex-1 overflow-hidden relative flex flex-col">
            <Routes>
              <Route path="/" element={
                <Dashboard 
                  floodSensors={floodSensors} 
                  trafficData={trafficData} 
                  alerts={alerts} 
                  theme={theme} 
                  isSimplified={isSimplified} 
                  yoloStatus={yoloStatus}
                  isYoloBusy={isYoloBusy}
                  onStartYolo={startYolo}
                  onStopYolo={stopYolo}
                  selectedTrafficArea={selectedTrafficArea}
                  onTrafficAreaChange={setSelectedTrafficArea}
                  rightPanelOpen={rightPanelOpen}
                  onToggleRightPanel={toggleRightPanel}
                />
              } />
              <Route path="/flood" element={<FloodMonitor floodSensors={floodSensors} alerts={alerts} />} />
              <Route path="/traffic" element={<TrafficAI trafficData={trafficData} alerts={alerts} />} />
              <Route path="/alerts" element={<AlertsPage alerts={alerts} />} />
              <Route path="/vision-sensor" element={<YoloService yoloStatus={yoloStatus} onStart={(area, headless) => startYolo(area || selectedTrafficArea, headless ?? true)} onStop={stopYolo} />} />
              <Route path="/yolo" element={<YoloService yoloStatus={yoloStatus} onStart={(area, headless) => startYolo(area || selectedTrafficArea, headless ?? true)} onStop={stopYolo} />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
