/* ============================================
   INTERACTIVE VADODARA MAP
   Leaflet map with flood & traffic markers
   ============================================ */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { AnimatePresence, motion } from 'framer-motion';
import { Car, Droplets } from 'lucide-react';
import { FloodSensor, TrafficData } from '../types';
import { VADODARA_CENTER, MAP_ZOOM } from '../data';

interface CityMapProps {
  floodSensors: FloodSensor[];
  trafficData: TrafficData[];
  theme: 'light' | 'dark';
  isSimplified: boolean;
  onSelect?: (item: { type: 'flood' | 'traffic', data: any }) => void;
}

interface SpreadPoint<T> {
  item: T;
  latitude: number;
  longitude: number;
}

type MapLayerMode = 'flood' | 'traffic';

// Helper to create colored spots (Minimalist Glow Spots)
const createSpotIcon = (className: string, size: number = 12) => {
  // Outer circle only (no inner dot). Keep classes for color/glow styling.
  return L.divIcon({
    html: `<div class="glow-marker ${className}" style="width:${size}px; height:${size}px; border-radius:50%;"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// Auto-fit bounds component
function MapBounds({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!fitted.current && points.length > 0) {
      const bounds = L.latLngBounds(points.map(point => [point.latitude, point.longitude]));
      map.fitBounds(bounds.pad(0.2));
      fitted.current = true;
    }
  }, [points, map]);

  return null;
}

// Resizes map when layout changes
function MapResizer({ isSimplified }: { isSimplified: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 400); // Wait for transition
    return () => clearTimeout(timeout);
  }, [isSimplified, map]);
  return null;
}

function spreadFloodSensors(sensors: FloodSensor[]): SpreadPoint<FloodSensor>[] {
  const groups = new Map<string, FloodSensor[]>();

  sensors.forEach((sensor) => {
    const key = `${sensor.latitude.toFixed(4)}:${sensor.longitude.toFixed(4)}`;
    const existing = groups.get(key) ?? [];
    existing.push(sensor);
    groups.set(key, existing);
  });

  const spread: SpreadPoint<FloodSensor>[] = [];
  const ringStep = 0.00038;
  const angleOffset = Math.PI / 6;

  groups.forEach((group, key) => {
    if (group.length === 1) {
      const item = group[0];
      spread.push({ item, latitude: item.latitude, longitude: item.longitude });
      return;
    }

    const [baseLat, baseLng] = key.split(':').map(Number);
    const ringCount = Math.ceil(group.length / 6);

    group.forEach((item, index) => {
      const ringIndex = Math.floor(index / 6) + 1;
      const positionInRing = index % 6;
      const angle = angleOffset + (positionInRing / Math.min(group.length, 6)) * Math.PI * 2;
      const radius = ringStep * ringIndex;

      spread.push({
        item,
        latitude: baseLat + Math.sin(angle) * radius,
        longitude: baseLng + Math.cos(angle) * radius * (1 / Math.max(Math.cos(baseLat * Math.PI / 180), 0.35)),
      });
    });

    if (ringCount > 1) {
      // keep the first point near the actual coordinate for easier recognition
      spread.sort((a, b) => a.item.id.localeCompare(b.item.id));
    }
  });

  return spread;
}

function spreadTrafficData(items: TrafficData[]): SpreadPoint<TrafficData>[] {
  const groups = new Map<string, TrafficData[]>();

  items.forEach((item) => {
    const key = `${item.latitude.toFixed(4)}:${item.longitude.toFixed(4)}`;
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  });

  const spread: SpreadPoint<TrafficData>[] = [];
  const ringStep = 0.00034;
  const angleOffset = Math.PI / 4;

  groups.forEach((group, key) => {
    if (group.length === 1) {
      const item = group[0];
      spread.push({ item, latitude: item.latitude, longitude: item.longitude });
      return;
    }

    const [baseLat, baseLng] = key.split(':').map(Number);

    group.forEach((item, index) => {
      const ringIndex = Math.floor(index / 8) + 1;
      const positionInRing = index % 8;
      const angle = angleOffset + (positionInRing / Math.min(group.length, 8)) * Math.PI * 2;
      const radius = ringStep * ringIndex;

      spread.push({
        item,
        latitude: baseLat + Math.sin(angle) * radius,
        longitude: baseLng + Math.cos(angle) * radius * (1 / Math.max(Math.cos(baseLat * Math.PI / 180), 0.35)),
      });
    });
  });

  return spread;
}

export default function CityMap({ floodSensors, trafficData, theme, isSimplified, onSelect }: CityMapProps) {
  const satelliteUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const labelUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
  const [activeLayer, setActiveLayer] = useState<MapLayerMode>('flood');

  const visibleTraffic = activeLayer === 'traffic' ? trafficData : [];
  const visibleFlood = activeLayer === 'flood' ? floodSensors : [];
  const spreadTrafficPoints = activeLayer === 'traffic' ? spreadTrafficData(visibleTraffic) : [];
  const spreadFloodPoints = activeLayer === 'flood' ? spreadFloodSensors(visibleFlood) : [];
  const boundsPoints = activeLayer === 'traffic' ? visibleTraffic : visibleFlood;
  const activeCount = activeLayer === 'traffic' ? trafficData.length : floodSensors.length;
  const activeLabel = activeLayer === 'traffic' ? 'Traffic' : 'Flood';
  const accentClass = activeLayer === 'traffic' ? 'from-amber-400 to-orange-500' : 'from-cyan-400 to-blue-500';
  const activeButtonClass = activeLayer === 'traffic'
    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-[0_10px_30px_rgba(251,191,36,0.30)]'
    : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-[0_10px_30px_rgba(34,211,238,0.30)]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className={`w-full h-full relative overflow-hidden transition-all duration-500 ${isSimplified ? '' : 'rounded-[28px] border'}`}
      style={{ borderColor: 'var(--t-border)' }}
    >
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
        <div className="pointer-events-auto flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 backdrop-blur-xl p-1.5 shadow-2xl shadow-cyan-950/20 ring-1 ring-white/5">
            <motion.button
              layout
              onClick={() => setActiveLayer('flood')}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-200 ${
                activeLayer === 'flood'
                  ? activeButtonClass
                  : 'text-slate-300 hover:text-white hover:bg-white/6 border border-transparent'
              }`}
            >
              <Droplets size={14} />
              Flood
            </motion.button>
            <motion.button
              layout
              onClick={() => setActiveLayer('traffic')}
              whileTap={{ scale: 0.97 }}
              whileHover={{ y: -1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition-all duration-200 ${
                activeLayer === 'traffic'
                  ? activeButtonClass
                  : 'text-slate-300 hover:text-white hover:bg-white/6 border border-transparent'
              }`}
            >
              <Car size={14} />
              Traffic
            </motion.button>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeLayer}-${activeCount}`}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="flex items-center gap-2 rounded-full border backdrop-blur-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] shadow-lg"
              style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-glass)', color: 'var(--t-text-primary)' }}
            >
              <span className={`h-2 w-2 rounded-full bg-gradient-to-r ${accentClass}`} />
              <span>{activeLabel}</span>
              <span style={{ color: 'var(--t-text-muted)' }} className="normal-case tracking-normal">{activeCount} spots</span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <MapContainer
        center={[VADODARA_CENTER.lat, VADODARA_CENTER.lng]}
        zoom={MAP_ZOOM}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer attribution="Esri Satellite" url={satelliteUrl} />
        <TileLayer attribution="Labels" url={labelUrl} opacity={theme === 'dark' ? 0.85 : 0.65} />

        <MapBounds key={activeLayer} points={boundsPoints} />
        <MapResizer isSimplified={isSimplified} />

        {/* TRAFFIC SPOTS */}
        {spreadTrafficPoints.map(({ item: td, latitude, longitude }) => {
          const className = `traffic-marker ${td.traffic_level}`;
          // Slightly larger sizes to improve visibility
          const size = td.traffic_level === 'heavy' ? 46 : td.traffic_level === 'medium' ? 36 : 30;
          
          return (
            <Marker
              key={td.id}
              position={[latitude, longitude]}
              icon={createSpotIcon(className, size)}
              eventHandlers={{
                click: () => onSelect?.({ type: 'traffic', data: td })
              }}
            >
              <Popup>
                <div className="text-center p-1">
                  <div className="font-bold text-sm mb-0.5">{td.area_name}</div>
                  <div className="text-[10px] uppercase font-bold tracking-tight">{td.traffic_level} Traffic</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* FLOOD SENSORS */}
        {spreadFloodPoints.map(({ item: sensor, latitude, longitude }) => {
          // Inverted logic for dashboard: higher centimeters = safer, lower = danger
          // Danger when water_level is below warn_threshold, warning when below max_threshold
          const isDanger = sensor.water_level < (sensor.warn_threshold ?? 100);
          const isWarning = !isDanger && sensor.water_level < (sensor.max_threshold ?? 180);
          const severityClass = isDanger ? 'bg-red-500/20 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.6)] pulse-red' : 
                                isWarning ? 'bg-amber-500/20 border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)] pulse-amber' : 
                                'bg-cyan-500/20 border-2 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.6)] pulse-cyan';
          const size = isDanger ? 50 : isWarning ? 40 : 32;

          return (
            <Marker
              key={sensor.id}
              position={[latitude, longitude]}
              icon={createSpotIcon(severityClass, size)}
              eventHandlers={{
                click: () => onSelect?.({ type: 'flood', data: sensor })
              }}
            >
              <Popup>
                <div className="p-1 min-w-[140px]">
                  <div className="flex items-center gap-2 mb-2 pb-1 border-b border-cyan-500/20">
                    <Droplets size={12} className="text-cyan-400" />
                    <span className="text-[10px] uppercase font-bold text-slate-300">Sensor: FLD-{sensor.id.substring(0,4).toUpperCase()}</span>
                  </div>
                  <div className="font-bold text-sm text-white mb-1">{sensor.area_name}</div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-400">Water Level:</span>
                    <span className="font-bold text-cyan-300">{sensor.water_level.toFixed(1)} cm</span>
                  </div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-slate-400">Battery:</span>
                    <span className="font-bold text-emerald-400">81%</span>
                  </div>
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-slate-400">Status:</span>
                    <span className={`font-bold ${isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {isDanger ? 'DANGER' : isWarning ? 'WARNING' : 'SAFE'}
                    </span>
                  </div>
                  <div className="text-[8px] text-slate-500 text-right mt-1 pt-1 border-t border-cyan-500/10">Last Update: Just now</div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

    </motion.div>
  );
}

