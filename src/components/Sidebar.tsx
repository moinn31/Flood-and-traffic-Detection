/* ============================================
   SIDEBAR COMPONENT (Command Navigation)
   ============================================ */

import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import {
  Droplets,
  Car,
  AlertTriangle,
  ChevronRight,
  Activity,
  Globe,
  Play,
  Square,
  Cpu,
  Circle,
  Camera,
  Waves
} from 'lucide-react';
import { VADODARA_AREAS } from '../data';
import { SystemStatus, YoloRuntimeStatus, TrafficData } from '../types';

interface SidebarProps {
  systemStatus: SystemStatus;
  yoloStatus: YoloRuntimeStatus;
  isYoloBusy: boolean;
  selectedTrafficArea: string;
  onTrafficAreaChange: (area: string) => void;
  // headless: when provided, true means no GUI; false opens camera window
  onStartYolo: (area: string, headless?: boolean) => Promise<void>;
  onStopYolo: () => Promise<void>;
  isOpen?: boolean;
  onClose?: () => void;
  trafficData?: TrafficData[];
}

const navItems = [
  { path: '/', icon: Globe, label: 'Command Center', hint: 'Unified city map and controls' },
  { path: '/flood', icon: Droplets, label: 'Flood Monitor', hint: 'Water sensors and risk levels' },
  { path: '/traffic', icon: Car, label: 'Traffic AI', hint: 'Vehicle analytics and congestion' },
  { path: '/yolo', icon: Play, label: 'Traffic AI Service', hint: 'Start/stop live traffic detection' },
  { path: '/alerts', icon: AlertTriangle, label: 'Alert Feed', hint: 'Critical incidents timeline' },
];

