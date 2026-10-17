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

