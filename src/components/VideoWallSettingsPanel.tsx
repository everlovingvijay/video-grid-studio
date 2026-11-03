import React, { useState } from 'react';
import {
  Tv,
  Sliders,
  Palette,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Plus,
  RefreshCw,
  Layers,
  Sparkles,
} from 'lucide-react';
import { TileBoundary, TileAdjustment, VideoWallConfig } from '../types/video';

interface VideoWallSettingsPanelProps {
  tiles: TileBoundary[];
  wallConfig: VideoWallConfig;
  onWallConfigChange: (config: VideoWallConfig) => void;
  tileAdjustments: Map<number, TileAdjustment>;
  onTileAdjustmentChange: (tileIndex: number, adj: TileAdjustment) => void;
}

export const VideoWallSettingsPanel: React.FC<VideoWallSettingsPanelProps> = ({
  tiles,
  wallConfig,
  onWallConfigChange,
  tileAdjustments,
  onTileAdjustmentChange,
}) => {
  const [selectedTileIndex, setSelectedTileIndex] = useState<number>(0);

  const currentAdj: TileAdjustment = tileAdjustments.get(selectedTileIndex) || {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    rotation: 0,
    flipH: false,
    flipV: false,
  };

  const updateAdj = (partial: Partial<TileAdjustment>) => {
    onTileAdjustmentChange(selectedTileIndex, {
      ...currentAdj,
      ...partial,
    });
  };

  return (
    <div className="w-80 lg:w-96 bg-studio-900 border-l border-studio-800 flex flex-col h-full overflow-y-auto select-none p-4 space-y-5 text-sm shrink-0">
      <div className="space-y-1">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Video Wall Matrix & Bezel Setup
        </label>
        <p className="text-[11px] text-slate-400">
          Configure physical multi-screen video walls, bezel gaps, test patterns, and per-tile calibration.
        </p>
      </div>

      {/* 1. Calibration Pattern Overlays */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Calibration Pattern Overlay
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() =>
              onWallConfigChange({
                ...wallConfig,
                showCalibrationPattern: !wallConfig.showCalibrationPattern,
              })
            }
            className={`p-2.5 rounded-xl border text-left transition ${
              wallConfig.showCalibrationPattern
                ? 'bg-studio-accent/20 border-studio-accent text-white shadow'
                : 'bg-studio-800/60 border-studio-700/60 text-slate-400 hover:text-white'
            }`}
          >
            <Palette className="w-4 h-4 text-studio-cyan mb-1" />
            <div className="text-xs font-bold">Calibration Bars</div>
            <div className="text-[10px] text-slate-400">SMPTE test bars</div>
          </button>

          <button
            onClick={() =>
              onWallConfigChange({
                ...wallConfig,
                showTileLabels: !wallConfig.showTileLabels,
              })
            }
            className={`p-2.5 rounded-xl border text-left transition ${
              wallConfig.showTileLabels
                ? 'bg-studio-accent/20 border-studio-accent text-white shadow'
                : 'bg-studio-800/60 border-studio-700/60 text-slate-400 hover:text-white'
            }`}
          >
            <Tv className="w-4 h-4 text-amber-400 mb-1" />
            <div className="text-xs font-bold">Display Matrix</div>
            <div className="text-[10px] text-slate-400">Show screen IDs</div>
          </button>
        </div>
      </div>

      {/* 2. Independent Tile Adjustment Selector */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Per-Tile Image Tuning</span>
          <span className="text-[10px] text-studio-cyan font-mono">
            {tiles.length} screens
          </span>
        </label>

        {/* Tile selector drop */}
        <select
          value={selectedTileIndex}
          onChange={(e) => setSelectedTileIndex(parseInt(e.target.value, 10))}
          className="w-full bg-studio-800 border border-studio-700 rounded-lg p-2 text-white font-mono text-xs focus:outline-none focus:border-studio-accent"
        >
          {tiles.map((t) => (
            <option key={t.index} value={t.index}>
              Tile R{t.row + 1}:C{t.col + 1} ({t.filename} - {t.width}x{t.height})
            </option>
          ))}
        </select>

        {/* Sliders for Brightness, Contrast, Saturation */}
        <div className="p-3 bg-studio-800/50 rounded-xl border border-studio-700/50 space-y-3 text-xs">
          {/* Brightness */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>Brightness</span>
              <span className="font-mono text-studio-cyan">{currentAdj.brightness > 0 ? `+${currentAdj.brightness}` : currentAdj.brightness}%</span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={currentAdj.brightness}
              onChange={(e) => updateAdj({ brightness: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-studio-900 rounded-lg appearance-none cursor-pointer accent-studio-cyan"
            />
          </div>

          {/* Contrast */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>Contrast</span>
              <span className="font-mono text-studio-cyan">{currentAdj.contrast > 0 ? `+${currentAdj.contrast}` : currentAdj.contrast}%</span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={currentAdj.contrast}
              onChange={(e) => updateAdj({ contrast: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-studio-900 rounded-lg appearance-none cursor-pointer accent-studio-cyan"
            />
          </div>

          {/* Saturation */}
          <div className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>Saturation</span>
              <span className="font-mono text-studio-cyan">{currentAdj.saturation > 0 ? `+${currentAdj.saturation}` : currentAdj.saturation}%</span>
            </div>
            <input
              type="range"
              min={-50}
              max={50}
              value={currentAdj.saturation}
              onChange={(e) => updateAdj({ saturation: parseInt(e.target.value, 10) })}
              className="w-full h-1.5 bg-studio-900 rounded-lg appearance-none cursor-pointer accent-studio-cyan"
            />
          </div>

          {/* Flip / Rotation Buttons */}
          <div className="flex items-center space-x-2 pt-1 border-t border-studio-700/50">
            <button
              onClick={() => updateAdj({ flipH: !currentAdj.flipH })}
              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1 transition ${
                currentAdj.flipH
                  ? 'bg-studio-accent text-white border-studio-accent'
                  : 'bg-studio-900 border-studio-700 text-slate-400 hover:text-white'
              }`}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              <span>Flip H</span>
            </button>

            <button
              onClick={() => updateAdj({ flipV: !currentAdj.flipV })}
              className={`flex-1 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center space-x-1 transition ${
                currentAdj.flipV
                  ? 'bg-studio-accent text-white border-studio-accent'
                  : 'bg-studio-900 border-studio-700 text-slate-400 hover:text-white'
              }`}
            >
              <FlipVertical className="w-3.5 h-3.5" />
              <span>Flip V</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