export default function Sidebar({
  systemStatus,
  yoloStatus,
  isYoloBusy,
  selectedTrafficArea,
  onTrafficAreaChange,
  onStartYolo,
  onStopYolo,
  isOpen,
  onClose,
  trafficData,
}: SidebarProps) {
  const [showGui, setShowGui] = useState(false);
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 backdrop-blur-sm z-[1001] lg:hidden"
          style={{ background: 'var(--t-overlay)' }}
          onClick={onClose}
        />
      )}

      <aside
        className={`
          w-[360px] h-full border-r flex flex-col
          fixed lg:relative z-[1002] transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        style={{ background: 'var(--t-sidebar-bg)', borderColor: 'var(--t-border)' }}
      >
        {/* Logo Area */}
        <div className="p-6 pb-5 relative" style={{ borderBottom: '1px solid var(--t-border)' }}>
          <div className="rounded-3xl border p-4 shadow-2xl" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-glass)' }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500 flex items-center justify-center shadow-xl shadow-cyan-500/30">
                <Activity size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold tracking-wide uppercase" style={{ color: 'var(--t-text-primary)' }}>Vadodara Grid</h2>
                <p className="text-[10px] text-cyan-500 font-semibold uppercase tracking-[0.22em]">Smart Ops Console</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
              <div className="flex items-center gap-2">
                <Circle size={9} className="text-emerald-400 fill-emerald-400" />
                <span className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider">System Online</span>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--t-text-secondary)' }}>{systemStatus.uptime}</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-5 py-5 space-y-3 overflow-y-auto relative">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-300 group relative border min-h-[64px]
                ${isActive
                  ? 'text-cyan-500 bg-cyan-500/10 border-cyan-400/40 shadow-2xl shadow-cyan-500/15'
                  : 'border-transparent hover:border-cyan-400/30'}`
              }
              style={({ isActive }) => ({
                color: isActive ? undefined : 'var(--t-text-secondary)',
                background: isActive ? undefined : 'transparent',
              })}
            >
              {({ isActive }) => (
                <>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${isActive ? 'bg-cyan-400/15 text-cyan-400' : 'text-current group-hover:bg-cyan-400/10 group-hover:text-cyan-400 group-hover:scale-110'}`} style={isActive ? {} : { background: 'var(--t-bg-glass)' }}>
                    <item.icon size={18} className={`transition-transform duration-300 ${isActive ? 'text-cyan-400' : 'group-hover:text-cyan-400'}`} />
                  </div>
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-[15px] font-bold leading-tight" style={{ color: isActive ? 'var(--t-text-primary)' : undefined }}>{item.label}</div>
                    <div className="text-[11px] truncate mt-0.5" style={{ color: 'var(--t-text-muted)' }}>{item.hint}</div>
                  </div>
                  {isActive && <ChevronRight size={16} className="ml-auto text-cyan-400 shrink-0" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Traffic AI Controls */}
        <div className="px-5 pb-5">
          <div className="rounded-[24px] border p-5 backdrop-blur-xl shadow-2xl" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-surface)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Cpu size={16} className="text-cyan-400" />
                <h3 className="text-[11px] uppercase tracking-[0.18em] font-black" style={{ color: 'var(--t-text-primary)' }}>Traffic AI Engine</h3>
              </div>
              <span className={`text-[10px] font-black tracking-widest ${yoloStatus.running ? 'text-emerald-400' : ''}`} style={yoloStatus.running ? {} : { color: 'var(--t-text-muted)' }}>
                {yoloStatus.running ? 'RUNNING' : 'IDLE'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl border p-2 relative overflow-hidden group transition-colors" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                <div className="text-[9px] uppercase" style={{ color: 'var(--t-text-muted)' }}>Camera Feed</div>
                {yoloStatus.running ? (
                   <div className="w-full h-[40px] mt-1 bg-black rounded-lg overflow-hidden relative">
                     <img src="http://127.0.0.1:9000/stream" alt="Live" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                     <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                   </div>
                ) : (
                  <div className="text-sm font-bold flex items-center gap-1.5 mt-2" style={{ color: 'var(--t-text-primary)' }}>
                    <Camera size={13} style={{ color: 'var(--t-text-muted)' }} /> Offline
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="rounded-xl border p-2 transition-colors" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                  <div className="text-[9px] uppercase" style={{ color: 'var(--t-text-muted)' }}>Area</div>
                  <select
                    value={selectedTrafficArea}
                    onChange={(e) => onTrafficAreaChange(e.target.value)}
                    className="mt-1 w-full rounded-md border px-2 py-1 text-xs font-bold outline-none focus:border-cyan-400"
                    style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-input)', color: 'var(--t-text-primary)' }}
                  >
                    {VADODARA_AREAS.map((area) => (
                      <option key={area.name} value={area.name}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-[10px] text-emerald-400 mt-0.5">{yoloStatus.running ? 'Live Active' : 'Offline'}</div>
                </div>
                <div className="mt-2 px-2">
                  <label className="inline-flex items-center gap-2 text-[11px]" style={{ color: 'var(--t-text-secondary)' }}>
                    <input type="checkbox" checked={showGui} onChange={(e) => setShowGui(e.target.checked)} className="w-4 h-4" />
                    <span className="text-sm">Show Camera Window</span>
                  </label>
                </div>
                <div className="rounded-xl border p-2 transition-colors" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
                  <div className="text-[9px] uppercase" style={{ color: 'var(--t-text-muted)' }}>Detections</div>
                  <div className="text-xs text-cyan-400 font-bold mt-0.5">
                    {yoloStatus.running 
                      ? `${trafficData?.find(t => t.area_name.toLowerCase() === selectedTrafficArea.toLowerCase())?.vehicle_count ?? 0} Vehicles` 
                      : '--'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => onStartYolo(selectedTrafficArea, !showGui)}
                disabled={isYoloBusy || yoloStatus.running}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/90 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-black text-white transition shadow-lg shadow-emerald-500/20"
              >
                <Play size={14} /> Start
              </button>
              <button
                onClick={onStopYolo}
                disabled={isYoloBusy || !yoloStatus.running}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500/90 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 text-sm font-black text-white transition shadow-lg shadow-rose-500/20"
              >
                <Square size={13} /> Stop
              </button>
            </div>
          </div>
        </div>

        {/* Status Footer - Simplified */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-glass)' }}>
          <div className="flex items-center justify-between px-3 py-2 rounded-xl border" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
            <div className="flex items-center gap-2.5">
              <Waves size={14} className="text-blue-400" />
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--t-text-primary)' }}>
                {systemStatus.sensors_online}/{systemStatus.sensors_total} Sensors
              </span>
            </div>
            <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>{systemStatus.system_health}</span>
          </div>
        </div>
      </aside>
    </>
  );
}
