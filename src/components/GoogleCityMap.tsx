/* ============================================
   GOOGLE MAPS GIS CITY COMPONENT
   Native Google Maps Canvas with live sensors, traffic overlay,
   prominent RED HAZARD SPOTS on routes, and safe alternative detours
   ============================================ */

import React, { useEffect, useRef, useState } from 'react';
import { FloodSensor, TrafficData, Alert, NavRouteOption } from '../types';
import { loadGoogleMaps } from '../services/googleMapsLoader';
import { Layers, Eye, Compass } from 'lucide-react';

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
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
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
  const hazardSpotsRef = useRef<google.maps.Marker[]>([]);
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

      const svgIcon = {
        path: window.google.maps.SymbolPath.CIRCLE,
        fillColor: markerColor,
        fillOpacity: 0.9,
        scale: isDanger ? 9 : 7,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      };

      const marker = new window.google.maps.Marker({
        position: { lat: sensor.latitude, lng: sensor.longitude },
        map: map,
        title: `${sensor.area_name} • ${sensor.water_level} cm`,
        icon: svgIcon,
      });

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

  // 6. Render Active Routes, Red Hazard Spots & Safe Detour Polylines
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google?.maps) return;

    // Clear old polylines & hazard markers
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    hazardSpotsRef.current.forEach((h) => h.setMap(null));
    hazardSpotsRef.current = [];

    const map = mapInstanceRef.current;
    if (activeRoutes.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();

    activeRoutes.forEach((route) => {
      const isSelected = route.id === selectedRouteId;
      const isCompromised = route.isCompromised;

      // Color and line style
      let strokeColor = '#4285F4'; // Classic Google Maps Blue
      let strokeOpacity = 0.85;
      let strokeWeight = 6;
      let zIndex = 2;

      if (isCompromised) {
        strokeColor = '#ef4444'; // Solid Red for blocked corridor
        strokeOpacity = 0.95;
        strokeWeight = isSelected ? 7 : 5;
        zIndex = isSelected ? 4 : 2;

        // Render PROMINENT RED HAZARD SPOT on the route
        if (route.hazards && route.hazards.length > 0) {
          route.hazards.forEach((hz) => {
            const hazardSpotIcon = {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: '#ef4444',
              fillOpacity: 1.0,
              scale: 14,
              strokeColor: '#ffffff',
              strokeWeight: 3.5,
            };

            const spotMarker = new window.google.maps.Marker({
              position: { lat: hz.location[0], lng: hz.location[1] },
              map: map,
              title: `⛔ HAZARD SPOT: ${hz.headline}`,
              icon: hazardSpotIcon,
              zIndex: 1000,
            });

            const spotContent = `
              <div style="font-family: sans-serif; padding: 6px; color: #0f172a; max-width: 250px;">
                <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
                  <span style="font-size: 16px;">⛔</span>
                  <span style="color: #ef4444; font-weight: 800; font-size: 12px; text-transform: uppercase;">
                    ${hz.type === 'flood' ? 'SUBMERGED ROADWAY HAZARD' : 'TRAFFIC GRIDLOCK CHOKEPOINT'}
                  </span>
                </div>
                <div style="font-size: 12px; font-weight: bold; margin-bottom: 3px; color: #0f172a;">
                  ${hz.headline}
                </div>
                <div style="font-size: 11px; color: #475569; line-height: 1.35; margin-bottom: 6px;">
                  ${hz.description}
                </div>
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 4px 6px; font-size: 10px; font-weight: bold; color: #15803d;">
                  🛡️ Safe Elevated Detour Active (Green Route)
                </div>
              </div>
            `;

            const spotInfoWindow = new window.google.maps.InfoWindow({
              content: spotContent,
            });

            spotMarker.addListener('click', () => {
              spotInfoWindow.open(map, spotMarker);
            });

            hazardSpotsRef.current.push(spotMarker);
          });
        }
      } else if (route.isRecommendedDetour) {
        strokeColor = '#0F9D58'; // Google Maps Green for Recommended Detour
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
      map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }
  }, [mapLoaded, activeRoutes, selectedRouteId]);

  return (
    <div className="relative w-full h-full min-h-[480px] overflow-hidden">
      {/* Google Maps Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[480px]" />

      {/* Top Right Map Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 pointer-events-auto">
        {/* Traffic Layer Toggle */}
        <button
          onClick={() => setTrafficLayerEnabled(!trafficLayerEnabled)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-lg transition-all cursor-pointer ${
            trafficLayerEnabled
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400'
              : 'border-slate-700 bg-slate-900/90 text-slate-400 hover:text-white'
          }`}
        >
          <Layers size={13} />
          <span>Traffic Layer</span>
        </button>

        {/* Satellite Toggle */}
        <button
          onClick={() => setMapTypeId(mapTypeId === 'roadmap' ? 'hybrid' : 'roadmap')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shadow-lg transition-all cursor-pointer ${
            mapTypeId === 'hybrid'
              ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-400'
              : 'border-slate-700 bg-slate-900/90 text-slate-400 hover:text-white'
          }`}
        >
          <Eye size={13} />
          <span>{mapTypeId === 'hybrid' ? 'Vector' : 'Satellite'}</span>
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
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 shadow-lg transition cursor-pointer"
        >
          <Compass size={14} />
        </button>
      </div>
    </div>
  );
};
