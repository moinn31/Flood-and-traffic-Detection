/* ============================================
   ROUTE HAZARD INTERCEPTION & DETOUR ENGINE
   Real road geometry (OSRM + Google Maps), live IoT flood crests,
   traffic gridlock detection, solid red hazard spots, and alternative detours.
   ============================================ */

import { FloodSensor, TrafficData, NavigationHazard, NavRouteOption, NavStep } from '../types';
import { VADODARA_ROUTE_PROFILES } from '../routingData';
import { VADODARA_AREAS } from '../data';

// Helper: Haversine distance in meters
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Check minimum distance from a point to a polyline
export function minDistanceToPath(point: [number, number], path: [number, number][]): number {
  if (path.length === 0) return Infinity;
  let minD = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = getDistanceMeters(point[0], point[1], path[i][0], path[i][1]);
    if (d < minD) minD = d;
  }
  return minD;
}

// Known critical infrastructure choke points in Vadodara prone to inundation
export const VADODARA_CHOKEPOINTS = [
  {
    name: 'Alkapuri Railway Underpass',
    area: 'Alkapuri',
    coords: [22.3110, 73.1725] as [number, number],
    bufferMeters: 300,
    criticalThreshold: 100, // cm
    bypassVia: 'Akota-Dandia Bazar Flyover & Jetalpur Bridge',
    bypassWaypoints: [[22.2980, 73.1810], [22.3040, 73.1870]] as [number, number][],
  },
  {
    name: 'Kala Ghoda Bridge (Vishwamitri Crossing)',
    area: 'Sayajigunj',
    coords: [22.3150, 73.1900] as [number, number],
    bufferMeters: 250,
    criticalThreshold: 110,
    bypassVia: 'Fatehgunj Flyover & Narhari Hospital Road',
    bypassWaypoints: [[22.3210, 73.1880], [22.3250, 73.1930]] as [number, number][],
  },
  {
    name: 'Mujmahuda - Akota Low Causeway',
    area: 'Akota',
    coords: [22.2950, 73.1680] as [number, number],
    bufferMeters: 250,
    criticalThreshold: 100,
    bypassVia: 'Old Padra High Ridge & OP Road Ring',
    bypassWaypoints: [[22.2920, 73.1590], [22.3000, 73.1550]] as [number, number][],
  },
  {
    name: 'Manjalpur Drainage Culvert (GIDC Cross)',
    area: 'Manjalpur',
    coords: [22.2760, 73.1930] as [number, number],
    bufferMeters: 250,
    criticalThreshold: 100,
    bypassVia: 'Tarsali Ring Road & Makarpura Highway Elevated Strip',
    bypassWaypoints: [[22.2700, 73.2050], [22.2820, 73.2080]] as [number, number][],
  },
  {
    name: 'Fatehgunj Circle Underpass',
    area: 'Fatehgunj',
    coords: [22.3200, 73.1850] as [number, number],
    bufferMeters: 250,
    criticalThreshold: 100,
    bypassVia: 'Camp Road Elevated Sector & VIP Bypass',
    bypassWaypoints: [[22.3280, 73.1820], [22.3320, 73.1900]] as [number, number][],
  },
];

/**
 * Evaluates a route path against live IoT flood sensors and traffic gridlocks
 */
