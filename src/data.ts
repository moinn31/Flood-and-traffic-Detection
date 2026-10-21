/* ============================================
   SIMULATED DATA FOR VADODARA SMART CITY
   Realistic sensor locations across key areas
   ============================================ */

import { FloodSensor, TrafficData, Alert, SystemStatus, WaterLevelHistory, TrafficHistory } from './types';

// Vadodara key locations with real coordinates
export const VADODARA_CENTER = { lat: 22.3072, lng: 73.1812 };
export const MAP_ZOOM = 13;

export const VADODARA_AREAS = [
  { name: 'Alkapuri',       lat: 22.3110, lng: 73.1725 },
  { name: 'Akota',          lat: 22.2950, lng: 73.1680 },
  { name: 'Manjalpur',      lat: 22.2760, lng: 73.1930 },
  { name: 'Karelibaug',     lat: 22.3230, lng: 73.2000 },
  { name: 'Waghodia Road',  lat: 22.3100, lng: 73.2200 },
  { name: 'Fatehgunj',      lat: 22.3200, lng: 73.1850 },
  { name: 'Sayajigunj',     lat: 22.3150, lng: 73.1900 },
  { name: 'Gorwa',          lat: 22.3300, lng: 73.1600 },
  { name: 'Harni',          lat: 22.3400, lng: 73.2100 },
  { name: 'Gotri',          lat: 22.3050, lng: 73.1450 },
  { name: 'Subhanpura',     lat: 22.3200, lng: 73.1600 },
];

// ========== FLOOD SENSOR DATA ==========

export const computeFloodSeverity = (
  level: number,
  warn: number = 100,
  max: number = 180,
  explicitSeverity?: string
): 'safe' | 'warning' | 'danger' => {
  const raw = (explicitSeverity || '').toLowerCase().trim();
  if (raw === 'danger' || raw === 'critical') return 'danger';
  if (raw === 'warning' || raw === 'warn') return 'warning';
  if (raw === 'safe' || raw === 'normal') return 'safe';

  // Inverted Ultrasonic Distance Mode (max < warn, e.g. 7cm max threshold, 15cm warn threshold)
  // Smaller distance to sensor means water has risen close to bridge/road level
  if (max < warn) {
    if (level <= max) return 'danger';
    if (level <= warn) return 'warning';
    return 'safe';
  }

  // Standard Water Depth Mode (e.g. 100cm warn, 180cm max)
  if (level >= max) return 'danger';
  if (level >= warn) return 'warning';
  return 'safe';
};

const floodSeverity = computeFloodSeverity;

export const generateFloodSensors = (): FloodSensor[] => {
  return VADODARA_AREAS.map((area, i) => {
    const waterLevel = 0; // Initialize to 0 as requested
    const warnThreshold = 100;
    const maxThreshold = 180;
    return {
      id: `FS-${String(i + 1).padStart(3, '0')}`,
      sensor_name: `Sensor ${area.name}`,
      area_name: area.name,
      latitude: area.lat + (Math.random() * 0.003 - 0.0015),
      longitude: area.lng + (Math.random() * 0.003 - 0.0015),
      water_level: waterLevel,
      max_threshold: maxThreshold,
      warn_threshold: warnThreshold,
      status: Math.random() > 0.1 ? 'online' : 'offline',
      severity: 'safe',
      last_updated: new Date().toISOString(),
    };
  });
};


// ========== TRAFFIC DATA ==========

const trafficLevel = (pct: number): 'low' | 'medium' | 'heavy' => {
  if (pct >= 75) return 'heavy';
  if (pct >= 40) return 'medium';
  return 'low';
};

export const generateTrafficData = (): TrafficData[] => {
  const baseVehicles = [45, 120, 80, 200, 60, 35, 150, 90, 110, 55];
  
  return VADODARA_AREAS.map((area, i) => {
    const cars = baseVehicles[i] + Math.floor(Math.random() * 30);
    const bikes = Math.floor(cars * 0.6 + Math.random() * 20);
    const trucks = Math.floor(cars * 0.15 + Math.random() * 5);
    const buses = Math.floor(Math.random() * 8 + 2);
    const total = cars + bikes + trucks + buses;
    const pct = Math.min(100, Math.floor((total / 350) * 100));
    return {
      id: `TR-${String(i + 1).padStart(3, '0')}`,
      area_name: area.name,
      latitude: area.lat + 0.002,
      longitude: area.lng + 0.002,
      cars,
      bikes,
      trucks,
      buses,
      vehicle_count: total,
      traffic_level: trafficLevel(pct),
      traffic_percentage: pct,
      last_updated: new Date(Date.now() - Math.floor(Math.random() * 60000)).toISOString(),
    };
  });
};

