/* ============================================
   TOAST NOTIFICATION SYSTEM
   Modern minimal toasts for alerts
   ============================================ */

import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Droplets, Car, X, Info } from 'lucide-react';

interface Toast {
  id: string;
  type: 'danger' | 'warning' | 'info';
  category: 'flood' | 'traffic' | 'system';
  title: string;
  message: string;
}

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev.slice(-4), { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Auto-remove after 5 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 5000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const getIcon = (category: string, type: string) => {
    const color = type === 'danger' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#06b6d4';
    if (category === 'flood') return <Droplets size={18} style={{ color }} />;
    if (category === 'traffic') return <Car size={18} style={{ color }} />;
    return <Info size={18} style={{ color }} />;
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`toast ${toast.type}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(toast.category, toast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-white">{toast.title}</div>
                <div className="text-[11px] text-[#94a3b8] mt-0.5 leading-relaxed">
                  {toast.message}
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 p-1 rounded-lg hover:bg-[rgba(255,255,255,0.05)] text-[#64748b] hover:text-white transition"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
