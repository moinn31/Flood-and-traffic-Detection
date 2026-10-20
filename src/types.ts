/* ============================================
   TYPE DEFINITIONS
   ============================================ */

export interface FloodSensor {
  id: string;
  sensor_name: string;
  area_name: string;
  latitude: number;
  longitude: number;
  water_level: number;       // in cm
  max_threshold: number;     // danger threshold
  warn_threshold: number;    // warning threshold
  status: 'online' | 'offline';
  severity: 'safe' | 'warning' | 'danger';
  last_updated: string;
}

export interface TrafficData {
  id: string;
  area_name: string;
  latitude: number;
  longitude: number;
  cars: number;
  bikes: number;
  trucks: number;
  buses: number;
  vehicle_count: number;
  traffic_level: 'low' | 'medium' | 'heavy';
  traffic_percentage: number;
  last_updated: string;
}

export interface Alert {
  id: string;
  alert_type: 'flood' | 'traffic';
  area_name: string;
  severity: 'info' | 'warning' | 'danger';
  message: string;
  created_at: string;
  read: boolean;
}

export interface SystemStatus {
  sensors_online: number;
  sensors_total: number;
  active_alerts: number;
  traffic_cameras: number;
  system_health: 'operational' | 'degraded' | 'critical';
  uptime: string;
}

export interface WaterLevelHistory {
  timestamp: string;
  level: number;
  sensor_id: string;
}

export interface TrafficHistory {
  timestamp: string;
  vehicles: number;
  area: string;
}

export interface YoloRuntimeStatus {
  running: boolean;
  pid: number | null;
  area: string | null;
  camera: number | null;
  confidence: number | null;
  started_at: string | null;
  command: string | null;
  headless?: boolean;
}

export interface IoTTelemetryPayload {
  device_id?: string;
  area_name: string;
  water_level?: number;
  cars?: number;
  bikes?: number;
  trucks?: number;
  buses?: number;
  vehicle_count?: number;
  traffic_percentage?: number;
  status?: string;
  battery_pct?: number;
}

export interface DetourRoute {
  id: string;
  name: string;
  via: string;
  distanceDelta: string;
  timeEstimate: string;
  elevation: string;
  status: 'recommended' | 'alternative' | 'emergency-only';
  instructions: string[];
  coordinates: [number, number][];
}



export interface NavigationHazard {
  id: string;
  type: 'flood' | 'traffic';
  areaName: string;
  severity: 'warning' | 'danger';
  headline: string;
  description: string;
  waterLevel?: number;
  trafficPercentage?: number;
  location: [number, number];
  distanceToRouteMeters: number;
}

export interface NavStep {
  instructions: string;
  distance: string;
  duration: string;
  maneuver?: string;
  location?: [number, number];
}

export interface NavRouteOption {
  id: string;
  name: string;
  summary: string;
  via: string;
  isCompromised: boolean;
  isRecommendedDetour: boolean;
  distanceMeters: number;
  distanceText: string;
  durationSeconds: number;
  durationText: string;
  hazards: NavigationHazard[];
  path: [number, number][]; // [lat, lng] array
  steps: NavStep[];
  elevationTag?: string;
}

export interface RoutePlanningState {
  origin: string;
  destination: string;
  originCoords?: [number, number];
  destCoords?: [number, number];
  travelMode: 'DRIVING' | 'TRANSIT' | 'BICYCLING' | 'WALKING';
  routes: NavRouteOption[];
  selectedRouteId: string | null;
  activeHazards: NavigationHazard[];
  loading: boolean;
  error?: string | null;
}
