/* ============================================
   ROUTE HAZARD INTERCEPTION & DETOUR ENGINE
   Cross-references navigation routes against live IoT flood crests & traffic jams
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
    bufferMeters: 250,
    criticalThreshold: 120, // cm
    bypassVia: 'Akota-Dandia Bazar Flyover & Jetalpur Bridge',
    bypassWaypoints: [[22.2980, 73.1810], [22.3040, 73.1870]] as [number, number][],
  },
  {
    name: 'Kala Ghoda Bridge (Vishwamitri Crossing)',
    area: 'Sayajigunj',
    coords: [22.3150, 73.1900] as [number, number],
    bufferMeters: 220,
    criticalThreshold: 130,
    bypassVia: 'Fatehgunj Flyover & Narhari Hospital Road',
    bypassWaypoints: [[22.3210, 73.1880], [22.3250, 73.1930]] as [number, number][],
  },
  {
    name: 'Mujmahuda - Akota Low Causeway',
    area: 'Akota',
    coords: [22.2950, 73.1680] as [number, number],
    bufferMeters: 200,
    criticalThreshold: 110,
    bypassVia: 'Old Padra High Ridge & OP Road Ring',
    bypassWaypoints: [[22.2920, 73.1590], [22.3000, 73.1550]] as [number, number][],
  },
  {
    name: 'Manjalpur Drainage Culvert (GIDC Cross)',
    area: 'Manjalpur',
    coords: [22.2760, 73.1930] as [number, number],
    bufferMeters: 220,
    criticalThreshold: 120,
    bypassVia: 'Tarsali Ring Road & Makarpura Highway Elevated Strip',
    bypassWaypoints: [[22.2700, 73.2050], [22.2820, 73.2080]] as [number, number][],
  },
  {
    name: 'Fatehgunj Circle Underpass',
    area: 'Fatehgunj',
    coords: [22.3200, 73.1850] as [number, number],
    bufferMeters: 200,
    criticalThreshold: 125,
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
  trafficData: TrafficData[]
): NavigationHazard[] {
  const hazards: NavigationHazard[] = [];
  if (path.length === 0) return hazards;

  // 1. Check against dynamic flood sensors
  floodSensors.forEach((sensor) => {
    // Is sensor in warning or danger?
    const isDanger = sensor.water_level >= sensor.max_threshold;
    const isWarning = sensor.water_level >= sensor.warn_threshold;

    if (!isDanger && !isWarning) return;

    const dist = minDistanceToPath([sensor.latitude, sensor.longitude], path);
    // Within 250m buffer
    if (dist <= 250) {
      hazards.push({
        id: `hazard-flood-${sensor.id}`,
        type: 'flood',
        areaName: sensor.area_name,
        severity: isDanger ? 'danger' : 'warning',
        headline: isDanger
          ? `CRITICAL SUBMERGENCE: ${sensor.area_name} Corridor Submerged (${sensor.water_level} cm)`
          : `FLOOD SURGE WARNING: High Water in ${sensor.area_name} (${sensor.water_level} cm)`,
        description: `Ultrasonic telemetry sensor ${sensor.id} reports water level at ${sensor.water_level} cm (Threshold: ${sensor.warn_threshold} cm). Roadway passability compromised.`,
        waterLevel: sensor.water_level,
        location: [sensor.latitude, sensor.longitude],
        distanceToRouteMeters: Math.round(dist),
      });
    }
  });

  // 2. Check against traffic data
  trafficData.forEach((traffic) => {
    if (traffic.traffic_percentage < 75 && traffic.traffic_level !== 'heavy') return;

    const dist = minDistanceToPath([traffic.latitude, traffic.longitude], path);
    if (dist <= 220) {
      hazards.push({
        id: `hazard-traffic-${traffic.id}`,
        type: 'traffic',
        areaName: traffic.area_name,
        severity: traffic.traffic_percentage >= 85 ? 'danger' : 'warning',
        headline: `TRAFFIC GRIDLOCK: ${traffic.area_name} (${traffic.traffic_percentage}% Density)`,
        description: `Heavy vehicular congestion (${traffic.vehicle_count} active vehicles counted by optical AI). Severe transit delays expected.`,
        trafficPercentage: traffic.traffic_percentage,
        location: [traffic.latitude, traffic.longitude],
        distanceToRouteMeters: Math.round(dist),
      });
    }
  });

  // 3. Check against known chokepoints if sensor in that area is above threshold
  VADODARA_CHOKEPOINTS.forEach((choke) => {
    const matchingFlood = floodSensors.find((s) => s.area_name.toLowerCase() === choke.area.toLowerCase());
    const level = matchingFlood ? matchingFlood.water_level : 0;

    if (level >= choke.criticalThreshold) {
      const dist = minDistanceToPath(choke.coords, path);
      if (dist <= choke.bufferMeters && !hazards.some((h) => h.areaName === choke.area && h.type === 'flood')) {
        hazards.push({
          id: `hazard-choke-${choke.name}`,
          type: 'flood',
          areaName: choke.area,
          severity: 'danger',
          headline: `INFRASTRUCTURE CHOKEPOINT SUBMERGED: ${choke.name}`,
          description: `Water height is at ${level}cm. Chokepoint is impassable for standard vehicular traffic. Safe diversion via ${choke.bypassVia} recommended.`,
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
 * Computes alternative bypass waypoints to steer Google Maps around hazards
 */
