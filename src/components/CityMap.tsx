/* ============================================
   INTERACTIVE VADODARA MAP — Enterprise Edition
   Multi-layer telemetry with Smart AI Rerouting & Area Status Badges
   ============================================ */

import { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Car, Droplets, Layers, Navigation, Radio, AlertTriangle, 
  CheckCircle2, Compass, ArrowRight, Route, Eye, EyeOff, ShieldCheck, X
} from 'lucide-react';
import { FloodSensor, TrafficData, Alert, NavRouteOption } from '../types';
import { GoogleCityMap } from './GoogleCityMap';
import { VADODARA_CENTER, MAP_ZOOM, VADODARA_AREAS } from '../data';
import { VADODARA_ROUTE_PROFILES, getRouteAdviceForArea } from '../routingData';

interface CityMapProps {
  floodSensors: FloodSensor[];
  trafficData: TrafficData[];
  alerts?: Alert[];
  theme: 'light' | 'dark';
  isSimplified: boolean;
  onSelect?: (item: { type: 'flood' | 'traffic', data: any }) => void;
  selectedAreaName?: string;
  activeRoutes?: NavRouteOption[];
  selectedRouteId?: string | null;
  mapEngine?: 'leaflet' | 'google';
  onMapEngineChange?: (engine: 'leaflet' | 'google') => void;
}

interface SpreadPoint<T> {
  item: T;
  latitude: number;
  longitude: number;
}

type MapLayerMode = 'all' | 'flood' | 'traffic' | 'routes';

