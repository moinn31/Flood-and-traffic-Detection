/* ============================================
   ALERTS PAGE — Full alert management
   ============================================ */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Droplets, Car, Clock,
  Filter, CheckCircle, XCircle, Bell
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
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

export default function AlertsPage({ alerts }: AlertsPageProps) {
  const [filter, setFilter] = useState<'all' | 'flood' | 'traffic'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'danger' | 'warning' | 'info'>('all');

  const filtered = alerts.filter(a => {
    if (filter !== 'all' && a.alert_type !== filter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  const dangerCount = alerts.filter(a => a.severity === 'danger').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;
  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 bg-grid">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-amber-600 flex items-center justify-center">
            <Bell size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--t-text-primary)' }}>Alert Center</h1>
            <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>System-wide flood and traffic alerts</p>
          </div>
        </div>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 bg-gradient-to-br from-red-500/10 to-rose-500/10"
        >
          <XCircle size={20} className="text-red-400 mb-2" />
          <div className="text-2xl font-bold font-mono text-red-400">{dangerCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>Critical</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4 bg-gradient-to-br from-amber-500/10 to-yellow-500/10"
        >
          <AlertTriangle size={20} className="text-amber-400 mb-2" />
          <div className="text-2xl font-bold font-mono text-amber-400">{warningCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>Warnings</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10"
        >
          <CheckCircle size={20} className="text-cyan-400 mb-2" />
          <div className="text-2xl font-bold font-mono text-cyan-400">{unreadCount}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--t-text-muted)' }}>Unread</div>
        </motion.div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter size={14} style={{ color: 'var(--t-text-muted)' }} />
          <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Type:</span>
        </div>
        {(['all', 'flood', 'traffic'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === f
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-[#64748b] border hover:text-cyan-400'
            }`}
            style={filter !== f ? { background: 'var(--t-bg-inset)', borderColor: 'var(--t-border)' } : undefined}
          >
            {f === 'all' ? 'All' : f === 'flood' ? '💧 Flood' : '🚗 Traffic'}
          </button>
        ))}

        <div className="w-px h-5 mx-1" style={{ background: 'var(--t-border)' }} />

        <span className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Severity:</span>
        {(['all', 'danger', 'warning', 'info'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              severityFilter === s
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-[#64748b] border hover:text-cyan-400'
            }`}
            style={severityFilter !== s ? { background: 'var(--t-bg-inset)', borderColor: 'var(--t-border)' } : undefined}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((alert, i) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: i * 0.03 }}
              layout
              className={`
                glass-card p-4 flex items-start gap-4 group cursor-pointer
                ${!alert.read ? 'border-l-[3px]' : ''}
              `}
              style={{
                borderLeftColor: !alert.read ? severityColors[alert.severity] : 'transparent',
              }}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${severityColors[alert.severity]}15` }}
              >
                {alert.alert_type === 'flood' ? (
                  <Droplets size={20} style={{ color: severityColors[alert.severity] }} />
                ) : (
                  <Car size={20} style={{ color: severityColors[alert.severity] }} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold" style={{ color: 'var(--t-text-primary)' }}>{alert.area_name}</span>
                  <span className={`badge ${
                    alert.severity === 'danger' ? 'badge-danger' :
                    alert.severity === 'warning' ? 'badge-warning' : 'badge-info'
                  }`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className="badge badge-info ml-1">
                    {alert.alert_type}
                  </span>
                  {!alert.read && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 ml-auto flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--t-text-secondary)' }}>{alert.message}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  <Clock size={11} style={{ color: 'var(--t-text-muted)' }} />
                  <span className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>{timeAgo(alert.created_at)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle size={32} className="mx-auto mb-3 text-green-400/50" />
            <p className="text-sm" style={{ color: 'var(--t-text-muted)' }}>No alerts match the current filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
