/* ============================================
   HEADER COMPONENT — Enterprise Command Edition
   ============================================ */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Wifi, Shield, Activity, Bell, Menu, CloudRain, 
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
        {/* Weather Badge */}
        <div 
          onClick={onToggleWeather}
          className="hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition cursor-pointer hover:border-cyan-400/40"
          style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' }}
          title="Weather Forecast"
        >
          <CloudRain size={13} className="text-blue-400" />
          <span>29°C Monsoon</span>
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
