-- ============================================
-- VADODARA SMART CITY — Complete Schema
-- Supabase PostgreSQL
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- FLOOD: Current State Table
-- Stores latest flood sensor readings per area
-- ============================================
CREATE TABLE IF NOT EXISTS flood_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sensor_name VARCHAR(100),
    area_name VARCHAR(100) NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL DEFAULT 0,
    longitude DOUBLE PRECISION NOT NULL DEFAULT 0,
    water_level DOUBLE PRECISION DEFAULT 0,
    max_threshold DOUBLE PRECISION DEFAULT 180,
    warn_threshold DOUBLE PRECISION DEFAULT 100,
    status VARCHAR(20) DEFAULT 'online',
    severity VARCHAR(20) DEFAULT 'safe',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TRAFFIC: Current State Table
-- Stores latest aggregated traffic counts per area
-- ============================================
CREATE TABLE IF NOT EXISTS traffic_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_name VARCHAR(100) NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    cars INTEGER DEFAULT 0,
    bikes INTEGER DEFAULT 0,
    trucks INTEGER DEFAULT 0,
    buses INTEGER DEFAULT 0,
    vehicle_count INTEGER DEFAULT 0,
    traffic_level VARCHAR(20) DEFAULT 'low',
    traffic_percentage INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- TRAFFIC HISTORY: Time-series samples
-- Keep historical samples for analytics and alerts
-- ============================================
CREATE TABLE IF NOT EXISTS traffic_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    area_name VARCHAR(100) NOT NULL,
    vehicle_count INTEGER NOT NULL,
    traffic_level VARCHAR(20) NOT NULL,
    traffic_percentage INTEGER DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ALERTS: All alerts (flood + traffic)
-- ============================================
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type VARCHAR(20) NOT NULL DEFAULT 'traffic',
    area_name VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info','warning','danger')),
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_flood_area ON flood_data(area_name);
CREATE INDEX IF NOT EXISTS idx_traffic_area ON traffic_data(area_name);
CREATE INDEX IF NOT EXISTS idx_traffic_history_area ON traffic_history(area_name);
CREATE INDEX IF NOT EXISTS idx_traffic_history_time ON traffic_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);

-- ============================================
-- OPTIONAL: Seed data for common areas (idempotent)
-- ============================================
INSERT INTO traffic_data (area_name, latitude, longitude)
VALUES
    ('Alkapuri', 22.3110, 73.1725),
    ('Akota', 22.2950, 73.1680),
    ('Manjalpur', 22.2760, 73.1930),
    ('Karelibaug', 22.3230, 73.2000),
    ('Waghodia Road', 22.3100, 73.2200),
    ('Fatehgunj', 22.3200, 73.1850),
    ('Sayajigunj', 22.3150, 73.1900),
    ('Gorwa', 22.3300, 73.1600),
    ('Harni', 22.3400, 73.2100),
    ('Gotri', 22.3050, 73.1450)
ON CONFLICT (area_name) DO NOTHING;

-- ============================================
-- Notes:
-- - Apply this file in Supabase SQL editor to create all tables.
-- - The flood_data table was MISSING before — this adds it.
-- - The traffic_data table now includes last_updated column.
-- - Activate realtime for all tables in the Supabase dashboard
--   if you want realtime subscriptions.
-- ============================================
