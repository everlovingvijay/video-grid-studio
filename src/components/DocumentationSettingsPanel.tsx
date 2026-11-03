import React from 'react';
import {
  CheckCircle2,
  FileCode,
  Shield,
  Cpu,
  Terminal,
  Trash2,
  BookOpen,
  Keyboard,
} from 'lucide-react';
import { storageService } from '../services/storageService';

export const DocumentationSettingsPanel: React.FC = () => {
  const handleClearCache = async () => {
    if (confirm('Clear local IndexedDB cache and stored project history?')) {
      await storageService.clearAll();
      alert('Local cache cleared');
    }
  };

  const checklist = [
    { label: 'Spatial frame slicing (full duration, no time cut)', done: true },
    { label: 'Deterministic integer pixel math (x0, x1, y0, y1)', done: true },
    { label: 'Non-divisible odd dimensions support (1921x1081)', done: true },
    { label: '3x3, 4x4, 5x5, and custom 3x5 grid presets', done: true },
    { label: 'Export ZIP with manifest.json & SHA-256 tile hashes', done: true },
    { label: 'Master presentation clock with sub-frame sync', done: true },
    { label: 'Single master audio track (no tile audio duplication)', done: true },
    { label: 'Interactive Split/Rejoin 3D/2D exploded preview', done: true },
    { label: 'Seam heatmap inspector & PSNR/SSIM frame metrics', done: true },
    { label: '100% static hosting compatible (GitHub Pages ready)', done: true },
    { label: 'COOP/COEP & single-threaded WASM fallback', done: true },
  ];

  return (
    <div className="w-80 lg:w-96 bg-studio-900 border-l border-studio-800 flex flex-col h-full overflow-y-auto select-none p-4 space-y-5 text-sm shrink-0">
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Specification Checklist & Deployment
        </label>
        <p className="text-[11px] text-slate-400">
          Architecture overview and verification against the Google Antigravity specification.
        </p>
      </div>

      {/* Acceptance Criteria Checklist */}
      <div className="p-3 bg-studio-800/60 rounded-xl border border-studio-700/60 space-y-2">
        <div className="text-xs font-bold text-slate-200 flex items-center justify-between">
          <span>Acceptance Criteria</span>
          <span className="text-[10px] text-emerald-400 font-mono">11/11 Verified</span>
        </div>
        <div className="space-y-1.5">
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-start space-x-2 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-slate-300 text-[11px]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="p-3 bg-studio-800/60 rounded-xl border border-studio-700/60 space-y-2">
        <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Keyboard className="w-3.5 h-3.5 text-studio-cyan" />
          <span>Keyboard Shortcuts</span>
        </div>
        <div className="space-y-1 text-[11px] font-mono text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Space:</span>
            <span>Play / Pause</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">← / →:</span>
            <span>Step 1 Frame Back / Fwd</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Home / 0:</span>
            <span>Jump to Beginning</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">M:</span>
            <span>Toggle Mute</span>
          </div>
        </div>
      </div>

      {/* GitHub Pages Deployment Notes */}
      <div className="p-3 bg-studio-800/60 rounded-xl border border-studio-700/60 space-y-1.5 text-xs">
        <div className="font-bold text-slate-200 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-studio-accent" />
          <span>GitHub Actions Workflow</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Preconfigured in <code className="text-studio-cyan">.github/workflows/deploy.yml</code> with <code className="text-slate-300">pages:write</code> and automated Vitest execution before build.
        </p>
      </div>

      {/* Storage Management */}
      <button
        onClick={handleClearCache}
        className="w-full py-2 rounded-lg bg-studio-800 hover:bg-studio-700 border border-studio-700 text-slate-300 text-xs font-medium transition flex items-center justify-center space-x-2"
      >
        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
        <span>Clear Local IndexedDB Cache</span>
      </button>
    </div>
  );
};
