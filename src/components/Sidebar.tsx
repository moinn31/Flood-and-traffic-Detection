/* ============================================
   SIDEBAR COMPONENT — Sleek Enterprise Navigation
   ============================================ */

import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import {
  Droplets,
  Car,
  AlertTriangle,
  Globe,
  Radio,
  Circle,
  Database,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Server
} from 'lucide-react';
import { SystemStatus, TrafficData } from '../types';

interface SidebarProps {
  systemStatus: SystemStatus;
  isOpen?: boolean;
  onClose?: () => void;
  trafficData?: TrafficData[];
}

const navItems = [
  { path: '/', icon: Globe, label: 'Command Center', hint: 'Unified Situational Map' },
  { path: '/flood', icon: Droplets, label: 'Flood Monitor', hint: 'Hydrodynamic Sensors' },
  { path: '/traffic', icon: Car, label: 'Traffic AI', hint: 'Flow & Congestion Telemetry' },
  { path: '/vision-sensor', icon: Radio, label: 'Vision Sensor Node', hint: 'Optical Camera Controller' },
  { path: '/alerts', icon: AlertTriangle, label: 'Alert Registry', hint: 'Emergency Incident Feed' },
];

export default function Sidebar({
  systemStatus,
  isOpen,
  onClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-[1001] lg:hidden"
          style={{ background: 'var(--t-overlay)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`
          h-full border-r flex flex-col justify-between shrink-0
          fixed lg:relative z-[1002] transition-all duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          ${collapsed ? 'w-[72px]' : 'w-[250px]'}
        `}
        style={{ background: 'var(--t-sidebar-bg)', borderColor: 'var(--t-border)' }}
      >
        {/* Top: Header Section & Collapse Trigger */}
        <div>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--t-border)' }}>
            {!collapsed ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Server size={16} />
                </div>
                <div>
                  <h2 className="text-xs font-black tracking-wide uppercase" style={{ color: 'var(--t-text-primary)' }}>
                    Operations
                  </h2>
                  <p className="text-[10px] font-semibold text-cyan-500 uppercase tracking-widest">
                    Vadodara Grid
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 mx-auto rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Server size={16} />
              </div>
            )}

            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex p-1.5 rounded-lg border hover:bg-black/5 transition text-slate-400 hover:text-white"
              style={{ borderColor: 'var(--t-border)' }}
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group relative
                  ${isActive 
                    ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-sm shadow-cyan-500/10' 
                    : 'hover:bg-black/5 hover:text-cyan-400 border border-transparent'
                  }
                `}
                style={({ isActive }) => isActive ? {} : { color: 'var(--t-text-secondary)' }}
                title={collapsed ? item.label : undefined}
              >
                <item.icon size={17} className="shrink-0 transition-transform group-hover:scale-110" />
                
                {!collapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="truncate leading-snug">{item.label}</span>
                    <span className="text-[9px] font-medium truncate opacity-60" style={{ color: 'var(--t-text-muted)' }}>
                      {item.hint}
                    </span>
                  </div>
                )}

                {/* Collapsed Tooltip on Hover */}
                {collapsed && (
                  <div className="absolute left-16 px-2.5 py-1 rounded-md bg-slate-900 text-white text-[10px] font-bold shadow-xl border border-slate-700 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                    {item.label}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom: Node Health Card */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--t-border)' }}>
          {!collapsed ? (
            <div className="p-3 rounded-2xl border space-y-2 text-xs" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] text-emerald-500 tracking-wider">
                  <Circle size={7} className="fill-emerald-400 text-emerald-400 animate-ping" />
                  Grid Operational
                </div>
                <span className="text-[10px] font-mono text-slate-400">{systemStatus.uptime}</span>
              </div>

              <div className="space-y-1 text-[11px]" style={{ color: 'var(--t-text-secondary)' }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Droplets size={11} className="text-cyan-400" /> Sensors:</span>
                  <span className="font-extrabold" style={{ color: 'var(--t-text-primary)' }}>{systemStatus.sensors_online}/{systemStatus.sensors_total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Database size={11} className="text-indigo-400" /> Storage:</span>
                  <span className="font-semibold text-emerald-400">Local SQLite</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5"><Radio size={11} className="text-amber-400" /> Edge AI:</span>
                  <span className="font-semibold text-cyan-400">14ms Latency</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-2">
              <span title="System Online"><Circle size={8} className="fill-emerald-400 text-emerald-400" /></span>
              <span title="Security Active"><ShieldCheck size={16} className="text-cyan-400" /></span>
            </div>

          )}
        </div>
      </aside>
    </>
  );
}
