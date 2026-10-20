/* ============================================
   GOOGLE MAPS GIS CITY COMPONENT
   Native Google Maps Canvas with live sensors, traffic overlay,
   hazard corridors & dynamic detour navigation polylines
   ============================================ */

import React, { useEffect, useRef, useState } from 'react';
import { FloodSensor, TrafficData, Alert, NavRouteOption } from '../types';
import { loadGoogleMaps } from '../services/googleMapsLoader';
import { Layers, Eye, RefreshCw, Compass } from 'lucide-react';

interface GoogleCityMapProps {
  floodSensors: FloodSensor[];
  trafficData: TrafficData[];
  alerts: Alert[];
  selectedAreaName?: string;
  onSelectArea?: (areaName: string) => void;
  activeRoutes?: NavRouteOption[];
  selectedRouteId?: string | null;
  darkMode?: boolean;
}

// Sleek dark theme map styling for Google Maps
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1f2c' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1f2c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#06b6d4' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#94a3b8' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
];

export const GoogleCityMap: React.FC<GoogleCityMapProps> = ({
  floodSensors,
  trafficData,
  alerts,
  selectedAreaName,
  onSelectArea,
  activeRoutes = [],
  selectedRouteId,
  darkMode = true,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [trafficLayerEnabled, setTrafficLayerEnabled] = useState(true);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');

  // 1. Initialize Map
  useEffect(() => {
    let isMounted = true;

    loadGoogleMaps()
      .then((gMaps) => {
        if (!isMounted || !mapContainerRef.current) return;

        const defaultCenter = { lat: 22.3072, lng: 73.1812 }; // Vadodara City Center
        const map = new gMaps.maps.Map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          mapTypeId: mapTypeId,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: darkMode ? DARK_MAP_STYLE : [],
        });

        const trafficLayer = new gMaps.maps.TrafficLayer();
        trafficLayer.setMap(map);
        trafficLayerRef.current = trafficLayer;

        mapInstanceRef.current = map;
        setMapLoaded(true);
      })
      .catch((err) => {
        console.error('[GoogleCityMap] Loader error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Update Map Style on Dark Mode Change
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current.setOptions({
        styles: darkMode ? DARK_MAP_STYLE : [],
      });
    }
  }, [darkMode]);

  // 3. Toggle Traffic Layer
  useEffect(() => {
    if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(trafficLayerEnabled ? mapInstanceRef.current : null);
    }
  }, [trafficLayerEnabled]);

  // 4. Update Map Type (Roadmap / Satellite)
  useEffect(() => {
    if (mapInstanceRef.current && window.google?.maps) {
      mapInstanceRef.current.setMapTypeId(mapTypeId);
    }
  }, [mapTypeId]);

  // 5. Render Sector Markers & Flood/Traffic Status
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google?.maps) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const map = mapInstanceRef.current;

    floodSensors.forEach((sensor) => {
      const isDanger = sensor.water_level >= sensor.max_threshold;
      const isWarning = sensor.water_level >= sensor.warn_threshold;
      const matchingTraffic = trafficData.find(
        (t) => t.area_name.toLowerCase() === sensor.area_name.toLowerCase()
      );
      const isHeavyTraffic = matchingTraffic && matchingTraffic.traffic_percentage >= 75;

      const markerColor = (isDanger || isHeavyTraffic)
        ? '#ef4444' // Red
        : isWarning
        ? '#f59e0b' // Amber
        : '#10b981'; // Green

      // Create Custom SVG Pin
      const svgIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: markerColor,
        fillOpacity: 0.9,
        scale: isDanger ? 10 : 8,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      };

      const marker = new window.google.maps.Marker({
        position: { lat: sensor.latitude, lng: sensor.longitude },
        map: map,
        title: `${sensor.area_name} • ${sensor.water_level} cm`,
        icon: svgIcon,
      });

      // Info Window on click
      const contentString = `
        <div style="font-family: sans-serif; padding: 6px; color: #0f172a; max-width: 220px;">
          <h4 style="margin: 0 0 4px 0; font-size: 13px; font-weight: bold;">
            ${sensor.area_name}
          </h4>
          <div style="font-size: 11px; margin-bottom: 2px;">
            <strong>Water Level:</strong> 
            <span style="color: ${markerColor}; font-weight: bold;">${sensor.water_level} cm</span>
          </div>
          <div style="font-size: 11px; margin-bottom: 4px;">
            <strong>Traffic Density:</strong> ${matchingTraffic?.traffic_percentage || 0}% (${matchingTraffic?.vehicle_count || 0} vehicles)
          </div>
          <div style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: ${markerColor};">
            ${isDanger ? '🔴 CRITICAL HAZARD' : isWarning ? '🟡 SURGE WARNING' : '🟢 OPERATIONAL • SAFE'}
          </div>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({
        content: contentString,
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
        if (onSelectArea) onSelectArea(sensor.area_name);
      });

      markersRef.current.push(marker);
    });
  }, [mapLoaded, floodSensors, trafficData, onSelectArea]);

  // 6. Render Active Routes & Safe Detour Polylines
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google?.maps) return;

    // Clear old polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const map = mapInstanceRef.current;
    if (activeRoutes.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    activeRoutes.forEach((route) => {
      const isSelected = route.id === selectedRouteId;
      const isCompromised = route.isCompromised;

      // Color and line style
      let strokeColor = '#06b6d4'; // default cyan
      let strokeOpacity = 0.8;
      let strokeWeight = 5;
      let zIndex = 2;

      if (isCompromised) {
        strokeColor = '#ef4444'; // Red for hazard / blocked
        strokeOpacity = 0.9;
        strokeWeight = isSelected ? 6 : 4;
        zIndex = isSelected ? 4 : 2;
      } else if (route.isRecommendedDetour) {
        strokeColor = '#10b981'; // Green for safe detour
        strokeOpacity = 0.95;
        strokeWeight = isSelected ? 7 : 5;
        zIndex = isSelected ? 5 : 3;
      }

      const googlePath = route.path.map((pt) => {
        const latLng = new window.google.maps.LatLng(pt[0], pt[1]);
        bounds.extend(latLng);
        return latLng;
      });

      const polyline = new window.google.maps.Polyline({
        path: googlePath,
        geodesic: true,
        strokeColor,
        strokeOpacity,
        strokeWeight,
        zIndex,
        map,
      });

      polylinesRef.current.push(polyline);
    });

    // Auto-fit map to the route paths
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { top: 60, right: 60, bottom: 60, left: 60 });
    }
  }, [mapLoaded, activeRoutes, selectedRouteId]);

  return (
    <div className="relative w-full h-full min-h-[480px] rounded-2xl overflow-hidden border border-cyan-500/20 shadow-xl">
      {/* Google Maps Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[480px]" />

      {/* Top Map Control Bar */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        {/* Traffic Layer Toggle */}
        <button
          onClick={() => setTrafficLayerEnabled(!trafficLayerEnabled)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold backdrop-blur-md shadow-lg transition-all ${
            trafficLayerEnabled
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
              : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:text-white'
          }`}
        >
          <Layers size={13} />
          <span>Live Traffic</span>
        </button>

        {/* Satellite Toggle */}
        <button
          onClick={() => setMapTypeId(mapTypeId === 'roadmap' ? 'hybrid' : 'roadmap')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold backdrop-blur-md shadow-lg transition-all ${
            mapTypeId === 'hybrid'
              ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-400'
              : 'border-slate-700 bg-slate-900/80 text-slate-400 hover:text-white'
          }`}
        >
          <Eye size={13} />
          <span>{mapTypeId === 'hybrid' ? 'Vector Map' : 'Satellite'}</span>
        </button>

        {/* Recenter Vadodara */}
        <button
          onClick={() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.panTo({ lat: 22.3072, lng: 73.1812 });
              mapInstanceRef.current.setZoom(13);
            }
          }}
          title="Recenter on Vadodara"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 backdrop-blur-md shadow-lg transition"
        >
          <Compass size={14} />
        </button>
      </div>

      {/* Bottom Map Legend */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-950/80 px-3 py-1.5 text-[10px] font-mono backdrop-blur-md text-slate-300 shadow-xl">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Safe / Optimal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          Surge Warning
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          Hazard / Submerged
        </span>
        <span className="flex items-center gap-1.5 border-l border-slate-700 pl-2">
          <span className="h-1 w-4 rounded bg-emerald-400" />
          Safe Detour
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1 w-4 rounded bg-red-500" />
          Blocked Road
        </span>
      </div>
    </div>
  );
};
