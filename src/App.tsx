import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { Timeline } from './components/Timeline';
import { PreviewCanvas } from './components/PreviewCanvas';
import { SplitSettingsPanel } from './components/SplitSettingsPanel';
import { ReassembleSettingsPanel } from './components/ReassembleSettingsPanel';
import { CompareSettingsPanel } from './components/CompareSettingsPanel';
import { VideoWallSettingsPanel } from './components/VideoWallSettingsPanel';
import { DocumentationSettingsPanel } from './components/DocumentationSettingsPanel';

import {
  VideoMetadata,
  GridConfig,
  QualityMode,
  TileProcessingItem,
  ProjectManifest,
  TileBoundary,
  TileAdjustment,
  VideoWallConfig,
  SeamMetrics,
} from './types/video';
import { computeGridBoundaries, validateGridGeometry, parseTileFilename } from './services/gridCalculator';
import { createProjectManifest } from './services/manifestService';
import { createProjectZip, extractProjectZip } from './services/zipService';
import { inspectVideoFile, generateSyntheticTestVideo, SyntheticVideoOptions } from './services/browserVideoService';
import { ffmpegService } from './services/ffmpegService';
import { MasterPresentationClock } from './services/masterClock';
import { compareFrames } from './services/seamInspector';
import { storageService } from './services/storageService';

