/* ============================================
   HEADER COMPONENT — Enterprise Command Edition
   ============================================ */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Wifi, Shield, Activity, Bell, Menu, CloudRain, CloudSun, Cloud, CloudLightning,
  Zap, Sun, Moon, PanelRightClose, PanelRight, Sparkles 
} from 'lucide-react';
import { SystemStatus } from '../types';

interface HeaderProps {
  systemStatus: SystemStatus;
  alertCount: number;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onToggleSidebar?: () => void;
  isEmergency?: boolean;
  onToggleEmergency?: () => void;
  onToggleWeather?: () => void;
  rightPanelOpen?: boolean;
  onToggleRightPanel?: () => void;
}

export default function Header({ 
  systemStatus, 
  alertCount, 
  theme,
  onToggleTheme,
  onToggleSidebar, 
  isEmergency, 
  onToggleEmergency, 
  onToggleWeather,
  rightPanelOpen = true,
  onToggleRightPanel,
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const navigate = useNavigate();

  // Live Meteorological Weather State
  const [weather, setWeather] = useState({
    city: 'Vadodara',
    temperature: 34,
    humidity: 38,
    condition: 'Clear',
    icon: 'sun',
    precipitation: 0.0,
    wind_speed: 5.2,
  });
  const [weatherHovered, setWeatherHovered] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/weather').catch(() =>
          fetch('https://api.open-meteo.com/v1/forecast?latitude=22.3072&longitude=73.1812&current=temperature_2m,relative_humidity_2m,weather_code,precipitation,wind_speed_10m')
        );
        if (res && res.ok) {
          const data = await res.json();
          if (data.city) {
            setWeather(data);
          } else if (data.current) {
            const curr = data.current;
            const code = curr.weather_code || 0;
            let cond = "Clear";
            let icon = "sun";
            if (code === 1 || code === 2) { cond = "Partly Cloudy"; icon = "cloud-sun"; }
            else if (code === 3) { cond = "Overcast"; icon = "cloud"; }
            else if (code >= 51 && code <= 82) { cond = "Monsoon Rain"; icon = "cloud-rain"; }
            else if (code >= 95) { cond = "Thunderstorm"; icon = "cloud-lightning"; }
            setWeather({
              city: "Vadodara",
              temperature: Math.round(curr.temperature_2m || 34),
              humidity: curr.relative_humidity_2m || 38,
              condition: cond,
              icon: icon,
              precipitation: curr.precipitation || 0,
              wind_speed: curr.wind_speed_10m || 5.2,
            });
          }
        }
      } catch (err) {
        // retain previous state
      }
    };

    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 300000); // Refresh every 5 minutes
    return () => clearInterval(weatherTimer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <header
      className="h-16 border-b backdrop-blur-2xl flex items-center justify-between px-4 lg:px-6 z-50 relative shrink-0 shadow-sm transition-colors duration-300"
      style={{ background: 'var(--t-header-bg)', borderColor: 'var(--t-border)' }}
    >
      {/* Left: Brand & Mobile Nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl border hover:bg-black/5 transition"
          style={{ borderColor: 'var(--t-border)', color: 'var(--t-text-muted)' }}
          title="Toggle Menu"
        >
          <Menu size={18} />
        </button>
        
        <div 
          onClick={() => navigate('/')} 
          className="flex items-center gap-2.5 cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Shield size={19} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-tight uppercase" style={{ color: 'var(--t-text-primary)' }}>
                Vadodara <span className="text-cyan-500">Smart City</span>
              </h1>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[10px] font-medium hidden sm:block" style={{ color: 'var(--t-text-muted)' }}>
              Integrated IoT Flood & Traffic Command Console
            </p>
          </div>
        </div>
      </div>

      {/* Center: Live Clock & Sync Health */}
      <div className="hidden md:flex items-center gap-4">
        <div className="flex flex-col items-center">
          <span className="text-sm font-mono font-bold tracking-tight" style={{ color: 'var(--t-text-primary)' }}>
            {formatTime(time)}
          </span>
          <span className="text-[9px] uppercase font-semibold" style={{ color: 'var(--t-text-muted)' }}>
            {formatDate(time)} • IST
          </span>
        </div>

        <div className="h-5 w-px" style={{ background: 'var(--t-border)' }} />

        <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--t-text-secondary)' }}>
          <Activity size={13} className="text-cyan-400 animate-pulse" />
          <span className="text-[11px]">{systemStatus.sensors_online}/{systemStatus.sensors_total} Nodes Synced</span>
        </div>
      </div>

      {/* Right: Actions, Theme Toggle, Emergency & Alerts */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Live Weather Badge & Tooltip */}
        <div className="relative">
          <div 
            onClick={onToggleWeather}
            onMouseEnter={() => setWeatherHovered(true)}
            onMouseLeave={() => setWeatherHovered(false)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition cursor-pointer hover:border-cyan-400/50 shadow-sm"
            style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)', color: 'var(--t-text-primary)' }}
            title={`Live Vadodara Weather: ${weather.temperature}°C, ${weather.condition}`}
          >
            {weather.icon === 'sun' ? (
              <Sun size={13} className="text-amber-500 animate-spin-slow" />
            ) : weather.icon === 'cloud-sun' ? (
              <CloudSun size={13} className="text-amber-400" />
            ) : weather.icon === 'cloud' ? (
              <Cloud size={13} className="text-slate-400" />
            ) : weather.icon === 'cloud-lightning' ? (
              <CloudLightning size={13} className="text-purple-400 animate-pulse" />
            ) : (
              <CloudRain size={13} className="text-blue-400" />
            )}
            <span className="font-bold">{weather.temperature}°C</span>
            <span className="hidden lg:inline text-[10px]" style={{ color: 'var(--t-text-secondary)' }}>
              {weather.condition}
            </span>
          </div>

          {/* Interactive Live Weather Tooltip */}
          {weatherHovered && (
            <div 
              className="absolute top-full mt-2 right-0 z-[1000] p-2.5 rounded-xl border shadow-xl text-xs min-w-[210px] backdrop-blur-xl"
              style={{
                background: 'var(--t-bg-surface)',
                borderColor: 'var(--t-border)',
                color: 'var(--t-text-primary)',
                boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
              }}
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b" style={{ borderColor: 'var(--t-border)' }}>
                <span className="font-extrabold text-[11px] text-cyan-600 dark:text-cyan-400">
                  📍 Vadodara, Gujarat
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  Live Feed
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--t-text-muted)' }}>Status:</span>
                  <span className="font-semibold">{weather.condition}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--t-text-muted)' }}>Humidity:</span>
                  <span className="font-semibold">{weather.humidity}%</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--t-text-muted)' }}>Wind Speed:</span>
                  <span className="font-semibold">{weather.wind_speed} km/h</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--t-text-muted)' }}>Precipitation:</span>
                  <span className="font-semibold">{weather.precipitation} mm</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PROPER DARK & LIGHT THEME TOGGLE */}
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
          style={{ 
            background: 'var(--t-bg-elevated)', 
            borderColor: 'var(--t-border)', 
            color: 'var(--t-text-primary)' 
          }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={14} className="text-amber-400 animate-spin-slow" />
              <span className="text-[11px] uppercase tracking-wider font-extrabold hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={14} className="text-indigo-600" />
              <span className="text-[11px] uppercase tracking-wider font-extrabold hidden sm:inline">Dark Mode</span>
            </>
          )}
        </button>

        {/* Emergency Mode Toggle */}
        <button 
          onClick={onToggleEmergency}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all shadow-sm active:scale-95 text-xs font-bold cursor-pointer
            ${isEmergency 
              ? 'bg-rose-500/25 border-rose-500 text-rose-400 animate-pulse shadow-rose-950/40' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20'
            }`}
          title="Toggle City Emergency Siren State"
        >
          <Zap size={13} className={isEmergency ? 'animate-bounce' : ''} />
          <span className="text-[11px] uppercase tracking-wider font-extrabold hidden sm:inline">
            {isEmergency ? 'Emergency Active' : 'Siren'}
          </span>
        </button>

        {/* Alert Bell */}
        <motion.button
          onClick={() => navigate('/alerts')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 rounded-xl border transition cursor-pointer"
          style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}
          title="Incident Alerts Center"
        >
          <Bell size={16} className={alertCount > 0 ? "text-rose-500" : ""} style={alertCount > 0 ? {} : { color: 'var(--t-text-muted)' }} />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[8px] font-extrabold flex items-center justify-center animate-pulse shadow-md">
              {alertCount}
            </span>
          )}
        </motion.button>

        {/* Right Panel Toggle Button */}
        {onToggleRightPanel && (
          <button
            onClick={onToggleRightPanel}
            className="p-2 rounded-xl border transition cursor-pointer hidden md:flex items-center justify-center"
            style={{ 
              background: rightPanelOpen ? 'var(--t-bg-elevated)' : 'transparent', 
              borderColor: 'var(--t-border)',
              color: rightPanelOpen ? 'var(--t-text-primary)' : 'var(--t-text-muted)'
            }}
            title={rightPanelOpen ? 'Hide Right Telemetry Panel' : 'Show Right Telemetry Panel'}
          >
            {rightPanelOpen ? <PanelRightClose size={16} /> : <PanelRight size={16} />}
          </button>
        )}
      </div>
    </header>
  );
}
