import React, { useRef } from 'react';
import {
  Upload,
  Scissors,
  Download,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Music,
  Zap,
  Award,
  Crown,
  XCircle,
  Clock,
  Film,
} from 'lucide-react';
import {
  VideoMetadata,
  GridConfig,
  GridPreset,
  QualityMode,
  TileProcessingItem,
  ProjectManifest,
} from '../types/video';

interface SplitSettingsPanelProps {
  sourceFile: File | Blob | null;
  metadata: VideoMetadata | null;
  onFileUpload: (file: File) => void;
  gridConfig: GridConfig;
  onGridConfigChange: (config: GridConfig) => void;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  isSplitting: boolean;
  splitProgress: number;
  currentTileMessage: string;
  onStartSplit: () => void;
  onCancelSplit: () => void;
  tileItems: TileProcessingItem[];
  manifest: ProjectManifest | null;
  onDownloadTile: (tile: TileProcessingItem) => void;
  onDownloadAllZip: () => void;
  isDownloadingZip: boolean;
}

export const SplitSettingsPanel: React.FC<SplitSettingsPanelProps> = ({
  sourceFile,
  metadata,
  onFileUpload,
  gridConfig,
  onGridConfigChange,
  qualityMode,
  onQualityModeChange,
  isSplitting,
  splitProgress,
  currentTileMessage,
  onStartSplit,
  onCancelSplit,
  tileItems,
  manifest,
  onDownloadTile,
  onDownloadAllZip,
  isDownloadingZip,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets: { id: GridPreset; label: string; rows: number; cols: number }[] = [
    { id: '2x2', label: '2×2 (4)', rows: 2, cols: 2 },
    { id: '3x3', label: '3×3 (9)', rows: 3, cols: 3 },
    { id: '4x4', label: '4×4 (16)', rows: 4, cols: 4 },
    { id: '5x5', label: '5×5 (25)', rows: 5, cols: 5 },
    { id: '3x5', label: '3×5 (15)', rows: 3, cols: 5 },
    { id: 'custom', label: 'Custom', rows: gridConfig.rows, cols: gridConfig.cols },
  ];

  const handlePresetSelect = (preset: GridPreset, r: number, c: number) => {
    onGridConfigChange({
      ...gridConfig,
      preset,
      rows: r,
      cols: c,
    });
  };

  const handleCustomRowCol = (rows: number, cols: number) => {
    const validRows = Math.max(1, Math.min(10, rows));
    const validCols = Math.max(1, Math.min(10, cols));
    onGridConfigChange({
      ...gridConfig,
      preset: 'custom',
      rows: validRows,
      cols: validCols,
    });
  };

  const completedCount = tileItems.filter((t) => t.status === 'done').length;
  const allCompleted = tileItems.length > 0 && completedCount === tileItems.length;

  return (
    <div className="w-80 lg:w-96 bg-studio-900 border-l border-studio-800 flex flex-col h-full overflow-y-auto select-none p-4 space-y-5 text-sm shrink-0">
      {/* 1. Source Video Upload Dropzone */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>Source Video</span>
          {metadata && (
            <span className="text-[10px] text-emerald-400 font-normal lowercase flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> loaded
            </span>
          )}
        </label>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-studio-700 hover:border-studio-accent/70 rounded-xl p-4 text-center cursor-pointer transition bg-studio-800/40 hover:bg-studio-800/70 group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onFileUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <Upload className="w-6 h-6 mx-auto text-slate-400 group-hover:text-studio-accent transition mb-2" />
          <div className="font-semibold text-xs text-white">
            {sourceFile ? (sourceFile as File).name : 'Choose or Drag MP4 / MOV / WebM'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Browser client-side processing • No server upload
          </div>
        </div>

        {/* Video Inspection Metadata Card */}
        {metadata && (
          <div className="p-3 bg-studio-800/70 rounded-xl border border-studio-700/60 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Dimensions:</span>
              <span className="font-mono font-bold text-white">
                {metadata.width}×{metadata.height} ({metadata.displayAspectRatio})
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Duration & FPS:</span>
              <span className="font-mono text-white">
                {metadata.duration.toFixed(2)}s @ {metadata.frameRate} fps
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span className="text-slate-400">Audio Track:</span>
              <span className="flex items-center gap-1 font-mono text-white">
                <Music className="w-3.5 h-3.5 text-studio-cyan" />
                {metadata.hasAudio ? 'Master Stereo Track' : 'Silent (No Audio)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Grid Slicing Presets & Custom Configuration */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Spatial Grid Partition
        </label>

        <div className="grid grid-cols-3 gap-1.5">
          {presets.map((p) => {
            const isSelected = gridConfig.preset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handlePresetSelect(p.id, p.rows, p.cols)}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition text-center ${
                  isSelected
                    ? 'bg-studio-accent text-white border-studio-accent shadow-md shadow-studio-accent/25'
                    : 'bg-studio-800/80 text-slate-300 border-studio-700/70 hover:bg-studio-700'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom rows/cols input */}
        <div className="p-3 bg-studio-800/50 rounded-xl border border-studio-700/50 flex items-center space-x-3 text-xs">
          <div className="flex-1">
            <label className="text-[11px] text-slate-400 block mb-1">Rows (R)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={gridConfig.rows}
              onChange={(e) => handleCustomRowCol(parseInt(e.target.value) || 1, gridConfig.cols)}
              className="w-full bg-studio-900 border border-studio-700 rounded-lg px-2.5 py-1 text-white font-mono text-center focus:outline-none focus:border-studio-accent"
            />
          </div>
          <span className="text-slate-500 font-bold mt-4">×</span>
          <div className="flex-1">
            <label className="text-[11px] text-slate-400 block mb-1">Cols (C)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={gridConfig.cols}
              onChange={(e) => handleCustomRowCol(gridConfig.rows, parseInt(e.target.value) || 1)}
              className="w-full bg-studio-900 border border-studio-700 rounded-lg px-2.5 py-1 text-white font-mono text-center focus:outline-none focus:border-studio-accent"
            />
          </div>
          <div className="text-right pl-2 mt-4 text-slate-400 font-mono text-xs">
            = <span className="text-studio-cyan font-bold">{gridConfig.rows * gridConfig.cols}</span> tiles
          </div>
        </div>
      </div>

      {/* 3. Precision Quality Mode Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Encoding Quality Pipeline
        </label>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => onQualityModeChange('fast')}
            className={`p-2 rounded-xl border text-left transition ${
              qualityMode === 'fast'
                ? 'bg-studio-accent/20 border-studio-accent text-white shadow'
                : 'bg-studio-800/60 border-studio-700/60 text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-400 mb-1" />
            <div className="text-xs font-bold">Fast</div>
            <div className="text-[10px] text-slate-400 leading-tight">CRF 26 Ultrafast</div>
          </button>

          <button
            onClick={() => onQualityModeChange('high')}
            className={`p-2 rounded-xl border text-left transition ${
              qualityMode === 'high'
                ? 'bg-studio-accent/20 border-studio-accent text-white shadow'
                : 'bg-studio-800/60 border-studio-700/60 text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4 text-studio-cyan mb-1" />
            <div className="text-xs font-bold">High Quality</div>
            <div className="text-[10px] text-slate-400 leading-tight">CRF 18 Medium</div>
          </button>

          <button
            onClick={() => onQualityModeChange('lossless')}
            className={`p-2 rounded-xl border text-left transition ${
              qualityMode === 'lossless'
                ? 'bg-studio-accent/20 border-studio-accent text-white shadow'
                : 'bg-studio-800/60 border-studio-700/60 text-slate-400 hover:text-white'
            }`}
          >
            <Crown className="w-4 h-4 text-purple-400 mb-1" />
            <div className="text-xs font-bold">Lossless</div>
            <div className="text-[10px] text-slate-400 leading-tight">CRF 0 Lossless</div>
          </button>
        </div>
      </div>

      {/* 4. Split Action Button & Progress */}
      <div className="pt-2 space-y-2">
        {!isSplitting ? (
          <button
            onClick={onStartSplit}
            disabled={!metadata}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Scissors className="w-4 h-4" />
            <span>Split Video Into {gridConfig.rows * gridConfig.cols} Tiles</span>
          </button>
        ) : (
          <div className="space-y-2 p-3 bg-studio-800/90 rounded-xl border border-studio-700">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-200">Processing Grid...</span>
              <span className="text-studio-cyan font-mono">{splitProgress}%</span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 bg-studio-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-200"
                style={{ width: `${splitProgress}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 truncate font-mono">
              {currentTileMessage || 'Rendering spatial slices...'}
            </div>
            <button
              onClick={onCancelSplit}
              className="w-full py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 text-xs font-semibold transition flex items-center justify-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Cancel Operation</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Processed Tiles & Export ZIP Section */}
      {tileItems.length > 0 && (
        <div className="pt-3 border-t border-studio-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Processed Tiles ({completedCount}/{tileItems.length})
            </span>
            {allCompleted && (
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            )}
          </div>

          {/* Download All ZIP button */}
          <button
            onClick={onDownloadAllZip}
            disabled={!allCompleted || isDownloadingZip}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <FileArchive className="w-4 h-4" />
            <span>{isDownloadingZip ? 'Archiving ZIP...' : 'Download All ZIP with manifest.json'}</span>
          </button>

          {/* Individual Tiles List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {tileItems.map((item) => {
              const t = item.tile;
              return (
                <div
                  key={t.filename}
                  className="flex items-center justify-between p-2 rounded-lg bg-studio-800/60 border border-studio-700/50 text-xs"
                >
                  <div className="flex items-center space-x-2 overflow-hidden">
                    <span className="font-mono text-[11px] font-bold text-studio-cyan shrink-0">
                      R{t.row + 1}:C{t.col + 1}
                    </span>
                    <span className="text-slate-300 truncate text-[11px]">
                      {t.filename} ({t.width}×{t.height})
                    </span>
                  </div>

                  {item.status === 'done' ? (
                    <button
                      onClick={() => onDownloadTile(item)}
                      title={`Download ${t.filename}`}
                      className="p-1 rounded bg-studio-700 hover:bg-studio-600 text-slate-200 transition shrink-0 ml-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  ) : item.status === 'processing' ? (
                    <span className="text-[10px] text-amber-400 animate-pulse font-mono">
                      {item.progress}%
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">pending</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