// Glowing telemetry spot marker
const createSpotIcon = (className: string, size: number = 14) => {
  return L.divIcon({
    html: `<div class="glow-marker ${className}" style="width:${size}px; height:${size}px; border-radius:50%;"></div>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

// High-contrast Area Status Badge Marker
const createAreaBadgeIcon = (areaName: string, statusType: 'safe' | 'warn' | 'danger', statText: string) => {
  const statusClass = statusType === 'danger' ? 'area-status-danger' : statusType === 'warn' ? 'area-status-warn' : 'area-status-safe';
  return L.divIcon({
    html: `
      <div class="area-map-badge ${statusClass}">
        <span class="status-dot"></span>
        <span class="area-title">${areaName}</span>
        <span class="area-badge-sub">• ${statText}</span>
      </div>
    `,
    className: '',
    iconSize: [160, 26],
    iconAnchor: [80, 13],
  });
};

function MapBounds({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (!fitted.current && points.length > 0) {
      const bounds = L.latLngBounds(points.map(point => [point.latitude, point.longitude]));
      map.fitBounds(bounds.pad(0.18));
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

export default function CityMap({ 
  floodSensors, 
  trafficData, 
  alerts = [],
  theme, 
  isSimplified, 
  onSelect,
  selectedAreaName,
  activeRoutes = [],
  selectedRouteId,
  mapEngine = 'google',
  onMapEngineChange,
}: CityMapProps) {
  const [internalEngine, setInternalEngine] = useState<'leaflet' | 'google'>(mapEngine);

  useEffect(() => {
    if (mapEngine) setInternalEngine(mapEngine);
  }, [mapEngine]);
  const satelliteUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  const labelUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
  
  const [activeLayer, setActiveLayer] = useState<MapLayerMode>('all');
  const [selectedHotspot, setSelectedHotspot] = useState<string>('all');
  const [flyCoord, setFlyCoord] = useState<[number, number] | null>(null);
  const [showAreaBadges, setShowAreaBadges] = useState<boolean>(true);
  const [activeAdvisorArea, setActiveAdvisorArea] = useState<string | null>('Alkapuri');
  const [advisorMinimized, setAdvisorMinimized] = useState<boolean>(false);

  // Sync external selected area prop
  useEffect(() => {
    if (selectedAreaName && selectedAreaName !== 'all') {
      setSelectedHotspot(selectedAreaName);
      setActiveAdvisorArea(selectedAreaName);
      const matched = VADODARA_AREAS.find(a => a.name.toLowerCase() === selectedAreaName.toLowerCase());
      if (matched) {
        setFlyCoord([matched.lat, matched.lng]);
      }
    }
  }, [selectedAreaName]);

  const showTraffic = activeLayer === 'all' || activeLayer === 'traffic';
  const showFlood = activeLayer === 'all' || activeLayer === 'flood';
  const showRoutesLayer = activeLayer === 'all' || activeLayer === 'routes';

  const visibleTraffic = showTraffic ? trafficData : [];
  const visibleFlood = showFlood ? floodSensors : [];
  const spreadTrafficPoints = showTraffic ? spreadTrafficData(visibleTraffic) : [];
  const spreadFloodPoints = showFlood ? spreadFloodSensors(visibleFlood) : [];
  const boundsPoints = [...visibleTraffic, ...visibleFlood];

  // Evaluate telemetry status for all 11 Vadodara sectors
  const sectorEvaluations = useMemo(() => {
    return VADODARA_AREAS.map(area => {
      const flood = floodSensors.find(f => f.area_name.toLowerCase() === area.name.toLowerCase());
      const traffic = trafficData.find(t => t.area_name.toLowerCase() === area.name.toLowerCase());

      const waterLevel = flood ? flood.water_level : 0;
      const trafficPct = traffic ? traffic.traffic_percentage : 20;

      const isFloodDanger = waterLevel >= 180 || flood?.severity === 'danger';
      const isTrafficDanger = trafficPct >= 75 || traffic?.traffic_level === 'heavy';
      const isFloodWarn = !isFloodDanger && (waterLevel >= 100 || flood?.severity === 'warning');
      const isTrafficWarn = !isTrafficDanger && (trafficPct >= 50 || traffic?.traffic_level === 'medium');

      const isDanger = isFloodDanger || isTrafficDanger;
      const isWarn = !isDanger && (isFloodWarn || isTrafficWarn);

      let statusType: 'safe' | 'warn' | 'danger' = 'safe';
      let statText = 'Operational • Safe';

      if (isDanger) {
        statusType = 'danger';
        statText = isFloodDanger ? `SURGE ${waterLevel.toFixed(0)}cm` : `JAM ${trafficPct}%`;
      } else if (isWarn) {
        statusType = 'warn';
        statText = isFloodWarn ? `Watch ${waterLevel.toFixed(0)}cm` : `Moderate ${trafficPct}%`;
      }

      const routeAdvice = getRouteAdviceForArea(area.name, waterLevel, trafficPct);

      return {
        area,
        waterLevel,
        trafficPct,
        statusType,
        statText,
        isDanger,
        isWarn,
        flood,
        traffic,
        routeAdvice,
      };
    });
  }, [floodSensors, trafficData]);

  // Determine areas that currently have active hazards
  const hazardSectors = useMemo(() => {
    return sectorEvaluations.filter(s => s.isDanger);
  }, [sectorEvaluations]);

  // Automatically switch active advisor to any sector with hazard if not manually chosen
  useEffect(() => {
    if (hazardSectors.length > 0 && (!activeAdvisorArea || !hazardSectors.some(h => h.area.name === activeAdvisorArea))) {
      setActiveAdvisorArea(hazardSectors[0].area.name);
    }
  }, [hazardSectors, activeAdvisorArea]);

  const handleHotspotChange = (areaName: string) => {
    setSelectedHotspot(areaName);
    if (areaName === 'all') {
      setFlyCoord([VADODARA_CENTER.lat, VADODARA_CENTER.lng]);
      if (hazardSectors.length > 0) {
        setActiveAdvisorArea(hazardSectors[0].area.name);
      }
    } else {
      const area = VADODARA_AREAS.find(a => a.name === areaName);
      if (area) {
        setFlyCoord([area.lat, area.lng]);
        setActiveAdvisorArea(area.name);
      }
    }
  };

  const currentAdvisorSector = sectorEvaluations.find(s => s.area.name === activeAdvisorArea) || sectorEvaluations[0];
  const currentRouteProfile = VADODARA_ROUTE_PROFILES[currentAdvisorSector?.area.name || 'Alkapuri'] || VADODARA_ROUTE_PROFILES['Alkapuri'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full h-full relative overflow-hidden"
    >
      {/* 1. TOP CENTER FLOATING LAYER SELECTOR (Leaflet mode only) */}
      {internalEngine === 'leaflet' && (
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

          <button
            onClick={() => setActiveLayer('routes')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeLayer === 'routes'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                : 'hover:text-emerald-400'
            }`}
            style={activeLayer === 'routes' ? {} : { color: 'var(--t-text-secondary)' }}
          >
            <Route size={13} />
            <span>AI Routes</span>
          </button>
        </div>
      </div>
      )}

      {/* 2. TOP-LEFT CONTROLS: SECTOR JUMP & AREA BADGE TOGGLE */}
      <div className="absolute top-3 left-3 z-[1000] pointer-events-none flex items-center gap-2">
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
            <option value="all" className="dark:bg-slate-900 dark:text-white bg-white text-slate-900">Vadodara Metropolitan (All 11)</option>
            {VADODARA_AREAS.map((a) => (
              <option key={a.name} value={a.name} className="dark:bg-slate-900 dark:text-white bg-white text-slate-900">
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            const next = internalEngine === 'google' ? 'leaflet' : 'google';
            setInternalEngine(next);
            if (onMapEngineChange) onMapEngineChange(next);
          }}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border shadow-lg backdrop-blur-xl text-[11px] font-bold transition hover:scale-105 cursor-pointer"
          style={{ 
            background: internalEngine === 'google' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.2)', 
            borderColor: internalEngine === 'google' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(6, 182, 212, 0.5)', 
            color: internalEngine === 'google' ? '#10b981' : '#06b6d4' 
          }}
          title="Switch Map Engine: Google Maps ⇄ Leaflet OpenStreetMap"
        >
          <Navigation size={13} className={internalEngine === 'google' ? 'text-emerald-400' : 'text-cyan-400'} />
          <span>{internalEngine === 'google' ? 'Google Maps' : 'Leaflet GIS'}</span>
        </button>

        <button
          onClick={() => setShowAreaBadges(prev => !prev)}
          className="pointer-events-auto flex items-center gap-1 px-2.5 py-1.5 rounded-xl border shadow-lg backdrop-blur-xl text-[11px] font-bold transition hover:scale-105 cursor-pointer"
          style={{ 
            background: showAreaBadges ? 'var(--t-bg-elevated)' : 'var(--t-bg-glass)', 
            borderColor: 'var(--t-border)', 
            color: showAreaBadges ? '#06b6d4' : 'var(--t-text-muted)' 
          }}
          title="Toggle Area Status Labels on the Map"
        >
          {showAreaBadges ? <Eye size={13} /> : <EyeOff size={13} />}
          <span>{showAreaBadges ? 'Labels On' : 'Labels Off'}</span>
        </button>
      </div>

      {/* 3. BOTTOM-LEFT TELEMETRY & ROUTE LEGEND */}
      <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none hidden md:block">
        <div 
          className="pointer-events-auto rounded-xl border p-3 shadow-2xl text-[10px] space-y-1.5 min-w-[190px] backdrop-blur-md transition-colors"
          style={{ 
            background: 'var(--t-bg-surface)', 
            borderColor: 'var(--t-border)', 
            color: 'var(--t-text-primary)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.25)' 
          }}
        >
          <div className="font-extrabold uppercase tracking-wider text-[9px] flex items-center justify-between mb-1" style={{ color: 'var(--t-text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <Radio size={10} className="text-cyan-500 animate-pulse" /> Live Telemetry
            </span>
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">11 Sectors</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span style={{ color: 'var(--t-text-secondary)' }}>Safe / Operational Flow</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
            <span style={{ color: 'var(--t-text-secondary)' }}>Warning Threshold (&ge;100cm)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm animate-ping" />
            <span className="font-bold text-rose-600 dark:text-rose-400">Critical Surge / Gridlock</span>
          </div>

          <div className="pt-1.5 border-t flex flex-col gap-1" style={{ borderColor: 'var(--t-border)' }}>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-0.5 bg-red-500 border-b border-dashed border-red-500" />
              <span className="text-red-600 dark:text-red-400 font-semibold">Blocked Corridor</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 rounded bg-cyan-500" />
              <span className="text-cyan-600 dark:text-cyan-400 font-semibold">Recommended Bypass 1</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 rounded bg-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Alternative Bypass 2</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. FLOATING SMART DETOUR ADVISOR (Only shown on hazard or explicit inspection) */}
      <AnimatePresence>
        {activeAdvisorArea && currentRouteProfile && (currentAdvisorSector.isDanger || currentAdvisorSector.isWarn) && (
          <motion.div
            initial={{ opacity: 0, x: 20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute bottom-3 right-3 z-[1000] pointer-events-none max-w-[360px] w-full"
          >
            <div 
              className="pointer-events-auto rounded-xl border p-3.5 shadow-2xl transition-all backdrop-blur-md"
              style={{ 
                background: 'var(--t-bg-surface)', 
                borderColor: 'var(--t-border)',
                color: 'var(--t-text-primary)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.35)' 
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b" style={{ borderColor: 'var(--t-border)' }}>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${currentAdvisorSector.isDanger ? 'bg-rose-500/15 text-rose-500' : currentAdvisorSector.isWarn ? 'bg-amber-500/15 text-amber-500' : 'bg-emerald-500/15 text-emerald-500'}`}>
                    <Compass size={16} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-xs" style={{ color: 'var(--t-text-primary)' }}>
                        Smart Route Advisor: {currentAdvisorSector.area.name}
                      </span>
                      {currentAdvisorSector.isDanger ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30">Hazard</span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">Safe</span>
                      )}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>
                      Water: {currentAdvisorSector.waterLevel.toFixed(1)}cm • Traffic: {currentAdvisorSector.trafficPct}%
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setAdvisorMinimized(prev => !prev)}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 text-xs font-bold transition cursor-pointer"
                    style={{ color: 'var(--t-text-muted)' }}
                  >
                    {advisorMinimized ? 'Expand' : 'Hide'}
                  </button>
                  <button
                    onClick={() => setActiveAdvisorArea(null)}
                    className="p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                    style={{ color: 'var(--t-text-muted)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {!advisorMinimized && (
                <div className="space-y-2 text-xs">
                  {/* Status alert box */}
                  <div className={`p-2 rounded-lg text-[11px] leading-tight ${currentAdvisorSector.isDanger ? 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'}`}>
                    {currentAdvisorSector.isDanger ? (
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle size={13} className="shrink-0 mt-0.5 text-rose-500" />
                        <div>
                          <strong>Caution:</strong> {currentRouteProfile.blockedCorridor.name} is obstructed ({currentAdvisorSector.statText}). Reroute active!
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>All roads in {currentAdvisorSector.area.name} are operational. Nominal throughput.</span>
                      </div>
                    )}
                  </div>

                  {/* Detour Recommendation List */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: 'var(--t-text-muted)' }}>
                      Recommended Bypass Paths:
                    </div>

                    {currentRouteProfile.detours.map((d, idx) => (
                      <div
                        key={d.id}
                        onClick={() => {
                          if (d.coordinates.length > 0) {
                            setFlyCoord(d.coordinates[0]);
                          }
                        }}
                        className="p-2.5 rounded-lg border transition cursor-pointer hover:border-cyan-400"
                        style={{
                          background: 'var(--t-bg-elevated)',
                          borderColor: 'var(--t-border)',
                        }}
                      >
                        <div className="flex items-center justify-between text-[11px] font-bold mb-0.5">
                          <span className={idx === 0 ? 'text-cyan-600 dark:text-cyan-400' : 'text-emerald-600 dark:text-emerald-400'}>
                            {idx === 0 ? '★ ' : '• '} {d.name}
                          </span>
                          <span className="font-mono text-[10px]" style={{ color: 'var(--t-text-muted)' }}>
                            {d.timeEstimate} ({d.distanceDelta})
                          </span>
                        </div>
                        <div className="text-[10px] font-medium leading-relaxed" style={{ color: 'var(--t-text-secondary)' }}>
                          {d.via}
                        </div>
                        <div className="text-[9px] mt-1 font-semibold text-emerald-600 dark:text-emerald-400">
                          {d.elevation}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Focus Action */}
                  <div className="flex justify-between items-center pt-1 text-[10px]">
                    <span style={{ color: 'var(--t-text-muted)' }}>Click any detour to fly & preview</span>
                    <button
                      onClick={() => setFlyCoord(currentRouteProfile.center)}
                      className="text-cyan-600 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Focus {currentAdvisorSector.area.name}</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MAP VIEWPORT: GOOGLE MAPS OR LEAFLET */}
      {internalEngine === 'google' ? (
        <GoogleCityMap
          floodSensors={floodSensors}
          trafficData={trafficData}
          alerts={alerts}
          selectedAreaName={activeAdvisorArea || selectedAreaName}
          onSelectArea={(area) => {
            setActiveAdvisorArea(area);
            setSelectedHotspot(area);
          }}
          activeRoutes={activeRoutes}
          selectedRouteId={selectedRouteId}
          darkMode={theme === 'dark'}
        />
      ) : (
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

        {/* 1. SECTOR STATUS BADGE MARKERS (ALL 11 SECTORS LABELED) */}
        {showAreaBadges && sectorEvaluations.map(({ area, statusType, statText, waterLevel, trafficPct }) => {
          return (
            <Marker
              key={`badge-${area.name}`}
              position={[area.lat, area.lng]}
              icon={createAreaBadgeIcon(area.name, statusType, statText)}
              eventHandlers={{
                click: () => {
                  setSelectedHotspot(area.name);
                  setActiveAdvisorArea(area.name);
                  setFlyCoord([area.lat, area.lng]);
                }
              }}
            >
              <Popup>
                <div className="p-2 min-w-[170px] text-slate-900 dark:text-slate-100">
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-300 dark:border-slate-700">
                    <span className="font-extrabold text-sm">{area.name}</span>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${statusType === 'danger' ? 'bg-red-500/20 text-red-500' : statusType === 'warn' ? 'bg-amber-500/20 text-amber-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                      {statusType}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span>Hydro Water Level:</span>
                    <span className="font-bold text-cyan-600 dark:text-cyan-400">{waterLevel.toFixed(1)} cm</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Traffic Congestion:</span>
                    <span className="font-bold text-amber-500">{trafficPct}%</span>
                  </div>
                  <button
                    onClick={() => setActiveAdvisorArea(area.name)}
                    className="w-full mt-1.5 py-1 text-center bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    View Reroute & Detours
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* 2. DYNAMIC REAL-ROAD NAVIGATION ROUTES IN LEAFLET */}
        {activeRoutes && activeRoutes.map((rt) => {
          const isSelected = rt.id === selectedRouteId;
          const strokeColor = rt.isCompromised
            ? '#ef4444' // Solid Red for hazard / blocked corridor
            : rt.isRecommendedDetour
            ? '#10b981' // Google Green for safe alternative detour
            : '#2563eb'; // Google Maps Classic Blue for optimal route

          return (
            <Polyline
              key={`dyn-route-${rt.id}`}
              positions={rt.path}
              pathOptions={{
                color: strokeColor,
                weight: isSelected ? 7 : 5,
                dashArray: rt.isCompromised ? '6, 6' : undefined,
                opacity: isSelected ? 0.95 : 0.75,
              }}
            >
              <Tooltip sticky>
                <div className="font-sans text-xs">
                  <strong>{rt.name}</strong> ({rt.distanceText} • {rt.durationText})
                </div>
              </Tooltip>
            </Polyline>
          );
        })}

        {/* 2b. SOLID RED HAZARD SPOTS (⛔) ON ACTIVE ROUTES */}
        {activeRoutes && activeRoutes.flatMap((rt) => rt.hazards || []).map((hz, idx) => (
          <Marker
            key={`hazard-spot-${hz.id || idx}`}
            position={hz.location}
            icon={L.divIcon({
              className: 'custom-hazard-spot',
              html: `
                <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
                  <div style="position: absolute; inset: 0; border-radius: 50%; background: #ef4444; opacity: 0.75; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                  <div style="position: relative; width: 28px; height: 28px; border-radius: 50%; background: #ef4444; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px rgba(239, 68, 68, 0.95); font-size: 14px; font-weight: bold; color: white;">
                    ⛔
                  </div>
                </div>
              `,
              iconSize: [34, 34],
              iconAnchor: [17, 17],
            })}
          >
            <Popup>
              <div className="p-2 min-w-[210px] text-slate-900 dark:text-slate-100">
                <div className="flex items-center gap-1.5 pb-1 mb-1 border-b border-red-500/30">
                  <span className="text-base">⛔</span>
                  <span className="font-extrabold text-xs text-red-600 dark:text-red-400 uppercase">
                    {hz.type === 'flood' ? 'SUBMERGED ROADWAY HAZARD' : 'TRAFFIC GRIDLOCK CHOKEPOINT'}
                  </span>
                </div>
                <div className="text-xs font-bold mb-1 text-slate-900 dark:text-white">
                  {hz.headline}
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mb-2">
                  {hz.description}
                </p>
                <div className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  🛡️ Alternative Safe Detour Active (Green Route)
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* 2. REROUTING & HAZARD POLYLINES */}
        {showRoutesLayer && Object.entries(VADODARA_ROUTE_PROFILES).map(([areaName, profile]) => {
          const matchingSector = sectorEvaluations.find(s => s.area.name.toLowerCase() === areaName.toLowerCase());
          const isHazard = matchingSector ? matchingSector.isDanger : false;
          const isFocused = activeAdvisorArea?.toLowerCase() === areaName.toLowerCase();

          // Only render polylines if area is hazardous or user specifically focused on this area
          if (!isHazard && !isFocused) return null;

          return (
            <div key={`routes-${areaName}`}>
              {/* Blocked corridor (Red Dashed Line with Hazard Tooltip) */}
              <Polyline
                positions={profile.blockedCorridor.coordinates}
                pathOptions={{
                  color: '#ef4444',
                  weight: isFocused ? 7 : 5,
                  dashArray: '8, 8',
                  opacity: 0.95,
                }}
              >
                <Tooltip sticky>
                  <div className="text-xs font-bold text-red-600 dark:text-red-400">
                    🚫 BLOCKED: {profile.blockedCorridor.name}
                    <div className="text-[10px] font-normal text-slate-300">
                      {profile.blockedCorridor.description}
                    </div>
                  </div>
                </Tooltip>
              </Polyline>

              {/* Primary Recommended Detour (Vivid Cyan Line) */}
              {profile.detours[0] && (
                <Polyline
                  positions={profile.detours[0].coordinates}
                  pathOptions={{
                    color: '#06b6d4',
                    weight: isFocused ? 6 : 4,
                    opacity: 0.95,
                  }}
                >
                  <Tooltip sticky>
                    <div className="text-xs font-bold text-cyan-500">
                      ✅ RECOMMENDED BYPASS: {profile.detours[0].name}
                      <div className="text-[10px] font-normal text-slate-200">
                        {profile.detours[0].via} ({profile.detours[0].timeEstimate}, {profile.detours[0].distanceDelta})
                      </div>
                    </div>
                  </Tooltip>
                </Polyline>
              )}

              {/* Secondary Alternative Detour (Emerald Dashed Line) */}
              {profile.detours[1] && (
                <Polyline
                  positions={profile.detours[1].coordinates}
                  pathOptions={{
                    color: '#10b981',
                    weight: isFocused ? 5 : 3.5,
                    dashArray: '6, 8',
                    opacity: 0.85,
                  }}
                >
                  <Tooltip sticky>
                    <div className="text-xs font-bold text-emerald-500">
                      • ALTERNATIVE DETOUR: {profile.detours[1].name}
                      <div className="text-[10px] font-normal text-slate-200">
                        {profile.detours[1].via} ({profile.detours[1].distanceDelta})
                      </div>
                    </div>
                  </Tooltip>
                </Polyline>
              )}
            </div>
          );
        })}

        {/* 3. TRAFFIC SENSOR SPOTS */}
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

        {/* 4. FLOOD SENSOR SPOTS */}
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
      )}
    </motion.div>
  );
}
