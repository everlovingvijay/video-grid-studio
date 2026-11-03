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
  private abortController: AbortController | null = null;

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

      this.ffmpeg.on('progress', ({ progress, time }) => {
        if (onProgress) {
          onProgress(Math.min(100, Math.round(progress * 100)));
        }
      });

      this.ffmpeg.on('log', ({ message }) => {
        // Helpful for debugging video operations
        if (message.includes('Error') || message.includes('failed')) {
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
   * Extracts master audio track from source video.
   * Audio is preserved ONCE without duplicating in each tile.
   */
  public async extractMasterAudio(
    sourceBlob: Blob,
    onProgress?: ProgressCallback
  ): Promise<{ audioBlob: Blob; filename: string } | null> {
    if (!this.isLoaded || !this.ffmpeg) {
      throw new Error('FFmpeg is not initialized');
    }

    onProgress?.(10, 'Reading source audio stream...');
    const inputName = 'audio_source.mp4';
    const outputName = 'master_audio.aac';

    try {
      const buffer = new Uint8Array(await sourceBlob.arrayBuffer());
      await this.ffmpeg.writeFile(inputName, buffer);

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
        await this.ffmpeg.deleteFile(inputName).catch(() => {});
        return null;
      }

      onProgress?.(90, 'Packaging master audio file...');
      const audioData = (await this.ffmpeg.readFile(outputName)) as Uint8Array;
      const audioBlob = new Blob([new Uint8Array(audioData)], { type: 'audio/aac' });

      await this.ffmpeg.deleteFile(inputName).catch(() => {});
      await this.ffmpeg.deleteFile(outputName).catch(() => {});

      return {
        audioBlob,
        filename: outputName,
      };
    } catch (e) {
      console.warn('Source video does not contain audio or extraction failed:', e);
      return null;
    }
  }

  /**
   * Spatially crops and exports a single tile from the source video.
   */
  public async splitTile(params: {
    sourceBlob: Blob;
    tile: TileBoundary;
    qualityMode: QualityMode;
    onProgress?: ProgressCallback;
  }): Promise<Blob> {
    if (!this.isLoaded || !this.ffmpeg) {
      throw new Error('FFmpeg is not initialized');
    }

    const { sourceBlob, tile, qualityMode, onProgress } = params;
    const inputName = `split_in_${tile.index}.mp4`;
    const outputName = tile.filename;

    onProgress?.(10, `Loading frame buffer for Tile R${tile.row + 1}:C${tile.col + 1}...`);
    const inputData = new Uint8Array(await sourceBlob.arrayBuffer());
    await this.ffmpeg.writeFile(inputName, inputData);

    // Build crop filter: crop=w:h:x:y
    const cropFilter = `crop=${tile.width}:${tile.height}:${tile.x0}:${tile.y0}`;

    // Encoder settings based on QualityMode
    const encoderArgs: string[] = [];
    if (qualityMode === 'fast') {
      encoderArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26');
    } else if (qualityMode === 'high') {
      encoderArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18');
    } else {
      // Lossless mode
      encoderArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '0');
    }

    onProgress?.(30, `Encoding ${tile.width}x${tile.height} tile...`);

    // Note: PDF requires "do not duplicate audio in each tile" -> -an (audio none)
    const execArgs = [
      '-i', inputName,
      '-filter:v', cropFilter,
      ...encoderArgs,
      '-an', // No audio in tiles to prevent duplication
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputName,
    ];

    const code = await this.ffmpeg.exec(execArgs);
    if (code !== 0) {
      await this.ffmpeg.deleteFile(inputName).catch(() => {});
      throw new Error(`FFmpeg error cropping tile ${tile.filename} (code ${code})`);
    }

    onProgress?.(90, `Finalizing tile ${tile.filename}...`);
    const tileData = (await this.ffmpeg.readFile(outputName)) as Uint8Array;
    const tileBlob = new Blob([new Uint8Array(tileData)], { type: 'video/mp4' });

    // Cleanup FFmpeg virtual files to prevent memory leak
    await this.ffmpeg.deleteFile(inputName).catch(() => {});
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
    masterAudioBlob?: Blob;
    onProgress?: ProgressCallback;
  }): Promise<Blob> {
    if (!this.isLoaded || !this.ffmpeg) {
      throw new Error('FFmpeg is not initialized');
    }

    const { tiles, totalWidth, totalHeight, rows, cols, qualityMode, masterAudioBlob, onProgress } = params;

    onProgress?.(5, 'Preparing tile buffers for reassembly...');

    const inputArgs: string[] = [];
    const tileFileNames: string[] = [];

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

    onProgress?.(20, 'Constructing seamless multi-tile compositor filter...');

    // Use xstack or overlay chain to composite tiles at EXACT original coordinates
    // Using xstack if regular grid, or overlay chain for arbitrary/asymmetric coordinates
    let filterComplex = '';
    const layoutPieces: string[] = [];

    for (let i = 0; i < sortedTiles.length; i++) {
      const t = sortedTiles[i].tile;
      layoutPieces.push(`${t.x0}_${t.y0}`);
    }

    const totalVideoInputs = sortedTiles.length;
    const streamInputs = Array.from({ length: totalVideoInputs }, (_, i) => `[${i}:v]`).join('');
    const layoutStr = layoutPieces.join('|');
    filterComplex = `${streamInputs}xstack=inputs=${totalVideoInputs}:layout=${layoutStr}[outv]`;

    const encoderArgs: string[] = [];
    if (qualityMode === 'fast') {
      encoderArgs.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24');
    } else if (qualityMode === 'high') {
      encoderArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18');
    } else {
      encoderArgs.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '0');
    }

    const outputName = 'reconstructed_video.mp4';
    const execArgs: string[] = [
      ...inputArgs,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
    ];

    if (hasAudioInput) {
      // Map audio track from the last input
      const audioIndex = totalVideoInputs;
      execArgs.push('-map', `${audioIndex}:a`, '-c:a', 'aac', '-b:a', '192k', '-shortest');
    }

    execArgs.push(
      ...encoderArgs,
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputName
    );

    onProgress?.(40, `Compositing ${sortedTiles.length} tiles to ${totalWidth}x${totalHeight}...`);

    const code = await this.ffmpeg.exec(execArgs);
    if (code !== 0) {
      // Cleanup files
      for (const fn of tileFileNames) {
        await this.ffmpeg.deleteFile(fn).catch(() => {});
      }
      throw new Error(`FFmpeg reassembly failed with code ${code}`);
    }

    onProgress?.(95, 'Reading merged full-frame video...');
    const resultData = (await this.ffmpeg.readFile(outputName)) as Uint8Array;
    const resultBlob = new Blob([new Uint8Array(resultData)], { type: 'video/mp4' });

    // Cleanup
    for (const fn of tileFileNames) {
      await this.ffmpeg.deleteFile(fn).catch(() => {});
    }
    await this.ffmpeg.deleteFile(outputName).catch(() => {});

    onProgress?.(100, 'Reassembly complete');
    return resultBlob;
  }
}

export const ffmpegService = new FFmpegService();
