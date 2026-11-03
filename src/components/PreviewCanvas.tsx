import React, { useRef, useEffect, useState } from 'react';
import {
  Maximize2,
  Grid as GridIcon,
  Eye,
  Sliders,
  Sparkles,
  Layers,
  Split,
} from 'lucide-react';
import { TileBoundary, VideoMetadata, GridConfig, TileAdjustment, VideoWallConfig } from '../types/video';

interface PreviewCanvasProps {
  sourceVideoUrl?: string;
  sourceMetadata?: VideoMetadata;
  tiles: TileBoundary[];
  gridConfig: GridConfig;
  mode: 'split' | 'reassemble' | 'compare' | 'wall' | 'docs';
  tileVideos?: Map<string, HTMLVideoElement>;
  reconstructedVideoUrl?: string;
  tileAdjustments?: Map<number, TileAdjustment>;
  videoWallConfig?: VideoWallConfig;
  currentTime: number;
  // Interactive split/rejoin animation factor: 0 (joined) to 1 (fully separated)
  splitAnimationFactor: number;
  onSplitAnimationChange: (factor: number) => void;
  // Comparison modes
  compareMode?: 'slider' | 'side-by-side' | 'difference' | 'heatmap';
  heatmapUrl?: string;
}

export const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  sourceVideoUrl,
  sourceMetadata,
  tiles,
  gridConfig,
  mode,
  tileVideos,
  reconstructedVideoUrl,
  tileAdjustments,
  videoWallConfig,
  currentTime,
  splitAnimationFactor,
  onSplitAnimationChange,
  compareMode = 'slider',
  heatmapUrl,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const reconVideoRef = useRef<HTMLVideoElement>(null);

  const [showGridOverlay, setShowGridOverlay] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [compareSplitPos, setCompareSplitPos] = useState(0.5); // 0.0 to 1.0
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // Sync video currentTime when timeline updates
  useEffect(() => {
    if (sourceVideoRef.current && Math.abs(sourceVideoRef.current.currentTime - currentTime) > 0.05) {
      sourceVideoRef.current.currentTime = currentTime;
    }
    if (reconVideoRef.current && Math.abs(reconVideoRef.current.currentTime - currentTime) > 0.05) {
      reconVideoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Main rendering loop for canvas preview
  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const targetW = sourceMetadata?.width || 1920;
      const targetH = sourceMetadata?.height || 1080;

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.clearRect(0, 0, targetW, targetH);

      // 1. In Reassemble or Split mode:
      if (mode === 'reassemble' && tileVideos && tileVideos.size > 0) {
        // Render each tile at its coordinates with split explosion animation
        ctx.fillStyle = '#0b0f17';
        ctx.fillRect(0, 0, targetW, targetH);

        const explosionDistance = 35 * splitAnimationFactor; // Pixels of separation
        const centerCol = (gridConfig.cols - 1) / 2;
        const centerRow = (gridConfig.rows - 1) / 2;

        for (const tile of tiles) {
          const video = tileVideos.get(tile.filename);
          const adj = tileAdjustments?.get(tile.index);

          // Spatial displacement for split/rejoin demonstration
          const offsetX = (tile.col - centerCol) * explosionDistance;
          const offsetY = (tile.row - centerRow) * explosionDistance;

          ctx.save();
          ctx.translate(tile.x0 + offsetX, tile.y0 + offsetY);

          // Apply tile adjustments if any (brightness, contrast, rotation, flip)
          if (adj) {
            let filterStr = '';
            if (adj.brightness !== 0) filterStr += `brightness(${100 + adj.brightness}%) `;
            if (adj.contrast !== 0) filterStr += `contrast(${100 + adj.contrast}%) `;
            if (adj.saturation !== 0) filterStr += `saturate(${100 + adj.saturation}%) `;
            if (filterStr) ctx.filter = filterStr;

            if (adj.flipH || adj.flipV) {
              ctx.scale(adj.flipH ? -1 : 1, adj.flipV ? -1 : 1);
            }
          }

          if (video && video.readyState >= 2) {
            ctx.drawImage(video, 0, 0, tile.width, tile.height);
          } else {
            // Placeholder tile block
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, tile.width, tile.height);
          }

          // Optional subtle drop shadow when exploded
          if (splitAnimationFactor > 0.05) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.strokeRect(0, 0, tile.width, tile.height);
          }

          ctx.restore();
        }
      } else if (mode === 'compare' && compareMode === 'heatmap' && heatmapUrl) {
        // Draw seam heatmap directly
        const img = new Image();
        img.src = heatmapUrl;
        if (img.complete) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
        }
      } else if (sourceVideoRef.current && sourceVideoRef.current.readyState >= 2) {
        // Draw source video
        ctx.drawImage(sourceVideoRef.current, 0, 0, targetW, targetH);
      } else {
        // Blank canvas background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, targetW, targetH);

        ctx.fillStyle = '#475569';
        ctx.font = '18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('No video loaded - Import a video or load a sample test video', targetW / 2, targetH / 2);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [mode, tiles, gridConfig, tileVideos, tileAdjustments, splitAnimationFactor, compareMode, heatmapUrl, sourceMetadata]);

  // Handle compare split slider dragging
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingSlider || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    setCompareSplitPos(x / rect.width);
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDraggingSlider(false)}
      onMouseLeave={() => setIsDraggingSlider(false)}
      className="relative flex-1 bg-studio-950 flex items-center justify-center overflow-hidden select-none p-4"
    >
      {/* Hidden reference video elements */}
      {sourceVideoUrl && (
        <video
          ref={sourceVideoRef}
          src={sourceVideoUrl}
          playsInline
          muted
          className="hidden"
        />
      )}
      {reconstructedVideoUrl && (
        <video
          ref={reconVideoRef}
          src={reconstructedVideoUrl}
          playsInline
          muted
          className="hidden"
        />
      )}

      {/* Main Canvas Viewport with aspect-ratio preservation */}
      <div className="relative max-w-full max-h-full flex items-center justify-center rounded-xl overflow-hidden border border-studio-800 shadow-2xl bg-black/40">
        <canvas
          ref={canvasRef}
          className="max-w-full max-h-[calc(100vh-16rem)] object-contain block"
        />

        {/* Compare Mode Split Slider Overlay */}
        {mode === 'compare' && compareMode === 'slider' && reconstructedVideoUrl && (
          <>
            <div
              className="absolute inset-y-0 w-1 bg-white cursor-ew-resize z-30 shadow-[0_0_10px_rgba(255,255,255,0.7)]"
              style={{ left: `${compareSplitPos * 100}%` }}
              onMouseDown={() => setIsDraggingSlider(true)}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 bg-white text-slate-900 rounded-full flex items-center justify-center shadow-lg border border-slate-300">
                <Split className="w-3.5 h-3.5" />
              </div>
            </div>
            {/* Left badge */}
            <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 backdrop-blur rounded text-[11px] font-bold text-studio-cyan border border-studio-cyan/30">
              Source Video
            </div>
            {/* Right badge */}
            <div className="absolute top-3 right-3 px-2 py-1 bg-black/70 backdrop-blur rounded text-[11px] font-bold text-emerald-400 border border-emerald-400/30">
              Reconstructed Grid
            </div>
          </>
        )}

        {/* Grid Overlay with deterministic coordinate labels */}
        {showGridOverlay && mode !== 'compare' && (
          <div className="absolute inset-0 pointer-events-none">
            {tiles.map((tile) => {
              const W = sourceMetadata?.width || 1920;
              const H = sourceMetadata?.height || 1080;
              const leftPct = (tile.x0 / W) * 100;
              const topPct = (tile.y0 / H) * 100;
              const widthPct = (tile.width / W) * 100;
              const heightPct = (tile.height / H) * 100;

              return (
                <div
                  key={tile.filename}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${widthPct}%`,
                    height: `${heightPct}%`,
                  }}
                  className="absolute border border-studio-cyan/40 hover:border-studio-cyan transition-colors"
                >
                  {showLabels && (
                    <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur text-[10px] font-mono font-semibold text-studio-cyan border border-studio-cyan/30 shadow">
                      R{tile.row + 1}:C{tile.col + 1} ({tile.width}x{tile.height})
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Top Floating Controls for Preview */}
      <div className="absolute top-6 left-6 flex items-center space-x-2 bg-studio-900/80 backdrop-blur border border-studio-800 rounded-xl p-1.5 shadow-lg z-20">
        <button
          onClick={() => setShowGridOverlay(!showGridOverlay)}
          title="Toggle Grid Boundary Overlay"
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            showGridOverlay
              ? 'bg-studio-accent text-white'
              : 'text-slate-400 hover:text-white hover:bg-studio-800'
          }`}
        >
          <GridIcon className="w-3.5 h-3.5" />
          <span>Grid</span>
        </button>

        <button
          onClick={() => setShowLabels(!showLabels)}
          title="Toggle Tile Coordinate Labels"
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${
            showLabels
              ? 'bg-studio-800 text-studio-cyan border border-studio-700'
              : 'text-slate-400 hover:text-white hover:bg-studio-800'
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Labels</span>
        </button>

        {sourceMetadata && (
          <div className="px-2 py-1 text-[11px] font-mono text-slate-400 border-l border-studio-800 pl-2">
            {sourceMetadata.width}x{sourceMetadata.height} ({sourceMetadata.displayAspectRatio})
          </div>
        )}
      </div>

      {/* Bottom Floating Interactive Split / Rejoin Slider */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center pointer-events-none z-20">
        <div className="bg-studio-900/90 backdrop-blur border border-studio-800/90 rounded-2xl px-4 py-2.5 shadow-2xl flex items-center space-x-3 pointer-events-auto max-w-md w-full">
          <Layers className="w-4 h-4 text-studio-cyan shrink-0" />
          <div className="flex-1">
            <div className="flex justify-between text-[11px] font-semibold text-slate-300 mb-1">
              <span>Rejoin (Seamless)</span>
              <span className="text-studio-cyan font-mono">{Math.round(splitAnimationFactor * 100)}%</span>
              <span>Split (Exploded)</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={splitAnimationFactor}
              onChange={(e) => onSplitAnimationChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-studio-cyan focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
