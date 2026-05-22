/* ============================================
   HEADER COMPONENT
   Top bar with time, system health, connection
   ============================================ */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Wifi, Shield, Activity, Bell, Menu, CloudRain, User, Zap } from 'lucide-react';
import { SystemStatus } from '../types';

interface HeaderProps {
  systemStatus: SystemStatus;
  alertCount: number;
  onToggleSidebar?: () => void;
  isEmergency?: boolean;
  onToggleEmergency?: () => void;
  onToggleWeather?: () => void;
}

export default function Header({ systemStatus, alertCount, onToggleSidebar, isEmergency, onToggleEmergency, onToggleWeather }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <header
      className="h-16 border-b backdrop-blur-2xl flex items-center justify-between px-6 z-50 relative shadow-lg"
      style={{ background: 'var(--t-header-bg)', borderColor: 'var(--t-border)' }}
    >
      {/* Left: Logo & Live */}
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg hover:bg-black/10 transition"
          style={{ color: 'var(--t-text-muted)' }}
        >
          <Menu size={20} />
        </button>
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Shield size={20} className="text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>
              VADODARA <span className="text-cyan-400">SMART CITY</span>
            </h1>
            <p className="text-[9px] font-medium" style={{ color: 'var(--t-text-muted)' }}>Real-time Monitoring</p>
          </div>
        </div>

        {/* Live Indicator */}
        <motion.div
          className="flex items-center gap-2 ml-4 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.12)]"
          animate={{ opacity: [1, 0.7, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-semibold text-emerald-400">LIVE</span>
        </motion.div>
      </div>

      {/* Center: Time */}
      <div className="hidden md:flex flex-col items-center gap-0.5">
        <span className="text-base font-mono font-bold" style={{ color: 'var(--t-text-primary)' }}>
          {formatTime(time)}
        </span>
        <span className="text-[9px]" style={{ color: 'var(--t-text-muted)' }}>{formatDate(time)}</span>
      </div>

      {/* Right: Status & Alerts */}
      <div className="flex items-center gap-2 lg:gap-3">
        {/* Weather */}
        <div 
          onClick={onToggleWeather}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border transition cursor-pointer"
          style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)' }}
        >
          <CloudRain size={14} className="text-blue-400" />
          <span className="text-[10px] font-medium" style={{ color: 'var(--t-text-secondary)' }}>29°C Rainy</span>
        </div>

        {/* Last Sync */}
        <div
          className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full border"
          style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)' }}
        >
          <Activity size={14} className="text-emerald-400" />
          <span className="text-[10px] font-medium" style={{ color: 'var(--t-text-secondary)' }}>Sync: Just now</span>
        </div>

        {/* Emergency Mode Toggle */}
        <button 
          onClick={onToggleEmergency}
          className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full transition shadow-lg group
            ${isEmergency 
              ? 'bg-rose-500/20 border border-rose-500/50 shadow-rose-950/40 animate-pulse' 
              : 'bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 shadow-rose-950/20'
            }`}
        >
          <Zap size={14} className={`text-rose-400 ${!isEmergency && 'group-hover:animate-pulse'}`} />
          <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider">
            {isEmergency ? 'Critical' : 'Emergency'}
          </span>
        </button>

        {/* Connection Status */}
        <div
          className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border transition"
          style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)' }}
        >
          <Wifi size={14} className="text-cyan-400" />
          <span className="text-[10px] font-medium" style={{ color: 'var(--t-text-secondary)' }}>Connected</span>
        </div>

        {/* Alert Bell - Prominent */}
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 rounded-full border transition ml-1"
          style={{ background: 'var(--t-bg-glass)', borderColor: 'var(--t-border)' }}
        >
          <Bell size={18} className={alertCount > 0 ? "text-red-400" : ""} style={alertCount > 0 ? {} : { color: 'var(--t-text-muted)' }} />
          {alertCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center animate-pulse"
            >
              {alertCount}
            </motion.span>
          )}
        </motion.button>

        {/* User Profile */}
        <div className="ml-1 md:ml-2 w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center border-2 border-white/10 shadow-lg shadow-cyan-500/20 cursor-pointer hover:border-cyan-400/50 transition">
          <User size={16} className="text-white" />
        </div>
      </div>
    </header>
  );
}
