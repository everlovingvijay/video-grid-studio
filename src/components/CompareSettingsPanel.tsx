import React from 'react';
import {
  SlidersHorizontal,
  Flame,
  Split,
  Columns,
  Activity,
  CheckCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { SeamMetrics } from '../types/video';

interface CompareSettingsPanelProps {
  compareMode: 'slider' | 'side-by-side' | 'difference' | 'heatmap';
  onCompareModeChange: (mode: 'slider' | 'side-by-side' | 'difference' | 'heatmap') => void;
  metrics: SeamMetrics | null;
  onEvaluateMetrics: () => void;
  isEvaluating: boolean;
  hasReconstructedVideo: boolean;
}

export const CompareSettingsPanel: React.FC<CompareSettingsPanelProps> = ({
  compareMode,
  onCompareModeChange,
  metrics,
  onEvaluateMetrics,
  isEvaluating,
  hasReconstructedVideo,
}) => {
  return (
    <div className="w-80 lg:w-96 bg-studio-900 border-l border-studio-800 flex flex-col h-full overflow-y-auto select-none p-4 space-y-5 text-sm shrink-0">
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Precision Verification & Seam Inspector
        </label>
        <p className="text-[11px] text-slate-400">
          Compare decoded frames between source and reassembled grid without claiming byte-level identity.
        </p>
      </div>

      {/* Comparison View Mode Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Inspection Mode
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onCompareModeChange('slider')}
            className={`p-2.5 rounded-xl border text-left transition flex items-center space-x-2 ${
              compareMode === 'slider'
                ? 'bg-studio-accent/20 border-studio-accent text-white shadow'
                : 'bg-studio-800/60 border-studio-700/60 text-slate-400 hover:text-white'
            }`}
          >
            <Split className="w-4 h-4 text-studio-accent shrink-0" />
            <div>
              <div className="text-xs font-bold">Split Slider</div>
              <div className="text-[10px] text-slate-400">Swipe divider</div>
            </div>
          </button>

          <button
            onClick={() => onCompareModeChange('heatmap')}
            className={`p-2.5 rounded-xl border text-left transition flex items-center space-x-2 ${
              compareMode === 'heatmap'
                ? 'bg-studio-accent/20 border-studio-accent text-white shadow'
                : 'bg-studio-800/60 border-studio-700/60 text-slate-400 hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-rose-400 shrink-0" />
            <div>
              <div className="text-xs font-bold">Seam Heatmap</div>
              <div className="text-[10px] text-slate-400">Color error map</div>
            </div>
          </button>
        </div>
      </div>

      {/* Evaluate Metrics Button */}
      <button
        onClick={onEvaluateMetrics}
        disabled={isEvaluating}
        className="w-full py-2.5 rounded-xl bg-studio-800 hover:bg-studio-700 border border-studio-700 text-white font-semibold text-xs transition flex items-center justify-center space-x-2"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : ''}`} />
        <span>{isEvaluating ? 'Analyzing Decoded Frame...' : 'Compute Frame Seam Metrics'}</span>
      </button>

      {/* Objective Quality Metrics Cards */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Objective Quality Metrics</span>
          {metrics && (
            <span className="text-[10px] text-studio-cyan font-mono">
              Frame #{metrics.evaluatedFramesCount}
            </span>
          )}
        </label>

        {metrics ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 bg-studio-800/70 rounded-xl border border-studio-700/50">
              <div className="text-[11px] text-slate-400 mb-0.5">PSNR (dB)</div>
              <div className="text-lg font-mono font-bold text-white">
                {metrics.psnr >= 100 ? '∞ (Lossless)' : `${metrics.psnr.toFixed(1)} dB`}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                {metrics.psnr >= 45 ? 'Imperceptible' : 'Normal lossy encode'}
              </div>
            </div>

            <div className="p-3 bg-studio-800/70 rounded-xl border border-studio-700/50">
              <div className="text-[11px] text-slate-400 mb-0.5">SSIM Index</div>
              <div className="text-lg font-mono font-bold text-emerald-400">
                {metrics.ssim.toFixed(4)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Target: &gt; 0.9800
              </div>
            </div>

            <div className="p-3 bg-studio-800/70 rounded-xl border border-studio-700/50">
              <div className="text-[11px] text-slate-400 mb-0.5">Mean Sq Error</div>
              <div className="text-lg font-mono font-bold text-white">
                {metrics.mse.toFixed(2)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Avg per-channel error
              </div>
            </div>

            <div className="p-3 bg-studio-800/70 rounded-xl border border-studio-700/50">
              <div className="text-[11px] text-slate-400 mb-0.5">Max Pixel Diff</div>
              <div className="text-lg font-mono font-bold text-amber-400">
                {metrics.maxPixelDiff} <span className="text-[10px] text-slate-400">/ 255</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Peak boundary delta
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-studio-800/40 rounded-xl border border-studio-700/40 text-center text-xs text-slate-400">
            Click "Compute Frame Seam Metrics" to evaluate live decoded frames at the current timestamp.
          </div>
        )}
      </div>

      {/* Heatmap Legend */}
      <div className="p-3 bg-studio-800/50 rounded-xl border border-studio-700/50 space-y-2 text-xs">
        <div className="font-bold text-slate-300">Heatmap Color Legend</div>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-slate-900 border border-slate-700 shrink-0" />
            <span className="text-slate-300">Deep Navy: Exact 0 pixel difference (Lossless)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-cyan-400 shrink-0" />
            <span className="text-slate-300">Cyan: Low quantization loss (&lt; 8/255)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
            <span className="text-slate-300">Amber: Moderate compression delta (8-30)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
            <span className="text-slate-300">Red: Boundary shift / chroma misalignment (&gt; 30)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
