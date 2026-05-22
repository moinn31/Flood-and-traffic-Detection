import { useState, useEffect } from 'react';
import { Play, Square, Camera, Wifi, Cpu } from 'lucide-react';
import type { YoloRuntimeStatus } from '../types';

interface Props {
  yoloStatus: YoloRuntimeStatus;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
}

export default function YoloService({ yoloStatus, onStart, onStop }: Props) {
  const [camera, setCamera] = useState<number>(yoloStatus.camera ?? 0);
  const [area, setArea] = useState<string>(yoloStatus.area ?? 'Alkapuri');
  const [confidence, setConfidence] = useState<number>(yoloStatus.confidence ?? 0.4);

  useEffect(() => {
    setCamera(yoloStatus.camera ?? 0);
    setArea(yoloStatus.area ?? 'Alkapuri');
    setConfidence(yoloStatus.confidence ?? 0.4);
  }, [yoloStatus]);

  return (
    <div className="p-6 h-full overflow-auto">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--t-text-primary)' }}>YOLOv8 Traffic AI Service</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--t-text-muted)' }}>Control the YOLO service running on the host machine. Start/stop the webcam-based detector and view runtime status.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 rounded-lg border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--t-text-muted)' }}>Status</div>
            <div className="mt-2 flex items-center gap-2">
              <Cpu />
              <div>
                <div className="font-semibold" style={{ color: 'var(--t-text-primary)' }}>{yoloStatus.running ? 'Running' : 'Stopped'}</div>
                <div className="text-[11px]" style={{ color: 'var(--t-text-muted)' }}>PID: {yoloStatus.pid ?? '-'} </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--t-text-muted)' }}>Camera</div>
            <div className="mt-2 font-semibold flex items-center gap-2" style={{ color: 'var(--t-text-primary)' }}><Camera /> {camera}</div>
          </div>

          <div className="p-4 rounded-lg border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
            <div className="text-xs uppercase" style={{ color: 'var(--t-text-muted)' }}>Area</div>
            <div className="mt-2 font-semibold" style={{ color: 'var(--t-text-primary)' }}>{area}</div>
          </div>
        </div>

        <div className="p-4 rounded-lg border mb-4" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <label className="text-xs" style={{ color: 'var(--t-text-muted)' }}>Confidence</label>
              <input
                type="range"
                min="0.1"
                max="0.9"
                step="0.05"
                value={confidence}
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="w-full mt-2"
              />
              <div className="text-[12px] mt-1" style={{ color: 'var(--t-text-secondary)' }}>{confidence}</div>
            </div>

            <div className="w-40 flex flex-col gap-2">
              <button onClick={() => onStart?.()} className="inline-flex items-center gap-2 justify-center px-3 py-2 rounded-lg bg-emerald-500 text-xs font-bold">
                <Play /> Start
              </button>
              <button onClick={onStop} className="inline-flex items-center gap-2 justify-center px-3 py-2 rounded-lg bg-rose-500 text-xs font-bold">
                <Square /> Stop
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg border" style={{ background: 'var(--t-bg-elevated)', borderColor: 'var(--t-border)' }}>
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--t-text-primary)' }}>Runtime Command</div>
          <div className="text-xs break-words" style={{ color: 'var(--t-text-muted)' }}>{yoloStatus.command ?? '-'}</div>
        </div>
      </div>
    </div>
  );
}
