import React, { useState } from 'react';
import {
  Grid,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  RotateCcw,
  Film,
  Globe,
} from 'lucide-react';
import { SyntheticVideoOptions } from '../services/browserVideoService';

interface HeaderProps {
  isWasmReady: boolean;
  isWasmLoading: boolean;
  isCrossOriginIsolated: boolean;
  onGenerateSample: (options: SyntheticVideoOptions) => Promise<void>;
  onResetProject: () => void;
  isGeneratingSample: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  isWasmReady,
  isWasmLoading,
  isCrossOriginIsolated,
  onGenerateSample,
  onResetProject,
  isGeneratingSample,
}) => {
  const [showSampleMenu, setShowSampleMenu] = useState(false);

  const samples: { label: string; desc: string; options: SyntheticVideoOptions }[] = [
    {
      label: 'Standard 1080p (1920x1080, 10s)',
      desc: '30fps full HD benchmark with moving orbital clock and SMPTE bars',
      options: { width: 1920, height: 1080, durationSeconds: 10, fps: 30, title: '1080p 30fps Benchmark' },
    },
    {
      label: 'Odd Dimensions (1921x1081, 6s)',
      desc: 'Precision test: non-divisible integer pixel partitioning',
      options: { width: 1921, height: 1081, durationSeconds: 6, fps: 30, title: '1921x1081 Odd Pixel Test' },
    },
    {
      label: 'Fast 720p (1280x720, 5s)',
      desc: 'Rapid splitting & reassembly verification',
      options: { width: 1280, height: 720, durationSeconds: 5, fps: 30, title: '720p Quick Test' },
    },
    {
      label: 'Portrait Video (1080x1920, 6s)',
      desc: '9:16 vertical video matrix slicing',
      options: { width: 1080, height: 1920, durationSeconds: 6, fps: 30, title: 'Portrait 9:16 Matrix' },
    },
  ];

  return (
    <header className="h-14 border-b border-studio-800 bg-studio-900/90 backdrop-blur px-4 flex items-center justify-between z-30 select-none">
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg bg-studio-accent/20 border border-studio-accent/40 flex items-center justify-center text-studio-accent shadow-sm">
          <Grid className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              Video Grid Studio
            </h1>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-studio-800 text-studio-cyan border border-studio-700/50">
              v1.0 Static
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Spatial video splitter & seamless frame-accurate reassembler
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-2.5">
        {/* WASM & Cross-Origin Isolation status */}
        <div className="hidden md:flex items-center space-x-2 text-xs">
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              isWasmReady
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                : isWasmLoading
                ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                : 'bg-studio-800/60 text-slate-400 border-studio-700/60'
            }`}
            title={isWasmReady ? 'FFmpeg.wasm is loaded locally' : 'FFmpeg.wasm initializing'}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{isWasmReady ? 'WASM Ready' : isWasmLoading ? 'WASM Loading...' : 'WASM Standby'}</span>
          </div>

          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium transition-colors ${
              isCrossOriginIsolated
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                : 'bg-studio-800/60 text-amber-400 border-amber-800/40'
            }`}
            title={
              isCrossOriginIsolated
                ? 'Cross-Origin Isolated: Multi-threading enabled'
                : 'Single-threaded mode active (COOP/COEP fallback)'
            }
          >
            {isCrossOriginIsolated ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5" />
            )}
            <span>{isCrossOriginIsolated ? 'Multi-thread' : 'Single-thread'}</span>
          </div>
        </div>

        {/* Generate Synthetic Video Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSampleMenu(!showSampleMenu)}
            disabled={isGeneratingSample}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            <span>{isGeneratingSample ? 'Generating Test Video...' : 'Load Test Video'}</span>
          </button>

          {showSampleMenu && (
            <div
              className="absolute right-0 mt-2 w-80 bg-studio-900 border border-studio-700 rounded-xl shadow-2xl p-2 z-50 text-left"
              onMouseLeave={() => setShowSampleMenu(false)}
            >
              <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-studio-800 mb-1">
                Generate Precision Benchmark Video
              </div>
              {samples.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setShowSampleMenu(false);
                    onGenerateSample(s.options);
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-studio-800 transition flex items-start space-x-2 group"
                >
                  <Film className="w-4 h-4 text-studio-accent mt-0.5 shrink-0 group-hover:scale-110 transition-transform" />
                  <div>
                    <div className="text-xs font-semibold text-white group-hover:text-studio-accent transition-colors">
                      {s.label}
                    </div>
                    <div className="text-[11px] text-slate-400">{s.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset button */}
        <button
          onClick={onResetProject}
          title="Reset current project and clear active session"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition border border-transparent hover:border-studio-700"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* GitHub Pages link */}
        <a
          href="https://github.com"
          target="_blank"
          rel="noreferrer"
          title="Static GitHub Pages Build"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition border border-transparent hover:border-studio-700"
        >
          <Globe className="w-4 h-4" />
        </a>
      </div>
    </header>
  );
};
