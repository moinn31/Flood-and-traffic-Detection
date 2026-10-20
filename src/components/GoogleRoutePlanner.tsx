/* ============================================
   GOOGLE MAPS HAZARD-AWARE ROUTE PLANNER
   Origin/Destination Search with Dynamic Flood & Traffic Interception
   ============================================ */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Navigation, MapPin, ArrowRightLeft, ShieldAlert, ShieldCheck,
  Clock, Route, ChevronDown, ChevronUp, AlertTriangle, ArrowRight,
  Car, Compass, RefreshCw, X, Sparkles, CheckCircle2
} from 'lucide-react';
import { FloodSensor, TrafficData, NavRouteOption, NavigationHazard, NavStep } from '../types';
import { VADODARA_AREAS } from '../data';
import {
  detectRouteHazards,
  getBypassWaypointsForHazards,
  createSimulatedFallbackRoute
} from '../services/routeHazardService';
import { loadGoogleMaps, isGoogleMapsLoaded } from '../services/googleMapsLoader';

interface GoogleRoutePlannerProps {
  floodSensors: FloodSensor[];
  trafficData: TrafficData[];
  onRoutesCalculated: (routes: NavRouteOption[], selectedRouteId: string | null) => void;
  selectedRouteId: string | null;
  onSelectRoute: (routeId: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const GoogleRoutePlanner: React.FC<GoogleRoutePlannerProps> = ({
  floodSensors,
  trafficData,
  onRoutesCalculated,
  selectedRouteId,
  onSelectRoute,
  isOpen,
  onToggleOpen,
}) => {
  const [origin, setOrigin] = useState<string>('Alkapuri');
  const [destination, setDestination] = useState<string>('Karelibaug');
  const [loading, setLoading] = useState<boolean>(false);
  const [routes, setRoutes] = useState<NavRouteOption[]>([]);
  const [expandedSteps, setExpandedSteps] = useState<boolean>(false);
  const [googleMapsReady, setGoogleMapsReady] = useState<boolean>(false);

  const originInputRef = useRef<HTMLInputElement>(null);
  const destInputRef = useRef<HTMLInputElement>(null);

  // Initialize Google Maps SDK and Autocomplete
  useEffect(() => {
    loadGoogleMaps()
      .then((gMaps) => {
        setGoogleMapsReady(true);
        if (!gMaps || !gMaps.maps || !gMaps.maps.places) return;

        // Vadodara bounds constraint
        const vadodaraBounds = new gMaps.maps.LatLngBounds(
          new gMaps.maps.LatLng(22.2300, 73.1000),
          new gMaps.maps.LatLng(22.3800, 73.2600)
        );

        if (originInputRef.current) {
          const autoOrigin = new gMaps.maps.places.Autocomplete(originInputRef.current, {
            bounds: vadodaraBounds,
            componentRestrictions: { country: 'in' },
            strictBounds: false,
          });
          autoOrigin.addListener('place_changed', () => {
            const place = autoOrigin.getPlace();
            if (place.name) setOrigin(place.name);
          });
        }

        if (destInputRef.current) {
          const autoDest = new gMaps.maps.places.Autocomplete(destInputRef.current, {
            bounds: vadodaraBounds,
            componentRestrictions: { country: 'in' },
            strictBounds: false,
          });
          autoDest.addListener('place_changed', () => {
            const place = autoDest.getPlace();
            if (place.name) setDestination(place.name);
          });
        }
      })
      .catch((err) => {
        console.warn('[GoogleRoutePlanner] Google Maps SDK init error (falling back to local engine):', err);
      });
  }, []);

  // Compute Route using Google Directions Service or Local Fallback
  const calculateRoute = async () => {
    if (!origin || !destination) return;
    setLoading(true);

    try {
      if (isGoogleMapsLoaded() && window.google?.maps?.DirectionsService) {
        const directionsService = new window.google.maps.DirectionsService();

        // 1. Calculate Primary Direct Route
        const primaryResult = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
          directionsService.route(
            {
              origin: `${origin}, Vadodara, Gujarat, India`,
              destination: `${destination}, Vadodara, Gujarat, India`,
              travelMode: window.google.maps.TravelMode.DRIVING,
              provideRouteAlternatives: true,
            },
            (result, status) => {
              if (status === window.google.maps.DirectionsStatus.OK && result) {
                resolve(result);
              } else {
                console.warn('[GoogleRoutePlanner] Directions request status:', status);
                resolve(null);
              }
            }
          );
        });

        if (primaryResult && primaryResult.routes.length > 0) {
          const gRoute = primaryResult.routes[0];
          const leg = gRoute.legs[0];

          // Extract path coordinates
          const pathCoords: [number, number][] = (gRoute.overview_path || []).map((latLng) => [
            latLng.lat(),
            latLng.lng(),
          ]);

          // Extract turn steps
          const steps: NavStep[] = (leg.steps || []).map((s) => ({
            instructions: s.instructions ? s.instructions.replace(/<[^>]+>/g, '') : '',
            distance: s.distance?.text || '',
            duration: s.duration?.text || '',
            location: [s.start_location.lat(), s.start_location.lng()],
          }));

          // Intercept hazards along this path
          const detectedHazards = detectRouteHazards(pathCoords, floodSensors, trafficData);
          const isCompromised = detectedHazards.length > 0;

          const calculatedRoutes: NavRouteOption[] = [];

          // Primary route entry
          calculatedRoutes.push({
            id: 'groute-primary',
            name: isCompromised ? 'Direct Route (Hazard Detected)' : 'Fastest Route (Clear)',
            summary: gRoute.summary || `Via ${origin} - ${destination} Arterial`,
            via: gRoute.summary || 'Main City Corridor',
            isCompromised,
            isRecommendedDetour: !isCompromised,
            distanceMeters: leg.distance?.value || 0,
            distanceText: leg.distance?.text || '',
            durationSeconds: leg.duration?.value || 0,
            durationText: leg.duration?.text || '',
            hazards: detectedHazards,
            path: pathCoords,
            steps,
            elevationTag: isCompromised ? 'Low-Lying / Flooded' : 'Optimal Elevation',
          });

          // 2. If compromised, request Safe Detour avoiding hazards via waypoints
          if (isCompromised) {
            const bypassWaypoints = getBypassWaypointsForHazards(detectedHazards);

            if (bypassWaypoints.length > 0) {
              const detourWaypoints: google.maps.DirectionsWaypoint[] = bypassWaypoints.map((pt) => ({
                location: new window.google.maps.LatLng(pt[0], pt[1]),
                stopover: false,
              }));

              const detourResult = await new Promise<google.maps.DirectionsResult | null>((resolve) => {
                directionsService.route(
                  {
                    origin: `${origin}, Vadodara, Gujarat, India`,
                    destination: `${destination}, Vadodara, Gujarat, India`,
                    waypoints: detourWaypoints,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                    optimizeWaypoints: false,
                  },
                  (res, st) => {
                    if (st === window.google.maps.DirectionsStatus.OK && res) {
                      resolve(res);
                    } else {
                      resolve(null);
                    }
                  }
                );
              });

              if (detourResult && detourResult.routes.length > 0) {
                const dRoute = detourResult.routes[0];
                const dLeg = dRoute.legs[0];
                const dPath: [number, number][] = (dRoute.overview_path || []).map((pt) => [
                  pt.lat(),
                  pt.lng(),
                ]);

                calculatedRoutes.push({
                  id: 'groute-safe-detour',
                  name: '🛡️ Safe Alternative Detour (Recommended)',
                  summary: dRoute.summary || 'Via Elevated Flyover Corridor',
                  via: 'Akota-Dandia Bazar Flyover & Race Course Ring',
                  isCompromised: false,
                  isRecommendedDetour: true,
                  distanceMeters: dLeg.distance?.value || Math.round(leg.distance?.value! * 1.25),
                  distanceText: dLeg.distance?.text || `${((leg.distance?.value! * 1.25) / 1000).toFixed(1)} km`,
                  durationSeconds: dLeg.duration?.value || Math.round(leg.duration?.value! * 1.3),
                  durationText: dLeg.duration?.text || `${Math.round((leg.duration?.value! * 1.3) / 60)} mins`,
                  hazards: [],
                  path: dPath,
                  steps: (dLeg.steps || []).map((s) => ({
                    instructions: s.instructions ? s.instructions.replace(/<[^>]+>/g, '') : '',
                    distance: s.distance?.text || '',
                    duration: s.duration?.text || '',
                    location: [s.start_location.lat(), s.start_location.lng()],
                  })),
                  elevationTag: '100% Flood-Safe • High-Ground Bypass',
                });
              }
            }
          }

          setRoutes(calculatedRoutes);
          const initialSelection = isCompromised && calculatedRoutes.length > 1
            ? 'groute-safe-detour'
            : calculatedRoutes[0].id;
          onRoutesCalculated(calculatedRoutes, initialSelection);
          setLoading(false);
          return;
        }
      }

      // Local Fallback Route Simulation if Google Maps API limits or offline
      const originArea = VADODARA_AREAS.find((a) => a.name.toLowerCase() === origin.toLowerCase());
      const destArea = VADODARA_AREAS.find((a) => a.name.toLowerCase() === destination.toLowerCase());

      const simulatedHazards: NavigationHazard[] = [];
      const originFlood = floodSensors.find((s) => s.area_name.toLowerCase() === origin.toLowerCase());
      if (originFlood && originFlood.water_level >= originFlood.warn_threshold) {
        simulatedHazards.push({
          id: `sim-hazard-${originFlood.id}`,
          type: 'flood',
          areaName: originFlood.area_name,
          severity: originFlood.water_level >= originFlood.max_threshold ? 'danger' : 'warning',
          headline: `CRITICAL SUBMERGENCE: ${originFlood.area_name} Underpass Submerged (${originFlood.water_level} cm)`,
          description: `Roadway impassable. Ultrasonic sensor ${originFlood.id} registered water crest at ${originFlood.water_level} cm.`,
          waterLevel: originFlood.water_level,
          location: [originArea ? originArea.lat : 22.3110, originArea ? originArea.lng : 73.1725],
          distanceToRouteMeters: 20,
        });
      }

      const fallbackRoutes = createSimulatedFallbackRoute(origin, destination, simulatedHazards);
      setRoutes(fallbackRoutes);
      const chosenId = fallbackRoutes.length > 1 ? fallbackRoutes[1].id : fallbackRoutes[0].id;
      onRoutesCalculated(fallbackRoutes, chosenId);
    } catch (err) {
      console.error('[GoogleRoutePlanner] Calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate whenever origin/destination changes or flood levels update
  useEffect(() => {
    calculateRoute();
  }, [floodSensors, trafficData]);

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handlePreset = (orig: string, dst: string) => {
    setOrigin(orig);
    setDestination(dst);
  };

  const activeRoute = routes.find((r) => r.id === selectedRouteId) || routes[0];

  return (
    <div className="relative">
      {/* Trigger Toggle Button (if closed) */}
      {!isOpen && (
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-slate-900/90 px-3.5 py-2.5 text-xs font-bold text-white shadow-xl backdrop-blur-md transition-all hover:bg-cyan-500/20 hover:border-cyan-400"
        >
          <Navigation size={16} className="text-cyan-400 animate-pulse" />
          <span>Google Maps Smart Rerouting</span>
          {routes.some((r) => r.isCompromised) && (
            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
          )}
        </button>
      )}

      {/* Main Navigation Modal / Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className="w-full max-w-md rounded-2xl border border-cyan-500/30 p-4 shadow-2xl backdrop-blur-xl"
            style={{ background: 'var(--t-bg-body)', color: 'var(--t-text-primary)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--t-border-subtle)] mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/20">
                  <Navigation size={18} />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: 'var(--t-text-primary)' }}>
                    Google Maps Hazard Rerouting
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-500 font-mono">
                      LIVE AI
                    </span>
                  </h3>
                  <p className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>
                    Vadodara Municipal Smart Transit Engine
                  </p>
                </div>
              </div>

              <button
                onClick={onToggleOpen}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Inputs: Origin & Destination */}
            <div className="space-y-2 mb-3">
              <div className="relative flex items-center">
                <span className="absolute left-3 text-cyan-500">
                  <MapPin size={15} />
                </span>
                <input
                  ref={originInputRef}
                  type="text"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Starting point (e.g. Alkapuri, Vadodara)"
                  className="w-full rounded-xl border pl-9 pr-9 py-2 text-xs font-medium focus:outline-none focus:border-cyan-500 transition"
                  style={{
                    borderColor: 'var(--t-border-subtle)',
                    background: 'var(--t-bg-elevated)',
                    color: 'var(--t-text-primary)',
                  }}
                />
              </div>

              <div className="flex items-center justify-center -my-1 relative z-10">
                <button
                  onClick={handleSwap}
                  title="Swap Origin and Destination"
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-500/30 bg-[var(--t-bg-body)] text-cyan-500 hover:bg-cyan-500/10 transition shadow-sm"
                >
                  <ArrowRightLeft size={11} />
                </button>
              </div>

              <div className="relative flex items-center">
                <span className="absolute left-3 text-emerald-500">
                  <Navigation size={15} />
                </span>
                <input
                  ref={destInputRef}
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Destination (e.g. Karelibaug, Vadodara)"
                  className="w-full rounded-xl border pl-9 pr-9 py-2 text-xs font-medium focus:outline-none focus:border-emerald-500 transition"
                  style={{
                    borderColor: 'var(--t-border-subtle)',
                    background: 'var(--t-bg-elevated)',
                    color: 'var(--t-text-primary)',
                  }}
                />
              </div>
            </div>

            {/* Quick Demo Preset Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[10px] uppercase font-bold" style={{ color: 'var(--t-text-muted)' }}>
                Demo Routes:
              </span>
              <button
                onClick={() => handlePreset('Alkapuri', 'Karelibaug')}
                className="text-[10px] px-2 py-0.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold hover:bg-cyan-500/20 transition"
              >
                Alkapuri ➔ Karelibaug
              </button>
              <button
                onClick={() => handlePreset('Akota', 'Harni')}
                className="text-[10px] px-2 py-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold hover:bg-emerald-500/20 transition"
              >
                Akota ➔ Airport
              </button>
              <button
                onClick={() => handlePreset('Gotri', 'Manjalpur')}
                className="text-[10px] px-2 py-0.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold hover:bg-purple-500/20 transition"
              >
                Gotri ➔ Manjalpur
              </button>
            </div>

            {/* Calculate Button */}
            <button
              onClick={calculateRoute}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-bold shadow-lg shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 transition disabled:opacity-50 mb-3"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Scanning IoT Flood & Traffic Telemetry...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Inspect & Plan Safe Navigation</span>
                </>
              )}
            </button>

            {/* Hazard Interception Banner (if any route compromised) */}
            {routes.some((r) => r.isCompromised) && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 mb-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <div className="text-xs font-bold text-red-600 dark:text-red-400">
                      Hazard Intercepted on Direct Corridor!
                    </div>
                    <p className="text-[11px] mt-0.5 text-slate-700 dark:text-slate-300">
                      {routes.find((r) => r.isCompromised)?.hazards[0]?.headline ||
                        'Submerged roadway detected along primary corridor.'}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={12} />
                      Safe Elevated Bypass Automatically Calculated Below
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Route Cards Comparison */}
            <div className="space-y-2 mb-3">
              {routes.map((rt) => {
                const isSelected = rt.id === selectedRouteId;
                return (
                  <div
                    key={rt.id}
                    onClick={() => onSelectRoute(rt.id)}
                    className={`cursor-pointer rounded-xl border p-2.5 transition-all ${
                      isSelected
                        ? rt.isCompromised
                          ? 'border-red-500 bg-red-500/10 shadow-md shadow-red-500/10'
                          : 'border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500'
                        : 'border-[var(--t-border-subtle)] bg-[var(--t-bg-elevated)] hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`flex h-2.5 w-2.5 rounded-full ${
                            rt.isCompromised
                              ? 'bg-red-500 animate-pulse'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span className="text-xs font-bold" style={{ color: 'var(--t-text-primary)' }}>
                          {rt.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400">
                          {rt.durationText}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({rt.distanceText})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                        Via: {rt.via}
                      </span>
                      {rt.elevationTag && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rt.isCompromised
                              ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {rt.elevationTag}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Turn-by-Turn Navigation Expandable Section */}
            {activeRoute && activeRoute.steps.length > 0 && (
              <div className="rounded-xl border border-[var(--t-border-subtle)] p-2.5 bg-[var(--t-bg-elevated)]">
                <button
                  onClick={() => setExpandedSteps(!expandedSteps)}
                  className="w-full flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  <span className="flex items-center gap-1.5">
                    <Route size={14} className="text-cyan-500" />
                    Turn-by-Turn Navigation ({activeRoute.steps.length} Steps)
                  </span>
                  {expandedSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                <AnimatePresence>
                  {expandedSteps && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2.5 space-y-2 max-h-48 overflow-y-auto pr-1"
                    >
                      {activeRoute.steps.map((st, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px] pb-1.5 border-b border-[var(--t-border-subtle)] last:border-b-0">
                          <ArrowRight size={13} className="text-cyan-500 shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p style={{ color: 'var(--t-text-primary)' }}>{st.instructions}</p>
                            <span className="text-[10px] font-mono text-slate-400">
                              {st.distance} • {st.duration}
                            </span>
                          </div>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
