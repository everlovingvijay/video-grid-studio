import React, { useRef } from 'react';
import {
  Upload,
  Layers,
  FileArchive,
  Download,
  AlertTriangle,
  CheckCircle2,
  Film,
  Music,
  Sliders,
  Play,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  ProjectManifest,
  TileBoundary,
  QualityMode,
} from '../types/video';

interface ReassembleSettingsPanelProps {
  onZipUpload: (file: File) => void;
  onTileFilesUpload: (files: FileList) => void;
  onAudioUpload: (file: File) => void;
  manifest: ProjectManifest | null;
  loadedTiles: Map<string, Blob>;
  expectedTiles: TileBoundary[];
  hasAudio: boolean;
  audioFilename?: string;
  isReassembling: boolean;
  reassembleProgress: number;
  reassembleMessage: string;
  onStartReassemble: () => void;
  reconstructedVideoBlob: Blob | null;
  reconstructedVideoUrl: string | null;
  onDownloadMerged: () => void;
  qualityMode: QualityMode;
  onQualityModeChange: (mode: QualityMode) => void;
  exportAnimation: boolean;
  onToggleExportAnimation: (enabled: boolean) => void;
}

export const ReassembleSettingsPanel: React.FC<ReassembleSettingsPanelProps> = ({
  onZipUpload,
  onTileFilesUpload,
  onAudioUpload,
  manifest,
  loadedTiles,
  expectedTiles,
  hasAudio,
  audioFilename,
  isReassembling,
  reassembleProgress,
  reassembleMessage,
  onStartReassemble,
  reconstructedVideoBlob,
  reconstructedVideoUrl,
  onDownloadMerged,
  qualityMode,
  onQualityModeChange,
  exportAnimation,
  onToggleExportAnimation,
}) => {
  const zipInputRef = useRef<HTMLInputElement>(null);
  const tileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const matchedCount = expectedTiles.filter((t) => loadedTiles.has(t.filename)).length;
  const isReadyToReassemble = expectedTiles.length > 0 && matchedCount === expectedTiles.length;

  return (
    <div className="w-80 lg:w-96 bg-studio-900 border-l border-studio-800 flex flex-col h-full overflow-y-auto select-none p-4 space-y-5 text-sm shrink-0">
      {/* 1. Import ZIP or Tile Videos */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Import Project / Tile Videos
        </label>

        <div className="grid grid-cols-2 gap-2">
          {/* Drop/Choose ZIP */}
          <div
            onClick={() => zipInputRef.current?.click()}
            className="border-2 border-dashed border-studio-700 hover:border-studio-accent rounded-xl p-3 text-center cursor-pointer transition bg-studio-800/40 hover:bg-studio-800/80 group"
          >
            <input
              ref={zipInputRef}
              type="file"
              accept=".zip,application/zip"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onZipUpload(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <FileArchive className="w-5 h-5 mx-auto text-slate-400 group-hover:text-studio-accent transition mb-1" />
            <div className="font-semibold text-xs text-white">Import ZIP</div>
            <div className="text-[10px] text-slate-400">With manifest.json</div>
          </div>

          {/* Multiple Tile Files Drop */}
          <div
            onClick={() => tileInputRef.current?.click()}
            className="border-2 border-dashed border-studio-700 hover:border-studio-accent rounded-xl p-3 text-center cursor-pointer transition bg-studio-800/40 hover:bg-studio-800/80 group"
          >
            <input
              ref={tileInputRef}
              type="file"
              multiple
              accept="video/mp4,video/webm,video/quicktime"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  onTileFilesUpload(e.target.files);
                }
              }}
              className="hidden"
            />
            <Film className="w-5 h-5 mx-auto text-slate-400 group-hover:text-studio-accent transition mb-1" />
            <div className="font-semibold text-xs text-white">Select Tiles</div>
            <div className="text-[10px] text-slate-400">Individual MP4s</div>
          </div>
        </div>
      </div>

      {/* 2. Manifest & Geometric Integrity Report */}
      {manifest && (
        <div className="p-3 bg-studio-800/80 rounded-xl border border-studio-700/60 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-200">Manifest Verified</span>
            <span className="text-[10px] font-mono text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40">
              v{manifest.version}
            </span>
          </div>

          <div className="space-y-1 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Reconstructed Res:</span>
              <span className="font-mono font-bold text-white">
                {manifest.source.width}×{manifest.source.height}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Grid Structure:</span>
              <span className="font-mono text-studio-cyan">
                {manifest.grid.rows} rows × {manifest.grid.cols} cols ({manifest.grid.totalTiles} tiles)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Master Duration:</span>
              <span className="font-mono text-white">{manifest.source.duration.toFixed(2)}s</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Tile Matrix Validation Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold uppercase tracking-wider text-slate-400">
            Tile Alignment ({matchedCount}/{expectedTiles.length})
          </span>
          {isReadyToReassemble ? (
            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> All Present
            </span>
          ) : (
            <span className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Waiting for tiles
            </span>
          )}
        </div>

        {/* Visual Matrix layout */}
        <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
          {expectedTiles.map((t) => {
            const isLoaded = loadedTiles.has(t.filename);
            return (
              <div
                key={t.filename}
                className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                  isLoaded
                    ? 'bg-studio-800/80 border-emerald-800/50 text-slate-200'
                    : 'bg-studio-900/50 border-studio-800 text-slate-500'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span
                    className={`font-mono text-[10px] font-bold ${
                      isLoaded ? 'text-studio-cyan' : 'text-slate-500'
                    }`}
                  >
                    R{t.row + 1}:C{t.col + 1}
                  </span>
                  <span className="font-mono text-[11px] truncate">{t.filename}</span>
                </div>
                <span className="text-[10px] font-bold">
                  {isLoaded ? 'READY' : 'MISSING'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Master Audio Preservation Warning & Custom Upload */}
      <div className="p-3 bg-studio-800/50 rounded-xl border border-studio-700/50 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-studio-cyan" />
            <span>Master Audio</span>
          </span>
          {hasAudio ? (
            <span className="text-[10px] text-emerald-400 font-mono">
              {audioFilename || 'master_audio.aac'}
            </span>
          ) : (
            <span className="text-[10px] text-amber-400 font-semibold">Absent (Silent)</span>
          )}
        </div>

        {!hasAudio && (
          <div className="text-[11px] text-amber-300/80 leading-tight">
            Original audio is missing or source was silent. You can optionally supply an audio track:
          </div>
        )}

        <button
          onClick={() => audioInputRef.current?.click()}
          className="w-full py-1.5 rounded-lg bg-studio-800 hover:bg-studio-700 border border-studio-700 text-slate-300 text-xs font-medium transition"
        >
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,video/mp4"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                onAudioUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          {hasAudio ? 'Replace Master Audio' : 'Upload Audio Track'}
        </button>
      </div>

      {/* 5. Reassemble & Export Action Button */}
      <div className="space-y-2 pt-2">
        {!isReassembling ? (
          <button
            onClick={onStartReassemble}
            disabled={!isReadyToReassemble}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Layers className="w-4 h-4" />
            <span>Reassemble Into Full-Frame Video</span>
          </button>
        ) : (
          <div className="space-y-2 p-3 bg-studio-800/90 rounded-xl border border-studio-700">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-200">Compositing Tiles...</span>
              <span className="text-studio-cyan font-mono">{reassembleProgress}%</span>
            </div>
            <div className="w-full h-2 bg-studio-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                style={{ width: `${reassembleProgress}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 font-mono truncate">
              {reassembleMessage || 'Compositing spatial pixels at exact coordinates...'}
            </div>
          </div>
        )}

        {/* Download Merged Full Video */}
        {reconstructedVideoBlob && (
          <button
            onClick={onDownloadMerged}
            className="w-full py-2.5 rounded-xl bg-studio-accent hover:bg-studio-accent-hover text-white font-bold text-xs shadow-md shadow-studio-accent/30 transition flex items-center justify-center space-x-2 animate-bounce-subtle"
          >
            <Download className="w-4 h-4" />
            <span>Download Reconstructed Video ({(reconstructedVideoBlob.size / (1024 * 1024)).toFixed(1)} MB)</span>
          </button>
        )}
      </div>
    </div>
  );
};