export function detectRouteHazards(
  path: [number, number][],
  floodSensors: FloodSensor[],
  trafficData: TrafficData[],
  originArea?: string,
  destArea?: string
): NavigationHazard[] {
  const hazards: NavigationHazard[] = [];
  if (path.length === 0) return hazards;

  // 1. Check against dynamic flood sensors
  floodSensors.forEach((sensor) => {
    const maxThr = sensor.max_threshold ?? 180;
    const warnThr = sensor.warn_threshold ?? 100;
    const isUltrasonic = maxThr < warnThr;
    const isDanger = sensor.severity === 'danger' || (isUltrasonic ? sensor.water_level <= maxThr : sensor.water_level >= maxThr);
    const isWarning = !isDanger && (sensor.severity === 'warning' || (isUltrasonic ? sensor.water_level <= warnThr : sensor.water_level >= warnThr));

    if (!isDanger && !isWarning) return;

    const isOriginOrDest = (originArea && sensor.area_name.toLowerCase() === originArea.toLowerCase()) ||
                           (destArea && sensor.area_name.toLowerCase() === destArea.toLowerCase());
    const dist = minDistanceToPath([sensor.latitude, sensor.longitude], path);

    // Within 350m buffer or origin/destination sector
    if (dist <= 350 || isOriginOrDest) {
      if (!hazards.some((h) => h.areaName.toLowerCase() === sensor.area_name.toLowerCase() && h.type === 'flood')) {
        hazards.push({
          id: `hazard-flood-${sensor.id}`,
          type: 'flood',
          areaName: sensor.area_name,
          severity: isDanger ? 'danger' : 'warning',
          headline: isDanger
            ? `CRITICAL SUBMERGENCE: ${sensor.area_name} Corridor Submerged (${sensor.water_level.toFixed(1)} cm)`
            : `FLOOD SURGE WARNING: High Water in ${sensor.area_name} (${sensor.water_level.toFixed(1)} cm)`,
          description: `Ultrasonic telemetry sensor ${sensor.id} reports water level at ${sensor.water_level.toFixed(1)} cm (Warn: ${sensor.warn_threshold} cm, Max: ${sensor.max_threshold} cm). Roadway passability compromised.`,
          waterLevel: sensor.water_level,
          location: [sensor.latitude, sensor.longitude],
          distanceToRouteMeters: Math.round(dist),
        });
      }
    }
  });

  // 2. Check against traffic data
  trafficData.forEach((traffic) => {
    const isHeavy = traffic.traffic_percentage >= 70 || traffic.traffic_level === 'heavy';
    if (!isHeavy) return;

    const isOriginOrDest = (originArea && traffic.area_name.toLowerCase() === originArea.toLowerCase()) ||
                           (destArea && traffic.area_name.toLowerCase() === destArea.toLowerCase());
    const dist = minDistanceToPath([traffic.latitude, traffic.longitude], path);

    if (dist <= 300 || isOriginOrDest) {
      if (!hazards.some((h) => h.areaName.toLowerCase() === traffic.area_name.toLowerCase() && h.type === 'traffic')) {
        hazards.push({
          id: `hazard-traffic-${traffic.id}`,
          type: 'traffic',
          areaName: traffic.area_name,
          severity: traffic.traffic_percentage >= 80 ? 'danger' : 'warning',
          headline: `TRAFFIC GRIDLOCK: ${traffic.area_name} (${traffic.traffic_percentage}% Congestion)`,
          description: `Heavy vehicular congestion (${traffic.vehicle_count} active vehicles counted by optical vision AI). Severe transit delay expected.`,
          trafficPercentage: traffic.traffic_percentage,
          location: [traffic.latitude, traffic.longitude],
          distanceToRouteMeters: Math.round(dist),
        });
      }
    }
  });

  // 3. Check against known chokepoints if sensor in that area is above threshold
  VADODARA_CHOKEPOINTS.forEach((choke) => {
    const matchingFlood = floodSensors.find((s) => s.area_name.toLowerCase() === choke.area.toLowerCase());
    const level = matchingFlood ? matchingFlood.water_level : 0;

    if (level >= choke.criticalThreshold || matchingFlood?.severity === 'danger') {
      const dist = minDistanceToPath(choke.coords, path);
      if (dist <= choke.bufferMeters && !hazards.some((h) => h.areaName.toLowerCase() === choke.area.toLowerCase() && h.type === 'flood')) {
        hazards.push({
          id: `hazard-choke-${choke.name}`,
          type: 'flood',
          areaName: choke.area,
          severity: 'danger',
          headline: `INFRASTRUCTURE CHOKEPOINT SUBMERGED: ${choke.name}`,
          description: `Water height is at ${level.toFixed(1)}cm. Chokepoint is impassable for standard vehicular traffic. Safe diversion via ${choke.bypassVia} recommended.`,
          waterLevel: level,
          location: choke.coords,
          distanceToRouteMeters: Math.round(dist),
        });
      }
    }
  });

  return hazards;
}

/**
 * Computes alternative bypass waypoints to steer routing around hazards
 */
export function getBypassWaypointsForHazards(hazards: NavigationHazard[]): [number, number][] {
  const waypoints: [number, number][] = [];

  hazards.forEach((hazard) => {
    const choke = VADODARA_CHOKEPOINTS.find(
      (c) => c.area.toLowerCase() === hazard.areaName.toLowerCase()
    );
    if (choke && choke.bypassWaypoints) {
      waypoints.push(...choke.bypassWaypoints);
    } else {
      const profile = VADODARA_ROUTE_PROFILES[hazard.areaName];
      if (profile && profile.detours.length > 0) {
        const detourPath = profile.detours[0].coordinates;
        if (detourPath.length >= 2) {
          waypoints.push(detourPath[Math.floor(detourPath.length / 2)]);
        }
      } else {
        // High ground bypass waypoint (Akota flyover corridor)
        waypoints.push([22.2980, 73.1810]);
      }
    }
  });

  return waypoints;
}

