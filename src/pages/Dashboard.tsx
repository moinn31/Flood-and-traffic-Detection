import { useState } from 'react';
import { FloodSensor, TrafficData, Alert, YoloRuntimeStatus } from '../types';
import CityMap from '../components/CityMap';
import RightPanel from '../components/RightPanel';
import { motion } from 'framer-motion';
import { Waves, Car, BellRing, Activity, AlertCircle, TrendingUp } from 'lucide-react';

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
}: DashboardProps) {
  const [selectedPlot, setSelectedPlot] = useState<{ type: 'flood' | 'traffic', data: any } | null>(null);

  const floodWarnings = floodSensors.filter(sensor => sensor.severity !== 'safe').length;
  const trafficHotspots = trafficData.filter(item => item.traffic_level !== 'low').length;
  const unreadAlerts = alerts.filter(alert => !alert.read).length;
  const activeSensors = floodSensors.length;

  const metrics = [
    { label: "Sensors Active", value: `${activeSensors}/10`, icon: Waves, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" },
    { label: "Traffic Density", value: "74%", icon: Car, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    { label: "AI Accuracy", value: "96%", icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
    { label: "Emergency Alerts", value: unreadAlerts, icon: BellRing, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" },
    { label: "Roads Blocked", value: trafficHotspots, icon: AlertCircle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
    { label: "Avg Speed", value: "28 km/h", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" }
  ];

  return (
    <div className="h-full w-full overflow-hidden p-4 lg:p-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-full rounded-[30px] border shadow-2xl overflow-hidden"
        style={{ borderColor: 'var(--t-border)', background: 'var(--t-dashboard-wrapper)' }}
      >
        {/* Map Area and Right Panel Wrapper */}
        <div className={`flex h-full w-full ${isSimplified ? 'p-0' : 'p-3 lg:p-4'} gap-4`}>
          <div
            className="flex-1 h-full rounded-[26px] overflow-hidden border shadow-inner relative"
            style={{ borderColor: 'var(--t-border)', background: 'var(--t-dashboard-inner)' }}
          >
            <CityMap 
              floodSensors={floodSensors} 
              trafficData={trafficData} 
              theme={theme} 
              isSimplified={isSimplified}
              onSelect={setSelectedPlot}
            />
          </div>
          
          {!isSimplified && (
            <div className="h-full rounded-[26px] overflow-hidden border shadow-xl hidden md:block" style={{ borderColor: 'var(--t-border)' }}>
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
              />
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