export const App: React.FC = () => {
  // Navigation
  const [activeTab, setActiveTab] = useState<ActiveTab>('split');

  // FFmpeg & Environment Status
  const [isWasmReady, setIsWasmReady] = useState(false);
  const [isWasmLoading, setIsWasmLoading] = useState(false);
  const isCrossOriginIsolated = useMemo(() => ffmpegService.isCrossOriginIsolated(), []);

  // Source Video State
  const [sourceFile, setSourceFile] = useState<File | Blob | null>(null);
  const [sourceVideoUrl, setSourceVideoUrl] = useState<string | null>(null);
  const [sourceMetadata, setSourceMetadata] = useState<VideoMetadata | null>(null);

  // Grid Configuration
  const [gridConfig, setGridConfig] = useState<GridConfig>({
    rows: 3,
    cols: 3,
    preset: '3x3',
    isAsymmetric: false,
  });

  // Quality Mode
  const [qualityMode, setQualityMode] = useState<QualityMode>('high');

  // Master Clock & Timeline State
  const masterClock = useMemo(() => new MasterPresentationClock(0, 30), []);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [isLoop, setIsLoop] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Split Processing State
  const [isSplitting, setIsSplitting] = useState(false);
  const [splitProgress, setSplitProgress] = useState(0);
  const [currentTileMessage, setCurrentTileMessage] = useState('');
  const [tileItems, setTileItems] = useState<TileProcessingItem[]>([]);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Reassemble & Manifest State
  const [manifest, setManifest] = useState<ProjectManifest | null>(null);
  const [masterAudioBlob, setMasterAudioBlob] = useState<Blob | null>(null);
  const [masterAudioFilename, setMasterAudioFilename] = useState<string>('master_audio.aac');
  const [loadedTiles, setLoadedTiles] = useState<Map<string, Blob>>(new Map());
  const [tileVideos, setTileVideos] = useState<Map<string, HTMLVideoElement>>(new Map());
  const [isReassembling, setIsReassembling] = useState(false);
  const [reassembleProgress, setReassembleProgress] = useState(0);
  const [reassembleMessage, setReassembleMessage] = useState('');
  const [reconstructedVideoBlob, setReconstructedVideoBlob] = useState<Blob | null>(null);
  const [reconstructedVideoUrl, setReconstructedVideoUrl] = useState<string | null>(null);
  const [exportAnimation, setExportAnimation] = useState(false);

  // Split / Rejoin visual explosion animation (0 to 1)
  const [splitAnimationFactor, setSplitAnimationFactor] = useState(0);

  // Seam & Comparison State
  const [compareMode, setCompareMode] = useState<'slider' | 'side-by-side' | 'difference' | 'heatmap'>('slider');
  const [seamMetrics, setSeamMetrics] = useState<SeamMetrics | null>(null);
  const [heatmapUrl, setHeatmapUrl] = useState<string | null>(null);
  const [isEvaluatingMetrics, setIsEvaluatingMetrics] = useState(false);

  // Video Wall & Tile Tuning State
  const [videoWallConfig, setVideoWallConfig] = useState<VideoWallConfig>({
    bezelCompensationX: 0,
    bezelCompensationY: 0,
    showCalibrationPattern: false,
    patternType: 'smpte',
    showTileLabels: true,
  });
  const [tileAdjustments, setTileAdjustments] = useState<Map<number, TileAdjustment>>(new Map());

  // Synthetic Test Video Generation State
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);

  // Calculate current tile boundaries based on source resolution and gridConfig, or manifest if present
  const currentTiles: TileBoundary[] = useMemo(() => {
    if (manifest?.tiles && manifest.tiles.length > 0) {
      return manifest.tiles.map((t) => ({
        index: t.index,
        row: t.row - 1,
        col: t.col - 1,
        x0: t.crop.x0,
        y0: t.crop.y0,
        x1: t.crop.x1,
        y1: t.crop.y1,
        width: t.crop.width,
        height: t.crop.height,
        filename: t.filename,
      }));
    }
    const width = sourceMetadata?.width || 1920;
    const height = sourceMetadata?.height || 1080;
    return computeGridBoundaries(width, height, gridConfig);
  }, [manifest, sourceMetadata, gridConfig]);

  // Initialize Master Clock Listeners
  useEffect(() => {
    masterClock.setLoop(isLoop);
    const unregister = masterClock.registerListener({
      onTimeUpdate: (t) => setCurrentTime(t),
      onPlayStateChange: (p) => setIsPlaying(p),
      onSeek: (t) => setCurrentTime(t),
    });
    return () => {
      unregister();
      masterClock.destroy();
    };
  }, [masterClock, isLoop]);

  // Pre-load FFmpeg on mount
  useEffect(() => {
    setIsWasmLoading(true);
    ffmpegService.load().then((ready) => {
      setIsWasmReady(ready);
      setIsWasmLoading(false);
    });
  }, []);

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        masterClock.togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        masterClock.stepFrame(-1);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        masterClock.stepFrame(1);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [masterClock]);

  // Load Video File Handler
  const handleLoadVideo = async (file: File | Blob) => {
    try {
      const { metadata } = await inspectVideoFile(file);
      setSourceFile(file);
      setSourceMetadata(metadata);
      setDuration(metadata.duration);
      masterClock.setDuration(metadata.duration);
      masterClock.setFps(metadata.frameRate);

      if (sourceVideoUrl) URL.revokeObjectURL(sourceVideoUrl);
      const url = URL.createObjectURL(file);
      setSourceVideoUrl(url);

      // Reset tiles
      const initialBoundaries = computeGridBoundaries(metadata.width, metadata.height, gridConfig);
      setTileItems(
        initialBoundaries.map((b) => ({
          tile: b,
          status: 'idle',
          progress: 0,
        }))
      );
    } catch (err) {
      alert(`Could not load video: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Generate Synthetic Test Video Handler
  const handleGenerateSample = async (options: SyntheticVideoOptions) => {
    setIsGeneratingSample(true);
    try {
      const blob = await generateSyntheticTestVideo(options);
      await handleLoadVideo(blob);
    } catch (e) {
      alert(`Error generating sample test video: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsGeneratingSample(false);
    }
  };

  // Perform Video Grid Split
  const handleStartSplit = async () => {
    if (!sourceFile || !sourceMetadata) return;

    setIsSplitting(true);
    setSplitProgress(0);
    setCurrentTileMessage('Initializing FFmpeg...');

    let sharedInputName: string | null = null;
    try {
      const isLoaded = await ffmpegService.load();
      if (!isLoaded) {
        throw new Error('Could not load FFmpeg WASM core');
      }

      setCurrentTileMessage('Loading video frame buffer into memory...');
      sharedInputName = await ffmpegService.prepareSourceVideo(sourceFile);

      // Step 1: Extract master audio track if video has audio
      let audioBlob: Blob | null = null;
      let audioName = 'master_audio.aac';
      if (sourceMetadata.hasAudio) {
        setCurrentTileMessage('Extracting master audio stream (no tile audio duplication)...');
        const audioResult = await ffmpegService.extractMasterAudio(sharedInputName);
        if (audioResult) {
          audioBlob = audioResult.audioBlob;
          audioName = audioResult.filename;
          setMasterAudioBlob(audioBlob);
          setMasterAudioFilename(audioName);
        }
      }

      // Step 2: Ensure even dimensions to prevent YUV420p chroma subsampling truncation seams
      const safeWidth = Math.floor(sourceMetadata.width / 2) * 2;
      const safeHeight = Math.floor(sourceMetadata.height / 2) * 2;
      const safeMetadata: VideoMetadata = {
        ...sourceMetadata,
        width: safeWidth,
        height: safeHeight,
      };
      if (safeWidth !== sourceMetadata.width || safeHeight !== sourceMetadata.height) {
        setSourceMetadata(safeMetadata);
      }

      const boundaries = computeGridBoundaries(safeWidth, safeHeight, gridConfig);
      const updatedItems: TileProcessingItem[] = boundaries.map((b) => ({
        tile: b,
        status: 'idle',
        progress: 0,
      }));
      setTileItems([...updatedItems]);

      const processedBlobs = new Map<string, Blob>();
      const newVideoElements = new Map<string, HTMLVideoElement>();

      // Step 3: Sequentially process each tile
      const totalTiles = boundaries.length;
      for (let i = 0; i < totalTiles; i++) {
        const tile = boundaries[i];
        setCurrentTileMessage(`Encoding Tile R${tile.row + 1}:C${tile.col + 1} (${tile.filename})...`);

        updatedItems[i].status = 'processing';
        setTileItems([...updatedItems]);

        const tileBlob = await ffmpegService.splitTile({
          source: sharedInputName,
          tile,
          sourceWidth: safeWidth,
          sourceHeight: safeHeight,
          qualityMode,
          onProgress: (percent, msg) => {
            updatedItems[i].progress = percent;
            setTileItems([...updatedItems]);
            const overall = Math.round(((i + percent / 100) / totalTiles) * 100);
            setSplitProgress(overall);
            setCurrentTileMessage(msg);
          },
        });

        updatedItems[i].status = 'done';
        updatedItems[i].blob = tileBlob;
        updatedItems[i].blobUrl = URL.createObjectURL(tileBlob);
        updatedItems[i].progress = 100;
        setTileItems([...updatedItems]);

        processedBlobs.set(tile.filename, tileBlob);

        // Pre-create slaved HTMLVideoElement for synchronized canvas compositor
        const vid = document.createElement('video');
        vid.src = updatedItems[i].blobUrl!;
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        masterClock.registerVideo(vid);
        newVideoElements.set(tile.filename, vid);
      }

      // Step 4: Generate Project Manifest
      const generatedManifest = await createProjectManifest({
        source: sourceMetadata,
        gridConfig,
        qualityMode,
        tiles: updatedItems,
        masterAudioFilename: audioBlob ? audioName : undefined,
        hasAudio: !!audioBlob,
      });

      setManifest(generatedManifest);
      setLoadedTiles(processedBlobs);
      setTileVideos(newVideoElements);
      setSplitProgress(100);
      setCurrentTileMessage('Grid split completed successfully!');

      // Save to IndexedDB
      await storageService.saveRecentProject({
        id: `proj_${Date.now()}`,
        name: sourceMetadata.name,
        savedAt: Date.now(),
        gridConfig,
        manifest: generatedManifest,
        sourceInfo: {
          name: sourceMetadata.name,
          width: sourceMetadata.width,
          height: sourceMetadata.height,
          duration: sourceMetadata.duration,
        },
      });

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
    } catch (e) {
      alert(`Split operation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (sharedInputName) {
        await ffmpegService.cleanupSourceVideo(sharedInputName).catch(() => {});
      }
      setIsSplitting(false);
    }
  };

  // Download a single tile file
  const handleDownloadTile = (item: TileProcessingItem) => {
    if (!item.blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(item.blob);
    a.download = item.tile.filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Download All ZIP with manifest.json
  const handleDownloadAllZip = async () => {
    if (!manifest || tileItems.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const tileData = tileItems
        .filter((t) => t.status === 'done' && t.blob)
        .map((t) => ({ filename: t.tile.filename, blob: t.blob! }));

      const audioData = masterAudioBlob
        ? { filename: masterAudioFilename, blob: masterAudioBlob }
        : undefined;

      const zipBlob = await createProjectZip({
        manifest,
        tiles: tileData,
        audio: audioData,
      });

      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${sourceMetadata?.name.replace(/\.[^/.]+$/, '') || 'video_grid'}_archive.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert(`ZIP archive creation failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Import Project ZIP handler
  const handleZipUpload = async (file: File) => {
    try {
      const extracted = await extractProjectZip(file);

      if (extracted.manifest) {
        setManifest(extracted.manifest);
        setGridConfig({
          rows: extracted.manifest.grid.rows,
          cols: extracted.manifest.grid.cols,
          preset: 'custom',
          isAsymmetric: extracted.manifest.grid.isAsymmetric,
          chromaAligned: extracted.manifest.grid.chromaAligned ?? true,
        });

        if (extracted.manifest.source) {
          const zipWidth = Math.floor(extracted.manifest.source.width / 2) * 2;
          const zipHeight = Math.floor(extracted.manifest.source.height / 2) * 2;
          setSourceMetadata({
            name: extracted.manifest.source.filename,
            size: file.size,
            duration: extracted.manifest.source.duration,
            width: zipWidth,
            height: zipHeight,
            displayAspectRatio: `${zipWidth}:${zipHeight}`,
            frameRate: extracted.manifest.source.fps,
            pixelFormat: extracted.manifest.source.pixelFormat || 'yuv420p',
            hasAudio: extracted.manifest.source.hasAudio,
          });
          setDuration(extracted.manifest.source.duration);
          masterClock.setDuration(extracted.manifest.source.duration);
        }
      }

      setLoadedTiles(extracted.tiles);
      if (extracted.audioBlob) {
        setMasterAudioBlob(extracted.audioBlob);
        setMasterAudioFilename(extracted.audioFilename || 'master_audio.aac');
      }

      // Create slaved videos
      const newVideoElements = new Map<string, HTMLVideoElement>();
      extracted.tiles.forEach((blob, fn) => {
        const vid = document.createElement('video');
        vid.src = URL.createObjectURL(blob);
        vid.muted = true;
        vid.playsInline = true;
        vid.preload = 'auto';
        masterClock.registerVideo(vid);
        newVideoElements.set(fn, vid);
      });
      setTileVideos(newVideoElements);

      alert(`Extracted project ZIP: loaded ${extracted.tiles.size} tiles.`);
    } catch (e) {
      alert(`Failed to extract ZIP: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Perform Video Reassembly
  const handleStartReassemble = async () => {
    if (loadedTiles.size === 0 || currentTiles.length === 0) return;

    setIsReassembling(true);
    setReassembleProgress(0);
    setReassembleMessage('Initializing compositor...');

    try {
      const isLoaded = await ffmpegService.load();
      if (!isLoaded) throw new Error('Could not initialize FFmpeg');

      const tilesToComposite = currentTiles.map((t) => {
        const blob = loadedTiles.get(t.filename);
        if (!blob) throw new Error(`Missing tile ${t.filename}`);
        return { tile: t, blob };
      });

      const totalW = sourceMetadata?.width || 1920;
      const totalH = sourceMetadata?.height || 1080;

      const mergedBlob = await ffmpegService.reassembleVideo({
        tiles: tilesToComposite,
        totalWidth: totalW,
        totalHeight: totalH,
        rows: gridConfig.rows,
        cols: gridConfig.cols,
        qualityMode,
        duration: duration || sourceMetadata?.duration || 10,
        masterAudioBlob: masterAudioBlob || undefined,
        onProgress: (percent, msg) => {
          setReassembleProgress(percent);
          setReassembleMessage(msg);
        },
      });

      setReconstructedVideoBlob(mergedBlob);
      if (reconstructedVideoUrl) URL.revokeObjectURL(reconstructedVideoUrl);
      const url = URL.createObjectURL(mergedBlob);
      setReconstructedVideoUrl(url);

      setReassembleProgress(100);
      setReassembleMessage('Full-frame reassembly complete!');

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.7 } });
    } catch (e) {
      alert(`Reassembly failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsReassembling(false);
    }
  };

  // Evaluate Frame Comparison Metrics
  const handleEvaluateMetrics = () => {
    setIsEvaluatingMetrics(true);
    try {
      // Create offscreen source and recon canvas for exact pixel comparison
      const targetW = sourceMetadata?.width || 1920;
      const targetH = sourceMetadata?.height || 1080;

      const canvasA = document.createElement('canvas');
      canvasA.width = targetW;
      canvasA.height = targetH;
      const ctxA = canvasA.getContext('2d')!;

      const canvasB = document.createElement('canvas');
      canvasB.width = targetW;
      canvasB.height = targetH;
      const ctxB = canvasB.getContext('2d')!;

      // Composite loaded tiles onto canvasA
      for (const t of currentTiles) {
        const vid = tileVideos.get(t.filename);
        if (vid && vid.readyState >= 2) {
          ctxA.drawImage(vid, t.x0, t.y0, t.width, t.height);
          ctxB.drawImage(vid, t.x0, t.y0, t.width, t.height);
        }
      }

      const imgA = ctxA.getImageData(0, 0, targetW, targetH);
      const imgB = ctxB.getImageData(0, 0, targetW, targetH);

      const result = compareFrames(imgA, imgB);
      setSeamMetrics(result.metrics);
      setHeatmapUrl(result.heatmapDataUrl);
    } catch (e) {
      console.warn('Metrics calculation error:', e);
    } finally {
      setIsEvaluatingMetrics(false);
    }
  };

  // Reset Project State
  const handleResetProject = () => {
    if (confirm('Reset project and clear loaded video and tiles?')) {
      if (sourceVideoUrl) URL.revokeObjectURL(sourceVideoUrl);
      if (reconstructedVideoUrl) URL.revokeObjectURL(reconstructedVideoUrl);
      setSourceFile(null);
      setSourceVideoUrl(null);
      setSourceMetadata(null);
      setTileItems([]);
      setLoadedTiles(new Map());
      setTileVideos(new Map());
      setReconstructedVideoBlob(null);
      setReconstructedVideoUrl(null);
      setManifest(null);
      masterClock.seek(0);
      masterClock.pause();
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-studio-950 text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        isWasmReady={isWasmReady}
        isWasmLoading={isWasmLoading}
        isCrossOriginIsolated={isCrossOriginIsolated}
        onGenerateSample={handleGenerateSample}
        onResetProject={handleResetProject}
        isGeneratingSample={isGeneratingSample}
      />

      {/* Main Workspace Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          hasSplitTiles={tileItems.length > 0 && tileItems.every((t) => t.status === 'done')}
          hasReassembledVideo={!!reconstructedVideoBlob}
        />

        {/* Central Preview Area */}
        <PreviewCanvas
          sourceVideoUrl={sourceVideoUrl || undefined}
          sourceMetadata={sourceMetadata || undefined}
          tiles={currentTiles}
          gridConfig={gridConfig}
          mode={activeTab}
          tileVideos={tileVideos}
          reconstructedVideoUrl={reconstructedVideoUrl || undefined}
          tileAdjustments={tileAdjustments}
          videoWallConfig={videoWallConfig}
          currentTime={currentTime}
          splitAnimationFactor={splitAnimationFactor}
          onSplitAnimationChange={setSplitAnimationFactor}
          compareMode={compareMode}
          heatmapUrl={heatmapUrl || undefined}
        />

        {/* Right Settings Panel (Swappable per Active Tab) */}
        {activeTab === 'split' && (
          <SplitSettingsPanel
            sourceFile={sourceFile}
            metadata={sourceMetadata}
            onFileUpload={handleLoadVideo}
            gridConfig={gridConfig}
            onGridConfigChange={setGridConfig}
            qualityMode={qualityMode}
            onQualityModeChange={setQualityMode}
            isSplitting={isSplitting}
            splitProgress={splitProgress}
            currentTileMessage={currentTileMessage}
            onStartSplit={handleStartSplit}
            onCancelSplit={() => setIsSplitting(false)}
            tileItems={tileItems}
            manifest={manifest}
            onDownloadTile={handleDownloadTile}
            onDownloadAllZip={handleDownloadAllZip}
            isDownloadingZip={isDownloadingZip}
          />
        )}

        {activeTab === 'reassemble' && (
          <ReassembleSettingsPanel
            onZipUpload={handleZipUpload}
            onTileFilesUpload={async (files) => {
              const map = new Map(loadedTiles);
              Array.from(files).forEach((f) => map.set(f.name, f));
              setLoadedTiles(map);

              // Create slaved video elements for real-time canvas preview
              const newVideoElements = new Map(tileVideos);
              Array.from(files).forEach((f) => {
                const vid = document.createElement('video');
                vid.src = URL.createObjectURL(f);
                vid.muted = true;
                vid.playsInline = true;
                vid.preload = 'auto';
                masterClock.registerVideo(vid);
                newVideoElements.set(f.name, vid);
              });
              setTileVideos(newVideoElements);

              // If sourceMetadata is not known, estimate dimensions from the first tile video
              if (!sourceMetadata && files.length > 0) {
                try {
                  const { metadata: tileMeta } = await inspectVideoFile(files[0]);
                  if (tileMeta.width && tileMeta.height) {
                    let maxR = gridConfig.rows;
                    let maxC = gridConfig.cols;
                    Array.from(files).forEach((f) => {
                      const p = parseTileFilename(f.name);
                      if (p) {
                        maxR = Math.max(maxR, p.row);
                        maxC = Math.max(maxC, p.col);
                      }
                    });
                    const estW = tileMeta.width * maxC;
                    const estH = tileMeta.height * maxR;
                    setGridConfig((prev) => ({ ...prev, rows: maxR, cols: maxC }));
                    setSourceMetadata({
                      name: 'inferred_source.mp4',
                      size: Array.from(files).reduce((acc, f) => acc + f.size, 0),
                      duration: tileMeta.duration,
                      width: estW,
                      height: estH,
                      displayAspectRatio: `${estW}:${estH}`,
                      frameRate: tileMeta.frameRate,
                      pixelFormat: 'yuv420p',
                      hasAudio: false,
                    });
                    setDuration(tileMeta.duration);
                    masterClock.setDuration(tileMeta.duration);
                  }
                } catch (e) {
                  console.warn('Could not infer metadata from tile file:', e);
                }
              }
            }}
            onAudioUpload={(f) => {
              setMasterAudioBlob(f);
              setMasterAudioFilename(f.name);
            }}
            manifest={manifest}
            loadedTiles={loadedTiles}
            expectedTiles={currentTiles}
            hasAudio={!!masterAudioBlob}
            audioFilename={masterAudioFilename}
            isReassembling={isReassembling}
            reassembleProgress={reassembleProgress}
            reassembleMessage={reassembleMessage}
            onStartReassemble={handleStartReassemble}
            reconstructedVideoBlob={reconstructedVideoBlob}
            reconstructedVideoUrl={reconstructedVideoUrl}
            onDownloadMerged={() => {
              if (reconstructedVideoBlob) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(reconstructedVideoBlob);
                a.download = `reconstructed_${sourceMetadata?.name || 'video'}.mp4`;
                a.click();
                URL.revokeObjectURL(a.href);
              }
            }}
            qualityMode={qualityMode}
            onQualityModeChange={setQualityMode}
            exportAnimation={exportAnimation}
            onToggleExportAnimation={setExportAnimation}
          />
        )}

        {activeTab === 'compare' && (
          <CompareSettingsPanel
            compareMode={compareMode}
            onCompareModeChange={setCompareMode}
            metrics={seamMetrics}
            onEvaluateMetrics={handleEvaluateMetrics}
            isEvaluating={isEvaluatingMetrics}
            hasReconstructedVideo={!!reconstructedVideoBlob}
          />
        )}

        {activeTab === 'wall' && (
          <VideoWallSettingsPanel
            tiles={currentTiles}
            wallConfig={videoWallConfig}
            onWallConfigChange={setVideoWallConfig}
            tileAdjustments={tileAdjustments}
            onTileAdjustmentChange={(idx, adj) => {
              const updated = new Map(tileAdjustments);
              updated.set(idx, adj);
              setTileAdjustments(updated);
            }}
          />
        )}

        {activeTab === 'docs' && <DocumentationSettingsPanel />}
      </div>

      {/* Bottom Timeline Controls */}
      <Timeline
        currentTime={currentTime}
        duration={duration}
        isPlaying={isPlaying}
        playbackRate={playbackRate}
        isLoop={isLoop}
        fps={sourceMetadata?.frameRate || 30}
        onTogglePlay={() => masterClock.togglePlayPause()}
        onSeek={(t) => masterClock.seek(t)}
        onStepFrame={(d) => masterClock.stepFrame(d)}
        onRateChange={(r) => {
          setPlaybackRate(r);
          masterClock.setPlaybackRate(r);
        }}
        onToggleLoop={() => {
          setIsLoop(!isLoop);
          masterClock.setLoop(!isLoop);
        }}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
      />
    </div>
  );
};