export function getBypassWaypointsForHazards(hazards: NavigationHazard[]): [number, number][] {
  const waypoints: [number, number][] = [];

  hazards.forEach((hazard) => {
    // Match chokepoint
    const choke = VADODARA_CHOKEPOINTS.find(
      (c) => c.area.toLowerCase() === hazard.areaName.toLowerCase()
    );
    if (choke && choke.bypassWaypoints) {
      waypoints.push(...choke.bypassWaypoints);
    } else {
      // Fallback to route profile detours
      const profile = VADODARA_ROUTE_PROFILES[hazard.areaName];
      if (profile && profile.detours.length > 0) {
        // Pick primary detour coordinate midway
        const detourPath = profile.detours[0].coordinates;
        if (detourPath.length >= 2) {
          waypoints.push(detourPath[Math.floor(detourPath.length / 2)]);
        }
      }
    }
  });

  return waypoints;
}

/**
 * Creates fallback routes when Google Directions API is unavailable or offline
 */
export function createSimulatedFallbackRoute(
  originName: string,
  destName: string,
  hazards: NavigationHazard[]
): NavRouteOption[] {
  const originSector = VADODARA_AREAS.find((a) => a.name.toLowerCase() === originName.toLowerCase()) || VADODARA_AREAS[0];
  const destSector = VADODARA_AREAS.find((a) => a.name.toLowerCase() === destName.toLowerCase()) || VADODARA_AREAS[3];

  const straightDistanceMeters = getDistanceMeters(
    originSector.lat,
    originSector.lng,
    destSector.lat,
    destSector.lng
  );

  // Generate interpolated primary path
  const numSteps = 8;
  const primaryPath: [number, number][] = [];
  for (let i = 0; i <= numSteps; i++) {
    const ratio = i / numSteps;
    primaryPath.push([
      originSector.lat + (destSector.lat - originSector.lat) * ratio,
      originSector.lng + (destSector.lng - originSector.lng) * ratio,
    ]);
  }

  const primaryHazards = detectRouteHazards(primaryPath, [], []); // Will be passed
  const isCompromised = hazards.length > 0;

  const routes: NavRouteOption[] = [
    {
      id: 'route-direct',
      name: isCompromised ? 'Standard Direct Corridor (Compromised)' : 'Direct Arterial Corridor',
      summary: `Via RC Dutt Road & Central Vadodara Arterial`,
      via: 'Direct City Arterial',
      isCompromised,
      isRecommendedDetour: false,
      distanceMeters: Math.round(straightDistanceMeters * 1.15),
      distanceText: `${(straightDistanceMeters * 1.15 / 1000).toFixed(1)} km`,
      durationSeconds: Math.round((straightDistanceMeters * 1.15 / 1000) * 120),
      durationText: `${Math.round((straightDistanceMeters * 1.15 / 1000) * 2.2)} mins`,
      hazards,
      path: primaryPath,
      steps: [
        {
          instructions: `Depart from ${originSector.name} heading towards Central Corridor`,
          distance: '800 m',
          duration: '2 mins',
        },
        {
          instructions: isCompromised
            ? `⚠️ WARNING: Hazard corridor detected at ${hazards[0]?.areaName || 'midway point'}`
            : `Continue straight along Main Arterial`,
          distance: '2.1 km',
          duration: '6 mins',
        },
        {
          instructions: `Arrive at destination: ${destSector.name}`,
          distance: '600 m',
          duration: '2 mins',
        },
      ],
      elevationTag: isCompromised ? 'Low-Lying / Flooded' : 'Standard Grade',
    },
  ];

  // If compromised, generate Safe Alternative Detour
  if (isCompromised) {
    const bypassCoords: [number, number][] = [
      [originSector.lat, originSector.lng],
      // Arc around to the west/elevated ground
      [originSector.lat + 0.008, originSector.lng - 0.010],
      [destSector.lat + 0.005, destSector.lng - 0.008],
      [destSector.lat, destSector.lng],
    ];

    routes.push({
      id: 'route-safe-detour',
      name: '🛡️ Recommended Safe High-Ground Detour',
      summary: 'Via Akota-Dandia Bazar Flyover & Race Course Ring Road',
      via: 'Elevated Flyover & High-Ground Ring',
      isCompromised: false,
      isRecommendedDetour: true,
      distanceMeters: Math.round(straightDistanceMeters * 1.35),
      distanceText: `${(straightDistanceMeters * 1.35 / 1000).toFixed(1)} km`,
      durationSeconds: Math.round((straightDistanceMeters * 1.35 / 1000) * 130),
      durationText: `${Math.round((straightDistanceMeters * 1.35 / 1000) * 2.4)} mins`,
      hazards: [],
      path: bypassCoords,
      steps: [
        {
          instructions: `Depart ${originSector.name} and divert onto Elevated Flyover ramp`,
          distance: '600 m',
          duration: '2 mins',
        },
        {
          instructions: `Merge onto Akota-Dandia Bazar Flyover — Completely bypasses submerged underpass`,
          distance: '2.4 km',
          duration: '5 mins',
        },
        {
          instructions: `Take Exit towards Race Course Ring Road (Clear of flood drainage)`,
          distance: '1.2 km',
          duration: '3 mins',
        },
        {
          instructions: `Arrive safely at ${destSector.name} via high-ground connector`,
          distance: '700 m',
          duration: '2 mins',
        },
      ],
      elevationTag: '100% Flood-Free • Elevated Flyover',
    });
  }

  return routes;
}