// ========== ALERTS ==========

export const generateAlerts = (): Alert[] => {
  const alerts: Alert[] = [
    {
      id: 'ALT-001',
      alert_type: 'flood',
      area_name: 'Karelibaug',
      severity: 'danger',
      message: 'Water level critical at 210cm — Evacuation advisory issued',
      created_at: new Date(Date.now() - 120000).toISOString(),
      read: false,
    },
    {
      id: 'ALT-002',
      alert_type: 'flood',
      area_name: 'Sayajigunj',
      severity: 'warning',
      message: 'Water level rising rapidly — Currently at 160cm',
      created_at: new Date(Date.now() - 300000).toISOString(),
      read: false,
    },
    {
      id: 'ALT-003',
      alert_type: 'traffic',
      area_name: 'Karelibaug',
      severity: 'danger',
      message: 'Severe traffic congestion — 230+ vehicles detected by AI',
      created_at: new Date(Date.now() - 180000).toISOString(),
      read: false,
    },
    {
      id: 'ALT-004',
      alert_type: 'traffic',
      area_name: 'Sayajigunj',
      severity: 'warning',
      message: 'Traffic building up — 150 vehicles in zone',
      created_at: new Date(Date.now() - 400000).toISOString(),
      read: true,
    },
    {
      id: 'ALT-005',
      alert_type: 'flood',
      area_name: 'Akota',
      severity: 'warning',
      message: 'Sensor FS-002 detected water level at 120cm',
      created_at: new Date(Date.now() - 600000).toISOString(),
      read: true,
    },
    {
      id: 'ALT-006',
      alert_type: 'flood',
      area_name: 'Manjalpur',
      severity: 'info',
      message: 'Water level stable at 85cm — Monitoring active',
      created_at: new Date(Date.now() - 900000).toISOString(),
      read: true,
    },
    {
      id: 'ALT-007',
      alert_type: 'traffic',
      area_name: 'Harni',
      severity: 'warning',
      message: 'Traffic density increasing — AI detected 110 vehicles',
      created_at: new Date(Date.now() - 500000).toISOString(),
      read: false,
    },
  ];
  return alerts;
};

// ========== SYSTEM STATUS ==========

export const generateSystemStatus = (): SystemStatus => ({
  sensors_online: 8 + Math.floor(Math.random() * 2),
  sensors_total: 10,
  active_alerts: 3 + Math.floor(Math.random() * 2),
  traffic_cameras: 6 + Math.floor(Math.random() * 2),
  system_health: 'operational',
  uptime: '99.7%',
});

// ========== WATER LEVEL HISTORY ==========

export const generateWaterLevelHistory = (sensorId: string): WaterLevelHistory[] => {
  const now = Date.now();
  const points: WaterLevelHistory[] = [];
  let level = 40 + Math.random() * 60;
  
  for (let i = 23; i >= 0; i--) {
    level += Math.random() * 30 - 12;
    level = Math.max(10, Math.min(250, level));
    points.push({
      timestamp: new Date(now - i * 3600000).toISOString(),
      level: Math.round(level),
      sensor_id: sensorId,
    });
  }
  return points;
};

// ========== TRAFFIC HISTORY ==========

export const generateTrafficHistory = (area: string): TrafficHistory[] => {
  const now = Date.now();
  const points: TrafficHistory[] = [];
  
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now - i * 3600000).getHours();
    // Simulate traffic patterns - higher during peak hours
    let base = 30;
    if (hour >= 8 && hour <= 10) base = 150;
    else if (hour >= 17 && hour <= 20) base = 180;
    else if (hour >= 11 && hour <= 16) base = 100;
    else if (hour >= 6 && hour <= 7) base = 70;
    
    points.push({
      timestamp: new Date(now - i * 3600000).toISOString(),
      vehicles: base + Math.floor(Math.random() * 40 - 20),
      area,
    });
  }
  return points;
};
