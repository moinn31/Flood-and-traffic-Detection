/* ============================================
   INTERACTIVE VADODARA MAP — Enterprise Edition
   Clean geospatial command viewport with multi-layer telemetry
   ============================================ */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { Car, Droplets, Layers, Navigation, Radio } from 'lucide-react';
import { FloodSensor, TrafficData } from '../types';
import { VADODARA_CENTER, MAP_ZOOM, VADODARA_AREAS } from '../data';

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

type MapLayerMode = 'all' | 'flood' | 'traffic';

// Minimalist glowing telemetry marker
const createSpotIcon = (className: string, size: number = 14) => {
  return L.divIcon({
    html: `<div class="glow-marker ${className}" style="width:${size}px; height:${size}px; border-radius:50%;"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

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

function MapFlyController({ targetCoord }: { targetCoord: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoord) {
      map.flyTo(targetCoord, 15, { animate: true, duration: 1.2 });
    }
  }, [targetCoord, map]);
  return null;
}

function MapResizer({ isSimplified }: { isSimplified: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 350);
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
  const [activeLayer, setActiveLayer] = useState<MapLayerMode>('all');
  const [selectedHotspot, setSelectedHotspot] = useState<string>('all');
  const [flyCoord, setFlyCoord] = useState<[number, number] | null>(null);

  const showTraffic = activeLayer === 'all' || activeLayer === 'traffic';
  const showFlood = activeLayer === 'all' || activeLayer === 'flood';

  const visibleTraffic = showTraffic ? trafficData : [];
  const visibleFlood = showFlood ? floodSensors : [];
  const spreadTrafficPoints = showTraffic ? spreadTrafficData(visibleTraffic) : [];
  const spreadFloodPoints = showFlood ? spreadFloodSensors(visibleFlood) : [];
  const boundsPoints = [...visibleTraffic, ...visibleFlood];

  const handleHotspotChange = (areaName: string) => {
    setSelectedHotspot(areaName);
    if (areaName === 'all') {
      setFlyCoord([VADODARA_CENTER.lat, VADODARA_CENTER.lng]);
    } else {
      const area = VADODARA_AREAS.find(a => a.name === areaName);
      if (area) {
        setFlyCoord([area.lat, area.lng]);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full h-full relative overflow-hidden"
    >
      {/* 1. CENTER FLOATING LAYER SELECTOR */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full p-1 border shadow-xl backdrop-blur-xl"
          style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)' }}
        >
          <button
            onClick={() => setActiveLayer('all')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeLayer === 'all'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'hover:text-cyan-400'
            }`}
            style={activeLayer === 'all' ? {} : { color: 'var(--t-text-secondary)' }}
          >
            <Layers size={13} />
            <span>All ({floodSensors.length + trafficData.length})</span>
          </button>

          <button
            onClick={() => setActiveLayer('flood')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeLayer === 'flood'
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white shadow-md'
                : 'hover:text-cyan-400'
            }`}
            style={activeLayer === 'flood' ? {} : { color: 'var(--t-text-secondary)' }}
          >
            <Droplets size={13} />
            <span>Flood ({floodSensors.length})</span>
          </button>

          <button
            onClick={() => setActiveLayer('traffic')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeLayer === 'traffic'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                : 'hover:text-amber-400'
            }`}
            style={activeLayer === 'traffic' ? {} : { color: 'var(--t-text-secondary)' }}
          >
            <Car size={13} />
            <span>Traffic ({trafficData.length})</span>
          </button>
        </div>
      </div>

      {/* 2. TOP-LEFT SECTOR FOCUS DROPDOWN */}
      <div className="absolute top-3 left-3 z-[1000] pointer-events-none hidden sm:block">
        <div 
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-lg backdrop-blur-xl text-xs font-semibold"
          style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)', color: 'var(--t-text-primary)' }}
        >
          <Navigation size={13} className="text-cyan-500 shrink-0" />
          <span className="text-[10px] uppercase font-bold text-slate-400">Sector:</span>
          <select
            value={selectedHotspot}
            onChange={(e) => handleHotspotChange(e.target.value)}
            className="bg-transparent font-bold outline-none cursor-pointer text-xs"
            style={{ color: 'var(--t-text-primary)' }}
          >
            <option value="all" className="dark:bg-slate-900 dark:text-white bg-white text-slate-900">Vadodara Metropolitan</option>
            {VADODARA_AREAS.map((a) => (
              <option key={a.name} value={a.name} className="dark:bg-slate-900 dark:text-white bg-white text-slate-900">
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. BOTTOM-LEFT MINIMALIST TELEMETRY LEGEND */}
      <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none hidden md:block">
        <div 
          className="pointer-events-auto rounded-xl border p-2.5 shadow-lg backdrop-blur-xl text-[10px] space-y-1"
          style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)' }}
        >
          <div className="font-extrabold uppercase tracking-wider text-[9px] flex items-center gap-1.5 mb-1" style={{ color: 'var(--t-text-muted)' }}>
            <Radio size={10} className="text-cyan-500 animate-pulse" /> Live Telemetry
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm" />
            <span style={{ color: 'var(--t-text-secondary)' }}>Safe Water / Free Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm" />
            <span style={{ color: 'var(--t-text-secondary)' }}>Warning Threshold / Moderate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm" />
            <span className="font-bold text-rose-500">Critical Surge / Gridlock</span>
          </div>
        </div>
      </div>

      {/* MAP VIEWPORT */}
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
        <MapFlyController targetCoord={flyCoord} />
        <MapResizer isSimplified={isSimplified} />

        {/* TRAFFIC SPOTS */}
        {spreadTrafficPoints.map(({ item: td, latitude, longitude }) => {
          const className = `traffic-marker ${td.traffic_level}`;
          const size = td.traffic_level === 'heavy' ? 42 : td.traffic_level === 'medium' ? 32 : 26;
          
          return (
            <Marker
              key={`tr-${td.id}`}
              position={[latitude, longitude]}
              icon={createSpotIcon(className, size)}
              eventHandlers={{
                click: () => onSelect?.({ type: 'traffic', data: td })
              }}
            >
              <Popup>
                <div className="p-2 min-w-[140px] text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-1.5 mb-1 text-amber-500">
                    <Car size={13} />
                    <span className="text-[10px] uppercase font-bold tracking-wider">Traffic Node</span>
                  </div>
                  <div className="font-extrabold text-sm mb-1">{td.area_name}</div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>Vehicles:</span>
                    <span className="font-bold">{td.vehicle_count}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Road Density:</span>
                    <span className="font-bold text-amber-500">{td.traffic_percentage}%</span>
                  </div>
                  <div className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full text-center mt-1 ${
                    td.traffic_level === 'heavy' ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                    td.traffic_level === 'medium' ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                  }`}>
                    {td.traffic_level} Flow
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* FLOOD SENSORS */}
        {spreadFloodPoints.map(({ item: sensor, latitude, longitude }) => {
          const isDanger = sensor.severity === 'danger' || sensor.water_level >= (sensor.max_threshold ?? 180);
          const isWarning = !isDanger && (sensor.severity === 'warning' || sensor.water_level >= (sensor.warn_threshold ?? 100));
          const severityClass = isDanger ? 'bg-red-500/30 border-2 border-red-500 shadow-[0_0_16px_rgba(239,68,68,0.8)] pulse-red' : 
                                isWarning ? 'bg-amber-500/30 border-2 border-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.8)] pulse-amber' : 
                                'bg-cyan-500/30 border-2 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] pulse-cyan';
          const size = isDanger ? 46 : isWarning ? 36 : 28;

          return (
            <Marker
              key={`fl-${sensor.id}`}
              position={[latitude, longitude]}
              icon={createSpotIcon(severityClass, size)}
              eventHandlers={{
                click: () => onSelect?.({ type: 'flood', data: sensor })
              }}
            >
              <Popup>
                <div className="p-2 min-w-[150px] text-slate-900 dark:text-slate-100">
                  <div className="flex items-center gap-1.5 mb-1 pb-1 border-b border-cyan-500/20">
                    <Droplets size={13} className="text-cyan-500" />
                    <span className="text-[10px] uppercase font-bold">Flood Sensor {sensor.id.substring(0, 6)}</span>
                  </div>
                  <div className="font-extrabold text-sm mb-1">{sensor.area_name}</div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>Water Level:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">{Number(sensor.water_level).toFixed(1)} cm</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Threshold:</span>
                    <span>180 cm Max</span>
                  </div>
                  <div className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full text-center mt-1 ${
                    isDanger ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                    isWarning ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                  }`}>
                    {isDanger ? 'Surge Danger' : isWarning ? 'Warning' : 'Normal'}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </motion.div>
  );
}