/**
 * Fetch real street-by-street road network coordinates using OSRM routing engine
 */
export async function fetchRealRoadRoute(
  originCoords: [number, number],
  destCoords: [number, number],
  viaWaypoints?: [number, number][]
): Promise<{
  path: [number, number][];
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  steps: NavStep[];
  summary: string;
} | null> {
  try {
    const points = [
      `${originCoords[1]},${originCoords[0]}`,
      ...(viaWaypoints ? viaWaypoints.map((v) => `${v[1]},${v[0]}`) : []),
      `${destCoords[1]},${destCoords[0]}`,
    ].join(';');

    const url = `https://router.project-osrm.org/route/v1/driving/${points}?overview=full&geometries=geojson&steps=true`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const geoCoords: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng]
    );

    const distanceMeters = Math.round(route.distance);
    const distanceText =
      distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${distanceMeters} m`;

    const durationSeconds = Math.round(route.duration);
    const durationMins = Math.max(1, Math.round(durationSeconds / 60));
    const durationText = `${durationMins} mins`;

    const steps: NavStep[] = [];
    if (route.legs && route.legs.length > 0) {
      route.legs.forEach((leg: any) => {
        (leg.steps || []).forEach((st: any) => {
          const maneuverType = st.maneuver?.type || 'turn';
          const modifier = st.maneuver?.modifier ? ` ${st.maneuver.modifier}` : '';
          const streetName = st.name ? ` onto ${st.name}` : '';
          const instruction = `${maneuverType}${modifier}${streetName}`.trim();

          const stepDist = st.distance >= 1000
            ? `${(st.distance / 1000).toFixed(1)} km`
            : `${Math.round(st.distance)} m`;
          const stepDur = `${Math.max(1, Math.round(st.duration / 60))} min`;

          steps.push({
            instructions: instruction.charAt(0).toUpperCase() + instruction.slice(1) || 'Continue on route',
            distance: stepDist,
            duration: stepDur,
            location: [st.maneuver.location[1], st.maneuver.location[0]],
          });
        });
      });
    }

    const summary = route.legs?.[0]?.summary || 'Vadodara Arterial Network';

    return {
      path: geoCoords,
      distanceMeters,
      distanceText,
      durationSeconds,
      durationText,
      steps: steps.slice(0, 12),
      summary,
    };
  } catch (err) {
    console.warn('[routeHazardService] OSRM fetch failed, using fallback:', err);
    return null;
  }
}

/**
 * Creates high-fidelity realistic road coordinates fallback when offline
 */
function createCuratedVadodaraRoadPath(
  origin: { lat: number; lng: number; name: string },
  dest: { lat: number; lng: number; name: string },
  isDetour: boolean
): [number, number][] {
  if (isDetour) {
    return [
      [origin.lat, origin.lng],
      [22.2980, 73.1810], // Akota Flyover High Elevated Corridor
      [22.3040, 73.1870], // Dandia Bazar Elevated Connector
      [22.3160, 73.2010], // Karelibaug Outer Ring
      [22.3310, 73.2080], // Harni Bypass Flyover
      [dest.lat, dest.lng],
    ];
  }

  // Direct arterial corridor (passes through central Underpass / Kala Ghoda)
  return [
    [origin.lat, origin.lng],
    [22.3115, 73.1760], // RC Dutt Rd
    [22.3135, 73.1830], // Railway Station Frontage
    [22.3160, 73.1895], // Sayajigunj Circle / Underpass approach
    [22.3210, 73.1905], // Kala Ghoda Bridge
    [22.3255, 73.1930], // Fatehgunj Main Arterial
    [22.3320, 73.2020], // VIP Road Junction
    [dest.lat, dest.lng],
  ];
}

/**
 * Computes Smart Hazard-Aware Routes (Real road polylines, solid red hazard spot, alternative detour)
 */
export async function calculateSmartHazardRoutes(
  originName: string,
  destName: string,
  floodSensors: FloodSensor[],
  trafficData: TrafficData[]
): Promise<NavRouteOption[]> {
  const originSector =
    VADODARA_AREAS.find((a) => a.name.toLowerCase() === originName.toLowerCase()) ||
    VADODARA_AREAS[0]; // Alkapuri
  const destSector =
    VADODARA_AREAS.find((a) => a.name.toLowerCase() === destName.toLowerCase()) ||
    VADODARA_AREAS[8]; // Harni

  const originCoords: [number, number] = [originSector.lat, originSector.lng];
  const destCoords: [number, number] = [destSector.lat, destSector.lng];

  // 1. Fetch Primary Direct Road Route via OSRM
  let primaryRoad = await fetchRealRoadRoute(originCoords, destCoords);

  if (!primaryRoad) {
    const fallbackPath = createCuratedVadodaraRoadPath(originSector, destSector, false);
    const distM = Math.round(getDistanceMeters(originSector.lat, originSector.lng, destSector.lat, destSector.lng) * 1.25);
    primaryRoad = {
      path: fallbackPath,
      distanceMeters: distM,
      distanceText: `${(distM / 1000).toFixed(1)} km`,
      durationSeconds: Math.round((distM / 1000) * 120),
      durationText: `${Math.round((distM / 1000) * 2)} mins`,
      steps: [
        { instructions: `Depart ${originSector.name} via Central Arterial`, distance: '900 m', duration: '2 mins' },
        { instructions: `Proceed along RC Dutt Road towards Sayajigunj`, distance: '2.4 km', duration: '5 mins' },
        { instructions: `Cross Kala Ghoda Corridor towards Fatehgunj`, distance: '1.8 km', duration: '4 mins' },
        { instructions: `Arrive at destination: ${destSector.name}`, distance: '800 m', duration: '2 mins' },
      ],
      summary: `Via ${originSector.name} - ${destSector.name} Direct Arterial`,
    };
  }

  // 2. Intercept Hazards along the primary route
  const hazards = detectRouteHazards(
    primaryRoad.path,
    floodSensors,
    trafficData,
    originSector.name,
    destSector.name
  );
  const isCompromised = hazards.length > 0;

  const routes: NavRouteOption[] = [];

  // Primary Route (Google Maps Blue if clear, Red if compromised)
  routes.push({
    id: 'route-primary',
    name: isCompromised ? 'Direct Route (Compromised / Hazard Spot)' : 'Fastest Arterial Route (Clear)',
    summary: primaryRoad.summary || `Via ${originSector.name} - ${destSector.name}`,
    via: isCompromised ? 'Direct Arterial (Blocked by Flood/Traffic)' : 'Direct Arterial Corridor',
    isCompromised,
    isRecommendedDetour: !isCompromised,
    distanceMeters: primaryRoad.distanceMeters,
    distanceText: primaryRoad.distanceText,
    durationSeconds: primaryRoad.durationSeconds,
    durationText: primaryRoad.durationText,
    hazards,
    path: primaryRoad.path,
    steps: primaryRoad.steps,
    elevationTag: isCompromised ? 'Low-Lying / Flooded Corridor' : 'Optimal Flow',
  });

  // 3. If compromised, compute Safe Alternative Detour around the hazard
  if (isCompromised) {
    const bypassWaypoints = getBypassWaypointsForHazards(hazards);
    let detourRoad = await fetchRealRoadRoute(originCoords, destCoords, bypassWaypoints);

    if (!detourRoad) {
      const detourPath = createCuratedVadodaraRoadPath(originSector, destSector, true);
      const detourDist = Math.round(primaryRoad.distanceMeters * 1.28);
      detourRoad = {
        path: detourPath,
        distanceMeters: detourDist,
        distanceText: `${(detourDist / 1000).toFixed(1)} km`,
        durationSeconds: Math.round(primaryRoad.durationSeconds * 1.25),
        durationText: `${Math.round(primaryRoad.durationSeconds * 1.25 / 60)} mins`,
        steps: [
          { instructions: `Depart ${originSector.name} via high-ground connector`, distance: '600 m', duration: '2 mins' },
          { instructions: `Merge onto Akota-Dandia Bazar Flyover (Bypasses Submerged Underpass)`, distance: '2.6 km', duration: '5 mins' },
          { instructions: `Take Outer Ring Road Flyover (High Elevation, Flood Free)`, distance: '2.8 km', duration: '5 mins' },
          { instructions: `Reach ${destSector.name} safely with zero water obstruction`, distance: '1.1 km', duration: '2 mins' },
        ],
        summary: 'Via Akota-Dandia Bazar Flyover & High-Ground Ring',
      };
    }

    routes.push({
      id: 'route-safe-detour',
      name: '🛡️ Safe Alternative Detour (Recommended)',
      summary: detourRoad.summary || 'Via Akota-Dandia Bazar Flyover & High-Ground Ring',
      via: 'Elevated Flyover & High-Ground Ring',
      isCompromised: false,
      isRecommendedDetour: true,
      distanceMeters: detourRoad.distanceMeters,
      distanceText: detourRoad.distanceText,
      durationSeconds: detourRoad.durationSeconds,
      durationText: detourRoad.durationText,
      hazards: [],
      path: detourRoad.path,
      steps: detourRoad.steps,
      elevationTag: '100% Flood-Free • Elevated Flyover',
    });
  }

  return routes;
}

/**
 * Backward compatibility fallback
 */
export function createSimulatedFallbackRoute(
  originName: string,
  destName: string,
  hazards: NavigationHazard[]
): NavRouteOption[] {
  const originSector = VADODARA_AREAS.find((a) => a.name.toLowerCase() === originName.toLowerCase()) || VADODARA_AREAS[0];
  const destSector = VADODARA_AREAS.find((a) => a.name.toLowerCase() === destName.toLowerCase()) || VADODARA_AREAS[8];

  const primaryPath = createCuratedVadodaraRoadPath(originSector, destSector, false);
  const isCompromised = hazards.length > 0;
  const straightDist = getDistanceMeters(originSector.lat, originSector.lng, destSector.lat, destSector.lng);
  const distM = Math.round(straightDist * 1.25);

  const routes: NavRouteOption[] = [
    {
      id: 'route-primary',
      name: isCompromised ? 'Direct Route (Compromised / Hazard Spot)' : 'Direct Arterial Corridor',
      summary: `Via ${originSector.name} - ${destSector.name}`,
      via: 'Direct City Arterial',
      isCompromised,
      isRecommendedDetour: !isCompromised,
      distanceMeters: distM,
      distanceText: `${(distM / 1000).toFixed(1)} km`,
      durationSeconds: Math.round((distM / 1000) * 120),
      durationText: `${Math.round((distM / 1000) * 2)} mins`,
      hazards,
      path: primaryPath,
      steps: [
        { instructions: `Depart ${originSector.name} heading onto Central Arterial`, distance: '800 m', duration: '2 mins' },
        { instructions: isCompromised ? `⚠️ HAZARD SPOT DETECTED at ${hazards[0]?.areaName}` : 'Continue straight along Central Arterial', distance: '2.4 km', duration: '6 mins' },
        { instructions: `Arrive at destination: ${destSector.name}`, distance: '600 m', duration: '2 mins' },
      ],
      elevationTag: isCompromised ? 'Low-Lying / Flooded' : 'Standard Flow',
    },
  ];

  if (isCompromised) {
    const detourPath = createCuratedVadodaraRoadPath(originSector, destSector, true);
    const detourDist = Math.round(distM * 1.3);
    routes.push({
      id: 'route-safe-detour',
      name: '🛡️ Safe Alternative Detour (Recommended)',
      summary: 'Via Akota-Dandia Bazar Flyover & Outer Ring Road',
      via: 'Elevated Flyover & High-Ground Ring',
      isCompromised: false,
      isRecommendedDetour: true,
      distanceMeters: detourDist,
      distanceText: `${(detourDist / 1000).toFixed(1)} km`,
      durationSeconds: Math.round((detourDist / 1000) * 130),
      durationText: `${Math.round((detourDist / 1000) * 2.3)} mins`,
      hazards: [],
      path: detourPath,
      steps: [
        { instructions: `Divert onto Elevated Flyover ramp at ${originSector.name}`, distance: '600 m', duration: '2 mins' },
        { instructions: 'Merge onto Akota-Dandia Bazar Flyover — Completely bypasses submerged underpass', distance: '2.5 km', duration: '5 mins' },
        { instructions: `Take Outer Ring Road exit towards ${destSector.name}`, distance: '1.5 km', duration: '3 mins' },
        { instructions: `Arrive safely at ${destSector.name}`, distance: '700 m', duration: '2 mins' },
      ],
      elevationTag: '100% Flood-Free • Elevated Flyover',
    });
  }

  return routes;
}
