import { ProjectManifest, TileManifestItem, VideoMetadata, GridConfig, QualityMode, TileProcessingItem } from '../types/video';
import { validateGridGeometry } from './gridCalculator';

/**
 * Computes SHA-256 hash of a Blob/ArrayBuffer using Web Crypto API.
 */
export async function computeBlobHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a standard ProjectManifest for export in ZIP.
 */
export async function createProjectManifest(params: {
  source: VideoMetadata;
  gridConfig: GridConfig;
  qualityMode: QualityMode;
  tiles: TileProcessingItem[];
  masterAudioFilename?: string;
  hasAudio: boolean;
}): Promise<ProjectManifest> {
  const { source, gridConfig, qualityMode, tiles, masterAudioFilename, hasAudio } = params;

  const manifestTiles: TileManifestItem[] = [];

  for (const item of tiles) {
    const t = item.tile;
    let hash = item.hash;
    if (!hash && item.blob) {
      hash = await computeBlobHash(item.blob);
    }

    manifestTiles.push({
      index: t.index,
      row: t.row + 1, // 1-based in manifest for human readability
      col: t.col + 1,
      filename: t.filename,
      crop: {
        x0: t.x0,
        y0: t.y0,
        x1: t.x1,
        y1: t.y1,
        width: t.width,
        height: t.height,
      },
      dimensions: {
        width: t.width,
        height: t.height,
      },
      duration: source.duration,
      hash: hash || '',
      size: item.size || item.blob?.size || 0,
    });
  }

  return {
    version: '1.0.0',
    application: 'Video Grid Studio',
    generatedAt: new Date().toISOString(),
    source: {
      filename: source.name,
      width: source.width,
      height: source.height,
      duration: source.duration,
      fps: source.frameRate,
      timebase: `1/${Math.round(source.frameRate || 30)}`,
      orientation: source.orientation || 0,
      pixelFormat: source.pixelFormat || 'yuv420p',
      hasAudio: hasAudio && source.hasAudio,
    },
    grid: {
      rows: gridConfig.rows,
      cols: gridConfig.cols,
      totalTiles: gridConfig.rows * gridConfig.cols,
      isAsymmetric: gridConfig.isAsymmetric,
    },
    codecSettings: {
      qualityMode,
      videoCodec: qualityMode === 'lossless' ? 'raw/lossless' : 'H.264 / AVC',
      preset: qualityMode === 'fast' ? 'ultrafast' : 'medium',
      crf: qualityMode === 'fast' ? 26 : qualityMode === 'high' ? 18 : 0,
    },
    masterAudio: {
      present: !!masterAudioFilename,
      filename: masterAudioFilename,
      channels: source.audioChannels,
      sampleRate: source.audioSampleRate,
      duration: source.duration,
    },
    tiles: manifestTiles,
  };
}

export interface ManifestValidationResult {
  valid: boolean;
  manifest?: ProjectManifest;
  errors: string[];
  warnings: string[];
}

/**
 * Validates the parsed manifest object against specification requirements.
 */
export function validateManifest(rawJson: unknown): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawJson || typeof rawJson !== 'object') {
    return { valid: false, errors: ['Manifest is not a valid JSON object'], warnings };
  }

  const manifest = rawJson as Partial<ProjectManifest>;

  if (!manifest.version) {
    warnings.push('Manifest version missing, assuming 1.0.0');
  }

  if (!manifest.source) {
    errors.push('Manifest source definition is missing');
  } else {
    if (typeof manifest.source.width !== 'number' || manifest.source.width <= 0) {
      errors.push('Invalid or missing source width');
    }
    if (typeof manifest.source.height !== 'number' || manifest.source.height <= 0) {
      errors.push('Invalid or missing source height');
    }
    if (typeof manifest.source.duration !== 'number' || manifest.source.duration <= 0) {
      errors.push('Invalid or missing source duration');
    }
  }

  if (!manifest.grid) {
    errors.push('Manifest grid configuration is missing');
  } else {
    if (typeof manifest.grid.rows !== 'number' || manifest.grid.rows <= 0) {
      errors.push('Invalid grid rows');
    }
    if (typeof manifest.grid.cols !== 'number' || manifest.grid.cols <= 0) {
      errors.push('Invalid grid cols');
    }
  }

  if (!Array.isArray(manifest.tiles)) {
    errors.push('Manifest tiles list is missing or not an array');
  } else {
    const expectedCount = (manifest.grid?.rows || 0) * (manifest.grid?.cols || 0);
    if (manifest.tiles.length !== expectedCount && expectedCount > 0) {
      errors.push(`Tile count mismatch: expected ${expectedCount} tiles, found ${manifest.tiles.length}`);
    }

    // Convert tiles to TileBoundary for geometric check
    if (manifest.source?.width && manifest.source?.height) {
      const boundaries = manifest.tiles.map((t, idx) => ({
        row: (t.row ?? 1) - 1,
        col: (t.col ?? 1) - 1,
        index: t.index ?? idx,
        x0: t.crop?.x0 ?? 0,
        y0: t.crop?.y0 ?? 0,
        x1: t.crop?.x1 ?? (t.crop?.x0 ?? 0) + (t.dimensions?.width ?? 0),
        y1: t.crop?.y1 ?? (t.crop?.y0 ?? 0) + (t.dimensions?.height ?? 0),
        width: t.dimensions?.width ?? (t.crop?.x1 ?? 0) - (t.crop?.x0 ?? 0),
        height: t.dimensions?.height ?? (t.crop?.y1 ?? 0) - (t.crop?.y0 ?? 0),
        filename: t.filename ?? `tile_${idx}.mp4`,
      }));

      const geo = validateGridGeometry(boundaries, manifest.source.width, manifest.source.height);
      if (!geo.valid) {
        errors.push(...geo.errors);
      }
    }
  }

  if (manifest.masterAudio?.present && !manifest.masterAudio.filename) {
    warnings.push('Master audio marked present, but audio filename is missing');
  }

  return {
    valid: errors.length === 0,
    manifest: errors.length === 0 ? (manifest as ProjectManifest) : undefined,
    errors,
    warnings,
  };
}
