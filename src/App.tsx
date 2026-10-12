import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import { ToastProvider, useToast } from './components/ToastSystem';
import Dashboard from './pages/Dashboard';
import FloodMonitor from './pages/FloodMonitor';
import TrafficAI from './pages/TrafficAI';
import AlertsPage from './pages/AlertsPage';
import YoloService from './pages/YoloService';
import {
  generateWaterLevelHistory, generateTrafficHistory, VADODARA_AREAS
} from './data';
import type { FloodSensor, TrafficData, Alert, SystemStatus, YoloRuntimeStatus } from './types';
import { Sun, Moon, LayoutDashboard, Maximize2 } from 'lucide-react';

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
    uptime: '100%',
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isSimplified, setIsSimplified] = useState(false);
  const [yoloStatus, setYoloStatus] = useState<YoloRuntimeStatus>(defaultYoloStatus);
  const [isYoloBusy, setIsYoloBusy] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const [showWeather, setShowWeather] = useState(true);
  const [selectedTrafficArea, setSelectedTrafficArea] = useState(VADODARA_AREAS[0].name);
  const { addToast } = useToast();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const updateData = useCallback(async () => {
    try {
      const [floodResponse, trafficResponse, yoloResponse, alertResponse] = await Promise.all([
        fetch('http://127.0.0.1:8000/api/flood-data'),
        fetch('http://127.0.0.1:8000/api/traffic-data'),
        fetch('http://127.0.0.1:8000/api/yolo/status'),
        fetch('http://127.0.0.1:8000/api/alerts'),
      ]);

      let newFlood: FloodSensor[] = [];
      let newTraffic: TrafficData[] = [];
      let newAlerts: Alert[] = [];
      let newYolo: YoloRuntimeStatus = defaultYoloStatus;

      if (floodResponse.ok) {
        newFlood = await floodResponse.json();
        setFloodSensors(newFlood);
      }

      if (trafficResponse.ok) {
        newTraffic = await trafficResponse.json();
        setTrafficData(newTraffic);
      }

      if (yoloResponse.ok) {
        newYolo = await yoloResponse.json();
        setYoloStatus(newYolo);
      }
      
      if (alertResponse.ok) {
        newAlerts = await alertResponse.json();
        setAlerts(newAlerts);
      }

      setSystemStatus({
        sensors_online: newFlood.filter(s => s.status === 'online').length,
        sensors_total: newFlood.length || 1,
        active_alerts: newAlerts.length,
        traffic_cameras: newYolo.running ? 1 : 0,
        system_health: 'operational',
        uptime: '99.9%',
      });
    } catch {
      // Keep existing data on fetch error
    }
  }, []);

  const startYolo = useCallback(async (area: string = selectedTrafficArea, headless: boolean = false) => {
    if (isYoloBusy || yoloStatus.running) return;
    setIsYoloBusy(true);
    try {
      const response = await fetch('http://127.0.0.1:8000/api/yolo/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camera: 0, area, confidence: 0.4, headless }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to start Traffic AI service');
      }

      const payload = await response.json();
      setYoloStatus(payload);
      setSelectedTrafficArea(area);
      addToast({
        type: 'info',
        category: 'traffic',
        title: 'Traffic AI Started',
        message: 'Laptop camera is now streaming detections to backend.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start Traffic AI service';
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
      const response = await fetch('http://127.0.0.1:8000/api/yolo/stop', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to stop Traffic AI service');
      }

      const payload = await response.json();
      setYoloStatus(payload);
      if (payload.area) {
        setSelectedTrafficArea(payload.area);
      }
      addToast({
        type: 'warning',
        category: 'traffic',
        title: 'Traffic AI Stopped',
        message: 'Traffic AI webcam stream has been stopped.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to stop Traffic AI service';
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
  const toggleSimplified = () => setIsSimplified(prev => !prev);
  const toggleEmergency = () => setIsEmergency(prev => !prev);
  const toggleWeather = () => setShowWeather(prev => !prev);

  const unreadAlertCount = alerts.filter(a => !a.read).length;

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden transition-colors duration-500 ${isEmergency ? 'bg-[radial-gradient(circle_at_top,rgba(239,68,68,0.15),transparent_40%),linear-gradient(180deg,#1a0505_0%,#2a0a0a_42%,#140202_100%)]' : theme === 'dark' ? 'bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_28%),linear-gradient(180deg,#08111e_0%,#0b1324_42%,#050814_100%)]' : 'bg-[linear-gradient(180deg,#f8fbff_0%,#edf5ff_45%,#f8fafc_100%)]'}`}>
      
      {/* Weather Overlay */}
      {showWeather && theme === 'dark' && (
        <div className="absolute inset-0 z-[1] pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-screen" />
      )}

      {/* Emergency Overlay */}
      {isEmergency && (
        <div className="absolute inset-0 z-[9999] pointer-events-none border-[6px] border-red-500/50 shadow-[inset_0_0_150px_rgba(239,68,68,0.2)] animate-pulse" />
      )}

      <div className="relative z-10 flex flex-col h-full w-full">
        {!isSimplified && (
          <Header
            systemStatus={systemStatus}
            alertCount={unreadAlertCount}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            isEmergency={isEmergency}
            onToggleEmergency={toggleEmergency}
            onToggleWeather={toggleWeather}
          />
        )}
      
      <div className="flex flex-1 overflow-hidden relative">
        {!isSimplified && (
          <Sidebar
            systemStatus={systemStatus}
            yoloStatus={yoloStatus}
            isYoloBusy={isYoloBusy}
            onStartYolo={startYolo}
            onStopYolo={stopYolo}
            selectedTrafficArea={selectedTrafficArea}
            onTrafficAreaChange={setSelectedTrafficArea}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            trafficData={trafficData}
          />
        )}
        
        <main className="flex-1 overflow-hidden relative">
          {/* Bottom-right control dock */}
          <div className="fixed bottom-6 right-6 z-[2000] flex items-center gap-1 bg-slate-950/60 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl shadow-black/50">
            <div 
              onClick={toggleTheme}
              className="group cursor-pointer w-10 h-10 flex items-center justify-center rounded-full bg-transparent hover:bg-white/10 transition-colors relative"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-300" />
              )}
              <div className="absolute right-14 px-2.5 py-1 bg-slate-900/90 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 shadow-xl">
                {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
              </div>
            </div>
            
            <div className="w-[1px] h-5 bg-white/10 mx-1" />

            <div 
              onClick={toggleSimplified}
              className={`group cursor-pointer w-10 h-10 flex items-center justify-center rounded-full transition-colors relative ${isSimplified ? 'bg-cyan-500/20 text-cyan-400' : 'bg-transparent hover:bg-white/10 text-slate-300'}`}
            >
              {isSimplified ? (
                <LayoutDashboard className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
              <div className="absolute right-14 px-2.5 py-1 bg-slate-900/90 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[10px] group-hover:translate-x-0 whitespace-nowrap border border-white/10 shadow-xl">
                {isSimplified ? 'SHOW UI' : 'HIDE UI'}
              </div>
            </div>
          </div>

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
              />
            } />
            <Route path="/flood" element={<FloodMonitor floodSensors={floodSensors} alerts={alerts} />} />
            <Route path="/traffic" element={<TrafficAI trafficData={trafficData} alerts={alerts} />} />
            <Route path="/alerts" element={<AlertsPage alerts={alerts} />} />
            <Route path="/yolo" element={<YoloService yoloStatus={yoloStatus} onStart={() => startYolo(selectedTrafficArea, false)} onStop={stopYolo} />} />
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

