import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { TileBoundary, QualityMode, VideoMetadata } from '../types/video';

export interface FFmpegProgress {
  ratio: number;
  time: number;
}

export type ProgressCallback = (percent: number, message: string) => void;

class FFmpegService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;
  private isLoading = false;
  private recentLogs: string[] = [];
  private abortController: AbortController | null = null;
  private currentProgressCallback: ProgressCallback | null = null;
  private expectedDurationSeconds: number = 0;

  private handleEncodingProgress(ratio: number, details?: string) {
    if (!this.currentProgressCallback) return;
    const boundedRatio = Math.max(0, Math.min(1, ratio));
    // Map compositing phase to 40% -> 94%
    const mapped = Math.round(40 + boundedRatio * 54);
    const msg = details || `Compositing video frames (${Math.round(boundedRatio * 100)}%)...`;
    this.currentProgressCallback(mapped, msg);
  }

  public isCrossOriginIsolated(): boolean {
    return typeof crossOriginIsolated !== 'undefined' && crossOriginIsolated;
  }

  public isReady(): boolean {
    return this.isLoaded && this.ffmpeg !== null;
  }

  /**
   * Initializes FFmpeg with local single-threaded or multi-threaded WASM core.
   */
  public async load(onProgress?: (progress: number) => void): Promise<boolean> {
    if (this.isLoaded) return true;
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise((r) => setTimeout(r, 100));
      }
      return this.isLoaded;
    }

    this.isLoading = true;
    try {
      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('progress', ({ progress }) => {
        if (progress > 0 && progress <= 1) {
          this.handleEncodingProgress(progress);
        } else if (onProgress) {
          onProgress(Math.min(100, Math.round(progress * 100)));
        }
      });

      this.ffmpeg.on('log', ({ message }) => {
        this.recentLogs.push(message);
        if (this.recentLogs.length > 50) this.recentLogs.shift();

        // Parse encoding progress from ffmpeg log: time=HH:MM:SS.ms and frame=NN
        if (this.currentProgressCallback && message.includes('time=')) {
          const match = message.match(/time=(\d+):(\d+):([0-9.]+)/);
          if (match) {
            const h = parseFloat(match[1]);
            const m = parseFloat(match[2]);
            const s = parseFloat(match[3]);
            const currentSec = h * 3600 + m * 60 + s;
            const speedMatch = message.match(/speed=\s*([0-9.]+x)/);
            const speed = speedMatch ? speedMatch[1] : '';
            const frameMatch = message.match(/frame=\s*(\d+)/);
            const frame = frameMatch ? frameMatch[1] : '';

            if (this.expectedDurationSeconds > 0) {
              const ratio = Math.min(1, currentSec / this.expectedDurationSeconds);
              const speedText = speed ? ` • ${speed}` : '';
              const frameText = frame ? `Frame ${frame}` : `${currentSec.toFixed(1)}s`;
              this.handleEncodingProgress(
                ratio,
                `Compositing: ${frameText} / ${this.expectedDurationSeconds.toFixed(1)}s (${Math.round(ratio * 100)}%${speedText})`
              );
            }
          }
        }

        if (message.includes('Error') || message.includes('failed') || message.includes('Invalid')) {
          console.warn('[FFmpeg Log]', message);
        }
      });

      // Base path for public assets
      const base = (import.meta.env.BASE_URL || './').replace(/\/$/, '');
      const coreDir = `${base}/ffmpeg`;

      const coreURL = await toBlobURL(`${coreDir}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${coreDir}/ffmpeg-core.wasm`, 'application/wasm');

      await this.ffmpeg.load({
        coreURL,
        wasmURL,
      });

      this.isLoaded = true;
      return true;
    } catch (err) {
      console.warn('Local FFmpeg WASM load failed, checking fallback:', err);
      // Try CDN fallback if local asset load had an origin or path issue
      try {
        if (!this.ffmpeg) this.ffmpeg = new FFmpeg();
        const cdnBase = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        const coreURL = await toBlobURL(`${cdnBase}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${cdnBase}/ffmpeg-core.wasm`, 'application/wasm');
        await this.ffmpeg.load({ coreURL, wasmURL });
        this.isLoaded = true;
        return true;
      } catch (cdnErr) {
        console.error('All FFmpeg loaders failed:', cdnErr);
        this.isLoaded = false;
        return false;
      }
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Pre-loads the source video into virtual filesystem once for the whole splitting session.
   * This avoids re-uploading and allocating large buffers repeatedly across multiple tiles.
   */
  public async prepareSourceVideo(sourceBlob: Blob): Promise<string> {
    if (!this.isLoaded || !this.ffmpeg) {
      throw new Error('FFmpeg is not initialized');
    }
    const inputName = 'shared_source.mp4';
    const inputData = new Uint8Array(await sourceBlob.arrayBuffer());
    await this.ffmpeg.writeFile(inputName, inputData);
    return inputName;
  }

  public async cleanupSourceVideo(inputName: string = 'shared_source.mp4'): Promise<void> {
    if (!this.ffmpeg) return;
    await this.ffmpeg.deleteFile(inputName).catch(() => {});
  }

  /**
   * Extracts master audio track from source video.
   * Audio is preserved ONCE without duplicating in each tile.
   */
  public async extractMasterAudio(
    source: Blob | string,
    onProgress?: ProgressCallback
  ): Promise<{ audioBlob: Blob; filename: string } | null> {
    if (!this.isLoaded || !this.ffmpeg) {
      throw new Error('FFmpeg is not initialized');
    }

    onProgress?.(10, 'Reading source audio stream...');
    const outputName = 'master_audio.aac';
    let inputName = 'audio_source.mp4';
    let needsCleanup = true;

    if (typeof source === 'string') {
      inputName = source;
      needsCleanup = false;
    } else {
      const buffer = new Uint8Array(await source.arrayBuffer());
      await this.ffmpeg.writeFile(inputName, buffer);
    }

    try {
      onProgress?.(30, 'Extracting master audio track...');
      // Extract audio without video (-vn)
      const exitCode = await this.ffmpeg.exec([
        '-i', inputName,
        '-vn',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputName,
      ]);

      if (exitCode !== 0) {
        console.warn('Audio extraction exited with non-zero code, source may be silent');
        if (needsCleanup) await this.ffmpeg.deleteFile(inputName).catch(() => {});
        return null;
      }

      onProgress?.(90, 'Packaging master audio file...');
      const audioData = (await this.ffmpeg.readFile(outputName)) as Uint8Array;
      const audioBlob = new Blob([new Uint8Array(audioData)], { type: 'audio/aac' });

      if (needsCleanup) await this.ffmpeg.deleteFile(inputName).catch(() => {});
      await this.ffmpeg.deleteFile(outputName).catch(() => {});

      return {
        audioBlob,
        filename: outputName,
      };
    } catch (e) {
      console.warn('Source video does not contain audio or extraction failed:', e);
      if (needsCleanup) await this.ffmpeg.deleteFile(inputName).catch(() => {});
      return null;
    }
  }

  /**
   * Spatially crops and exports a single tile from the source video.
   */
  public async splitTile(params: {
    source: Blob | string;
    tile: TileBoundary;
    sourceWidth?: number;
    sourceHeight?: number;
    qualityMode: QualityMode;
    onProgress?: ProgressCallback;
  }): Promise<Blob> {
    if (!this.isLoaded || !this.ffmpeg) {
      throw new Error('FFmpeg is not initialized');
    }

    const { source, tile, sourceWidth, sourceHeight, qualityMode, onProgress } = params;
    let inputName = `split_in_${tile.index}.mp4`;
    let needsCleanup = true;

    if (typeof source === 'string') {
      inputName = source;
      needsCleanup = false;
    } else {
      onProgress?.(10, `Loading frame buffer for Tile R${tile.row + 1}:C${tile.col + 1}...`);
      const inputData = new Uint8Array(await source.arrayBuffer());
      await this.ffmpeg.writeFile(inputName, inputData);
    }

    // Build crop filter. If sourceWidth and sourceHeight are provided,
    // scale to exact source dimensions first to prevent orientation or container size mismatches.
    let filter = '';
    if (sourceWidth && sourceHeight && sourceWidth > 0 && sourceHeight > 0) {
      filter += `scale=${sourceWidth}:${sourceHeight},`;
    }
    filter += `crop=${tile.width}:${tile.height}:${tile.x0}:${tile.y0}`;

    const targetW = Math.ceil(tile.width / 2) * 2;
    const targetH = Math.ceil(tile.height / 2) * 2;
    if (targetW !== tile.width || targetH !== tile.height) {
      filter += `,pad=${targetW}:${targetH}:0:0:color=black`;
    }

    // Encoder settings based on QualityMode
    const encoderArgs: string[] = [];
    if (qualityMode === 'fast') {
      encoderArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26');
    } else if (qualityMode === 'high') {
      encoderArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '18');
    } else {
      // Lossless mode
      encoderArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '0');
    }

    onProgress?.(30, `Encoding ${tile.width}x${tile.height} tile...`);

    const outputName = tile.filename;
    const execArgs = [
      '-i', inputName,
      '-filter:v', filter,
      ...encoderArgs,
      '-an', // No audio in tiles to prevent duplication
      '-dn', // No data streams
      '-sn', // No subtitle streams
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputName,
    ];

    const code = await this.ffmpeg.exec(execArgs);
    if (code !== 0) {
      if (needsCleanup) await this.ffmpeg.deleteFile(inputName).catch(() => {});
      const errorMsg = this.recentLogs.slice(-10).join(' ') || `code ${code}`;
      throw new Error(`FFmpeg error cropping tile ${tile.filename}: ${errorMsg}`);
    }

    onProgress?.(90, `Finalizing tile ${tile.filename}...`);
    const tileData = (await this.ffmpeg.readFile(outputName)) as Uint8Array;
    const tileBlob = new Blob([new Uint8Array(tileData)], { type: 'video/mp4' });

    // Cleanup FFmpeg virtual files to prevent memory leak
    if (needsCleanup) await this.ffmpeg.deleteFile(inputName).catch(() => {});
    await this.ffmpeg.deleteFile(outputName).catch(() => {});

    onProgress?.(100, `Tile ${tile.filename} complete`);
    return tileBlob;
  }

  /**
   * Reassembles tiles back into a single full-resolution video using FFmpeg filter_complex.
   */
  public async reassembleVideo(params: {
    tiles: { tile: TileBoundary; blob: Blob }[];
    totalWidth: number;
    totalHeight: number;
    rows: number;
    cols: number;
    qualityMode: QualityMode;
    duration?: number;
    masterAudioBlob?: Blob;
    onProgress?: ProgressCallback;
  }): Promise<Blob> {
    if (!this.isLoaded || !this.ffmpeg) {
      throw new Error('FFmpeg is not initialized');
    }

    const { tiles, totalWidth, totalHeight, rows, cols, qualityMode, duration, masterAudioBlob, onProgress } = params;

    this.currentProgressCallback = onProgress || null;
    this.expectedDurationSeconds = duration && duration > 0 ? duration : 10;

    const tileFileNames: string[] = [];
    const outputName = 'reconstructed_video.mp4';

    try {
      onProgress?.(5, 'Preparing tile buffers for reassembly...');

      const inputArgs: string[] = [];

      // Sort tiles by row then col
      const sortedTiles = [...tiles].sort((a, b) => {
        if (a.tile.row !== b.tile.row) return a.tile.row - b.tile.row;
        return a.tile.col - b.tile.col;
      });

      for (let i = 0; i < sortedTiles.length; i++) {
        const item = sortedTiles[i];
        const fn = `reassemble_tile_${i}.mp4`;
        tileFileNames.push(fn);
        const data = new Uint8Array(await item.blob.arrayBuffer());
        await this.ffmpeg.writeFile(fn, data);
        inputArgs.push('-i', fn);
      }

      let hasAudioInput = false;
      if (masterAudioBlob) {
        const audioFn = 'reassemble_audio.aac';
        const audioData = new Uint8Array(await masterAudioBlob.arrayBuffer());
        await this.ffmpeg.writeFile(audioFn, audioData);
        inputArgs.push('-i', audioFn);
        tileFileNames.push(audioFn);
        hasAudioInput = true;
      }

      onProgress?.(25, 'Constructing seamless multi-tile compositor filter...');

      // Composite tiles at exact original coordinates using xstack with :shortest=1:fill=black
      // - shortest=1 ensures xstack cleanly finishes when the video stream ends rather than stalling
      // - fill=black guarantees neutral black for any microscopic boundary rather than uninitialized green
      const layoutPieces: string[] = [];
      for (let i = 0; i < sortedTiles.length; i++) {
        const t = sortedTiles[i].tile;
        layoutPieces.push(`${t.x0}_${t.y0}`);
      }

      const totalVideoInputs = sortedTiles.length;
      const streamInputs = Array.from({ length: totalVideoInputs }, (_, i) => `[${i}:v]`).join('');
      const layoutStr = layoutPieces.join('|');
      const filterComplex = `${streamInputs}xstack=inputs=${totalVideoInputs}:layout=${layoutStr}:shortest=1:fill=black[outv]`;

      const encoderArgs: string[] = [];
      if (qualityMode === 'fast') {
        encoderArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24');
      } else if (qualityMode === 'high') {
        encoderArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18');
      } else {
        encoderArgs.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '0');
      }

      const execArgs: string[] = [
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[outv]',
      ];

      if (hasAudioInput) {
        // Map audio track optionally to prevent failure if audio stream has no packets
        const audioIndex = totalVideoInputs;
        execArgs.push('-map', `${audioIndex}:a?`, '-c:a', 'aac', '-b:a', '192k', '-shortest');
      }

      execArgs.push(
        ...encoderArgs,
        '-dn', // Discard data streams
        '-sn', // Discard subtitle streams
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outputName
      );

      onProgress?.(40, `Compositing ${sortedTiles.length} tiles to ${totalWidth}x${totalHeight}...`);

      const code = await this.ffmpeg.exec(execArgs);
      if (code !== 0) {
        const errorMsg = this.recentLogs.slice(-10).join(' ') || `code ${code}`;
        throw new Error(`FFmpeg reassembly failed: ${errorMsg}`);
      }

      onProgress?.(95, 'Reading merged full-frame video...');
      const resultData = (await this.ffmpeg.readFile(outputName)) as Uint8Array;
      const resultBlob = new Blob([new Uint8Array(resultData)], { type: 'video/mp4' });

      onProgress?.(100, 'Reassembly complete');
      return resultBlob;
    } finally {
      this.currentProgressCallback = null;
      this.expectedDurationSeconds = 0;

      // Cleanup virtual files
      for (const fn of tileFileNames) {
        await this.ffmpeg.deleteFile(fn).catch(() => {});
      }
      await this.ffmpeg.deleteFile(outputName).catch(() => {});
    }
  }
}

export const ffmpegService = new FFmpegService();
