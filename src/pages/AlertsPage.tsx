/* ============================================
   ALERTS PAGE — High-Density Emergency Incident Registry
   ============================================ */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Droplets, Car, Clock,
  Filter, CheckCircle, XCircle, Bell, Search,
  Download, Trash2, ShieldAlert, PhoneCall, Radio, Send
} from 'lucide-react';
import { Alert } from '../types';

interface AlertsPageProps {
  alerts: Alert[];
}

const severityColors: Record<string, string> = {
  danger: '#ef4444',
  warning: '#f59e0b',
  info: '#06b6d4',
};

const timeAgo = (iso: string) => {
  if (!iso) return 'Just now';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

export default function AlertsPage({ alerts }: AlertsPageProps) {
  const [filter, setFilter] = useState<'all' | 'flood' | 'traffic' | 'system'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'danger' | 'warning' | 'info'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = alerts.filter(a => {
    if (filter !== 'all' && a.alert_type !== filter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return a.area_name.toLowerCase().includes(q) || a.message.toLowerCase().includes(q);
    }
    return true;
  });

  const dangerCount = alerts.filter(a => a.severity === 'danger').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const infoCount = alerts.filter(a => (a.severity as string) === 'info' || (a.severity as string) === 'safe').length;

  const exportAlerts = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["ID,Type,Severity,Area,Message,Timestamp"].join(",") + "\n"
      + alerts.map(a => `"${a.id}","${a.alert_type}","${a.severity}","${a.area_name}","${a.message.replace(/"/g, '""')}","${a.created_at}"`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vadodara_incident_log_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full overflow-y-auto bg-grid px-4 py-4 lg:px-6">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4">
        {/* Header & Controls */}
        <div className="glass-card flex flex-col justify-between gap-4 p-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-amber-600 shadow-md shadow-rose-500/20">
              <Bell size={22} className="text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-lg font-bold" style={{ color: 'var(--t-text-primary)' }}>
                  Emergency Incident Registry
                </h1>
                <span className="shrink-0 inline-flex items-center whitespace-nowrap rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  {alerts.length} Total Incidents
                </span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: 'var(--t-text-secondary)' }}>
                System-wide audit trail of hydrodynamic surges, severe traffic choke-points, and sensor threshold alerts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportAlerts}
              className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:border-cyan-400"
              style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-primary)' }}
            >
              <Download size={14} className="text-cyan-500" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={async () => {
                try {
                  await fetch('/api/alerts/clear', { method: 'POST' }).catch(() => fetch('http://127.0.0.1:8000/api/alerts/clear', { method: 'POST' }));
                } catch (e) {
                  console.error(e);
                }
              }}
              disabled={alerts.length === 0}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 transition hover:bg-rose-500/25 disabled:opacity-40"
            >
              <Trash2 size={14} />
              <span>Clear Log ({alerts.length})</span>
            </button>
          </div>
        </div>

        {/* Compact Summary KPI Strip (Guaranteed Spacing, Zero Clipping) */}
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-rose-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Critical Incidents</div>
              <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 my-1 leading-none">{dangerCount}</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>Immediate response required</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
              <XCircle size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Active Warnings</div>
              <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400 my-1 leading-none">{warningCount}</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>High water & traffic density</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <AlertTriangle size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-cyan-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Informational / Safe</div>
              <div className="text-2xl font-bold font-mono text-cyan-600 dark:text-cyan-400 my-1 leading-none">{infoCount}</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>System status & nominal resets</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
              <CheckCircle size={22} />
            </div>
          </div>

          <div className="glass-card flex items-center gap-3.5 p-4 min-h-[92px]">
            <div className="w-1.5 self-stretch rounded-full bg-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-bold leading-tight" style={{ color: 'var(--t-text-muted)' }}>Grid Response Time</div>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 my-1 leading-none">14 ms</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: 'var(--t-text-secondary)' }}>Real-time telemetry latency</div>
            </div>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <Radio size={22} />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="glass-card flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2 flex-1 min-w-[260px]">
            <div 
              className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2 w-full max-w-md transition focus-within:border-cyan-400"
              style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-input)' }}
            >
              <Search size={16} className="text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by area, zone or message..."
                className="w-full bg-transparent text-xs outline-none"
                style={{ color: 'var(--t-text-primary)' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-200">
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Type filters */}
            <div className="flex items-center gap-1.5 rounded-xl border p-1" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
              {(['all', 'flood', 'traffic', 'system'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    filter === t
                      ? 'bg-cyan-500 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {t === 'all' ? 'All Types' : t}
                </button>
              ))}
            </div>

            {/* Severity filters */}
            <div className="flex items-center gap-1.5 rounded-xl border p-1" style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)' }}>
              {(['all', 'danger', 'warning', 'info'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    severityFilter === s
                      ? s === 'danger'
                        ? 'bg-rose-500 text-white'
                        : s === 'warning'
                        ? 'bg-amber-500 text-white'
                        : s === 'info'
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-700 text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {s === 'all' ? 'All Severity' : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2-Column Work Surface */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          {/* Main Feed: Incident Event Logs */}
          <div className="glass-card flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>
                Live Incident Stream ({filtered.length})
              </h2>
              <span className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Chronological Order</span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[580px] pr-1">
              {filtered.length === 0 ? (
                <div className="py-16 text-center">
                  <ShieldAlert size={36} className="mx-auto mb-2 text-slate-400" />
                  <p className="text-sm font-semibold" style={{ color: 'var(--t-text-primary)' }}>No incidents match your filters</p>
                  <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Try resetting your search query or severity filter.</p>
                </div>
              ) : (
                filtered.map((alert) => {
                  const isDanger = alert.severity === 'danger';
                  const isWarning = alert.severity === 'warning';
                  const borderLeft = isDanger ? 'border-l-rose-500' : isWarning ? 'border-l-amber-500' : 'border-l-cyan-500';

                  const badgeClass = isDanger
                    ? 'border-red-500/30 bg-red-500/15 text-red-600 dark:text-red-400'
                    : isWarning
                    ? 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'border-cyan-500/30 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400';

                  const iconColor = isDanger ? 'text-rose-500' : isWarning ? 'text-amber-500' : 'text-cyan-500';

                  return (
                    <div
                      key={alert.id}
                      className={`flex flex-col gap-2 rounded-xl border border-l-4 p-3 transition hover:shadow-sm ${borderLeft}`}
                      style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-glass)' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {alert.alert_type === 'flood' ? (
                            <Droplets size={16} className={iconColor} />
                          ) : alert.alert_type === 'traffic' ? (
                            <Car size={16} className={iconColor} />
                          ) : (
                            <AlertTriangle size={16} className={iconColor} />
                          )}
                          <span className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>
                            {alert.area_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${badgeClass}`}>
                            {alert.severity}
                          </span>
                          <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400" style={{ borderColor: 'var(--t-border)' }}>
                            {alert.alert_type}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed" style={{ color: 'var(--t-text-secondary)' }}>
                        {alert.message}
                      </p>

                      <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: 'var(--t-text-muted)' }}>
                        <span>Incident #{alert.id.slice(0, 8)}</span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {timeAgo(alert.created_at)} ({new Date(alert.created_at).toLocaleTimeString()})
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Sidebar: Emergency Dispatch & Protocol Console */}
          <div className="space-y-4">
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert size={18} className="text-rose-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-primary)' }}>
                  Rapid Response Protocols
                </h3>
              </div>

              <p className="text-xs mb-4" style={{ color: 'var(--t-text-secondary)' }}>
                Automated protocols dispatched upon critical hydrodynamic and vehicular threshold breaches.
              </p>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-elevated)' }}>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>NDRF Vadodara Division</div>
                    <div className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Flood evacuation team</div>
                  </div>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">STANDBY</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-elevated)' }}>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>VMC Traffic Command</div>
                    <div className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Signal override & bypass</div>
                  </div>
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">LINKED</span>
                </div>

                <div className="flex items-center justify-between rounded-xl border p-2.5 text-xs" style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-elevated)' }}>
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>SMS Broadcast Gateway</div>
                    <div className="text-[10px]" style={{ color: 'var(--t-text-muted)' }}>Civil warning network</div>
                  </div>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">READY</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--t-border-subtle)' }}>
                <div className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: 'var(--t-text-primary)' }}>
                  <PhoneCall size={14} className="text-emerald-500" />
                  <span>Control Center Hotlines</span>
                </div>
                <div className="text-[11px] space-y-1 font-mono" style={{ color: 'var(--t-text-secondary)' }}>
                  <div>Vadodara Police: <strong>112 / 0265-2415111</strong></div>
                  <div>Fire & Flood Rescue: <strong>101 / 0265-2422222</strong></div>
                  <div>VMC Disaster Cell: <strong>0265-2424101</strong></div>
                </div>
              </div>
            </div>

            {/* Broadcast simulation card */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Radio size={16} className="text-amber-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-primary)' }}>
                  Citizen Advisory Alert
                </h3>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--t-text-secondary)' }}>
                Broadcast emergency alerts directly to digital signboards across Vadodara.
              </p>
              <div className="rounded-xl border p-2.5 text-xs font-mono" style={{ borderColor: 'var(--t-border-subtle)', background: 'var(--t-bg-inset)', color: 'var(--t-text-secondary)' }}>
                [VMC VMS-NET] {dangerCount > 0 ? `WARNING: High water level detected in ${alerts.find(a => a.severity === 'danger')?.area_name || 'Karelibaug'}. Divert via Ring Road.` : 'ALL CLEAR: Traffic and river levels are nominal across all 11 city zones.'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
