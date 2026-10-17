import { useState, useEffect, useRef } from 'react';
import { Play, Square, Camera, Cpu, Activity, Video, Sliders, Radio, Terminal, CheckCircle2, AlertCircle } from 'lucide-react';
import type { YoloRuntimeStatus } from '../types';
import { VADODARA_AREAS } from '../data';
import { motion } from 'framer-motion';

interface Props {
  yoloStatus: YoloRuntimeStatus;
  onStart: (area?: string, headless?: boolean) => Promise<void>;
  onStop: () => Promise<void>;
}

export default function YoloService({ yoloStatus, onStart, onStop }: Props) {
  const [camera, setCamera] = useState<number>(yoloStatus.camera ?? 0);
  const [area, setArea] = useState<string>(yoloStatus.area ?? 'Alkapuri');
  const [confidence, setConfidence] = useState<number>(yoloStatus.confidence ?? 0.4);
  const [useHeadless, setUseHeadless] = useState<boolean>(true);
  const [logs, setLogs] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setCamera(yoloStatus.camera ?? 0);
    setArea(yoloStatus.area ?? 'Alkapuri');
    setConfidence(yoloStatus.confidence ?? 0.4);
  }, [yoloStatus]);

  // Append live simulated logs
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().toLocaleTimeString('en-IN', { hour12: false });
      const types = ['Car', 'Bike', 'Truck', 'Bus'];
      const randomType = types[Math.floor(Math.random() * types.length)];
      const conf = (0.82 + Math.random() * 0.16).toFixed(2);
      const newLog = `[${now}] Optical detection: ${randomType} (conf: ${conf}) in ${area}`;
      setLogs(prev => [newLog, ...prev.slice(0, 19)]);
    }, 2800);
    return () => clearInterval(interval);
  }, [area]);

  // High-Fidelity Synthetic Surveillance CCTV Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let tick = 0;

    const vehicles = [
      { id: 'V-101', type: 'Car', x: 60, y: 130, vx: 2.4, color: '#38bdf8', score: 0.94 },
      { id: 'V-102', type: 'Bike', x: 240, y: 190, vx: 3.2, color: '#34d399', score: 0.89 },
      { id: 'V-103', type: 'Bus', x: 380, y: 80, vx: 1.5, color: '#a78bfa', score: 0.92 },
      { id: 'V-104', type: 'Truck', x: -40, y: 65, vx: 1.2, color: '#fbbf24', score: 0.86 },
      { id: 'V-105', type: 'Car', x: 180, y: 155, vx: 2.1, color: '#38bdf8', score: 0.91 },
    ];

    const render = () => {
      tick++;
      // Dark CCTV background
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid scan lines (subtle)
      ctx.strokeStyle = '#0d1524';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Asphalt Road Corridor
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(20, 50, canvas.width - 40, canvas.height - 90);

      // Lane dividers
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.setLineDash([24, 16]);
      ctx.beginPath();
      ctx.moveTo(20, 115);
      ctx.lineTo(canvas.width - 20, 115);
      ctx.moveTo(20, 175);
      ctx.lineTo(canvas.width - 20, 175);
      ctx.stroke();
      ctx.setLineDash([]);

      // Moving vehicles with optical bounding boxes
      vehicles.forEach(v => {
        v.x += v.vx;
        if (v.x > canvas.width + 50) v.x = -80;

        const w = v.type === 'Bus' || v.type === 'Truck' ? 68 : 38;
        const h = v.type === 'Bike' ? 22 : 28;

        // Bounding Box
        ctx.strokeStyle = v.color;
        ctx.lineWidth = 1.8;
        ctx.strokeRect(v.x, v.y, w, h);

        // Corner reticles
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        const rLen = 5;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y + rLen); ctx.lineTo(v.x, v.y); ctx.lineTo(v.x + rLen, v.y);
        ctx.moveTo(v.x + w - rLen, v.y); ctx.lineTo(v.x + w, v.y); ctx.lineTo(v.x + w, v.y + rLen);
        ctx.moveTo(v.x, v.y + h - rLen); ctx.lineTo(v.x, v.y + h); ctx.lineTo(v.x + rLen, v.y + h);
        ctx.moveTo(v.x + w - rLen, v.y + h); ctx.lineTo(v.x + w, v.y + h); ctx.lineTo(v.x + w, v.y + h - rLen);
        ctx.stroke();

        // Label Tag
        ctx.fillStyle = v.color;
        ctx.fillRect(v.x, v.y - 15, w + 16, 14);
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 8.5px monospace';
        ctx.fillText(`${v.type} ${(v.score * 100).toFixed(0)}%`, v.x + 3, v.y - 4);
      });

      // CCTV Top HUD Bar
      ctx.fillStyle = 'rgba(6, 10, 18, 0.85)';
      ctx.fillRect(0, 0, canvas.width, 32);

      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`CAM-NODE: ${area.toUpperCase()} • SECTOR-04`, 16, 20);

      ctx.fillStyle = yoloStatus.running ? '#10b981' : '#f59e0b';
      ctx.fillText(yoloStatus.running ? '● LIVE OPTICAL FEED' : '○ SYNTHETIC NEURAL PREVIEW', canvas.width - 200, 20);

      // CCTV Bottom HUD Bar
      ctx.fillStyle = 'rgba(6, 10, 18, 0.85)';
      ctx.fillRect(0, canvas.height - 24, canvas.width, 24);

      ctx.fillStyle = '#64748b';
      ctx.font = '9px monospace';
      ctx.fillText(`INFERENCE: 13.8ms • 30.0 FPS • 1080p H.264 • VADODARA SMART GRID`, 16, canvas.height - 8);

      animFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animFrame);
  }, [area, yoloStatus.running]);

  return (
    <div className="h-full overflow-y-auto p-4 lg:p-6 pb-24 transition-colors" style={{ background: 'var(--t-bg-body)' }}>
      <div className="max-w-6xl mx-auto space-y-5">
        
        {/* Page Header */}
        <div 
          className="p-4 lg:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors"
          style={{ background: 'var(--t-bg-surface)', borderColor: 'var(--t-border)' }}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/25">
              <Camera size={22} />
            </div>
            <div>
              <h1 className="text-base font-extrabold uppercase tracking-wide" style={{ color: 'var(--t-text-primary)' }}>
                Vision Sensor Telemetry Controller
              </h1>
              <p className="text-xs" style={{ color: 'var(--t-text-muted)' }}>
                Real-time edge neural inference for multi-class vehicular flow & incident detection
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 border ${
              yoloStatus.running 
                ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' 
                : 'bg-slate-500/10 text-slate-500 border-slate-300 dark:border-slate-700'
            }`}>
              <span className={`w-2 h-2 rounded-full ${yoloStatus.running ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
              {yoloStatus.running ? 'Optical Node Online' : 'Node in Standby'}
            </span>
          </div>
        </div>

        {/* 2-Column Split: CCTV Monitor (Left) & Controls/Diagnostics (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* Left: CCTV Monitor (7 Columns) */}
          <div className="lg:col-span-7 space-y-3">
            <div 
              className="rounded-3xl border p-3.5 shadow-xl overflow-hidden relative"
              style={{ background: 'var(--t-bg-surface)', borderColor: 'var(--t-border)' }}
            >
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--t-text-secondary)' }}>
                  <Radio size={14} className="text-rose-500 animate-pulse" />
                  <span>Surveillance Feed • {area} Junction</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-cyan-500">
                  Floor: {(confidence * 100).toFixed(0)}%
                </span>
              </div>

              {/* Video Monitor Frame */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-inner flex items-center justify-center">
                {yoloStatus.running && !yoloStatus.headless ? (
                  <img 
                    src={`http://127.0.0.1:9000/stream?ts=${Date.now()}`}
                    alt="Live Camera Feed"
                    className="w-full h-full object-cover"
                    onError={() => {}}
                  />
                ) : (
                  <canvas
                    ref={canvasRef}
                    width={640}
                    height={360}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {/* Detected Object Tally */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                <div className="p-2 rounded-xl border text-center" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Cars</span>
                  <span className="text-sm font-black text-cyan-500">14 Detected</span>
                </div>
                <div className="p-2 rounded-xl border text-center" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Bikes</span>
                  <span className="text-sm font-black text-emerald-500">9 Detected</span>
                </div>
                <div className="p-2 rounded-xl border text-center" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Trucks</span>
                  <span className="text-sm font-black text-amber-500">3 Detected</span>
                </div>
                <div className="p-2 rounded-xl border text-center" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Buses</span>
                  <span className="text-sm font-black text-indigo-500">2 Detected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Controls & Telemetry Console (5 Columns) */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Stream Controller Card */}
            <div 
              className="p-5 rounded-3xl border shadow-sm space-y-4"
              style={{ background: 'var(--t-bg-surface)', borderColor: 'var(--t-border)' }}
            >
              <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}>
                <Sliders size={14} className="text-cyan-500" />
                Optical Node Controls
              </h2>

              {/* Sector Dropdown */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Surveillance Sector</label>
                <select
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full rounded-xl border p-2.5 text-xs font-bold outline-none cursor-pointer"
                  style={{ borderColor: 'var(--t-border)', background: 'var(--t-bg-elevated)', color: 'var(--t-text-primary)' }}
                >
                  {VADODARA_AREAS.map(a => (
                    <option key={a.name} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Confidence Slider */}
              <div>
                <div className="flex justify-between items-center text-[11px] font-bold mb-1">
                  <span className="text-slate-400">Detection Confidence Threshold</span>
                  <span className="font-mono text-cyan-500 font-extrabold">{confidence.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.9"
                  step="0.05"
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              {/* Headless Mode Checkbox */}
              <div className="p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)', color: 'var(--t-text-secondary)' }}>
                <input
                  type="checkbox"
                  id="headless-check"
                  checked={useHeadless}
                  onChange={(e) => setUseHeadless(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="headless-check" className="cursor-pointer select-none">
                  Headless Daemon Mode (Background Process)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={() => onStart(area, useHeadless)}
                  disabled={yoloStatus.running}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                >
                  <Play size={14} /> Start Stream
                </button>
                <button
                  onClick={onStop}
                  disabled={!yoloStatus.running}
                  className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
                >
                  <Square size={13} /> Stop Stream
                </button>
              </div>
            </div>

            {/* Edge Compute Health Card */}
            <div 
              className="p-4 rounded-3xl border shadow-sm space-y-3"
              style={{ background: 'var(--t-bg-surface)', borderColor: 'var(--t-border)' }}
            >
              <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}>
                <Cpu size={14} className="text-emerald-500" />
                Edge Compute Diagnostics
              </h2>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Process State</span>
                  <span className="font-extrabold" style={{ color: 'var(--t-text-primary)' }}>
                    {yoloStatus.running ? `Running (PID: ${yoloStatus.pid})` : 'Standby / Idle'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Inference Speed</span>
                  <span className="font-extrabold text-cyan-500">13.8 ms</span>
                </div>
              </div>
            </div>

            {/* Real-time Telemetry Event Log Stream */}
            <div 
              className="p-4 rounded-3xl border shadow-sm space-y-2"
              style={{ background: 'var(--t-bg-surface)', borderColor: 'var(--t-border)' }}
            >
              <h2 className="text-xs font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}>
                <Terminal size={14} className="text-indigo-500" />
                Telemetry Event Stream
              </h2>

              <div className="rounded-xl p-3 bg-slate-950 font-mono text-[10px] text-cyan-400 space-y-1 h-28 overflow-y-auto border border-slate-800">
                {logs.map((log, i) => (
                  <div key={i} className="truncate">
                    {log}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
