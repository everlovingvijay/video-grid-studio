export type QualityMode = 'fast' | 'high' | 'lossless';

export type GridPreset = '2x2' | '3x3' | '4x4' | '5x5' | '3x5' | 'custom';

export interface VideoMetadata {
  name: string;
  size: number;
  duration: number;
  width: number;
  height: number;
  displayAspectRatio: string;
  frameRate: number;
  pixelFormat: string;
  hasAudio: boolean;
  audioChannels?: number;
  audioSampleRate?: number;
  orientation?: number | string;
  codec?: string;
}

export interface GridConfig {
  rows: number;
  cols: number;
  preset: GridPreset;
  isAsymmetric: boolean;
  customColumnRatios?: number[];
  customRowRatios?: number[];
}

export interface TileBoundary {
  row: number; // 0-based
  col: number; // 0-based
  index: number; // 0 to (R*C - 1)
  x0: number; // inclusive
  x1: number; // exclusive
  y0: number; // inclusive
  y1: number; // exclusive
  width: number;
  height: number;
  filename: string; // e.g. tile_r01_c01.mp4
}

export interface TileManifestItem {
  index: number;
  row: number; // 1-based in manifest for human readability
  col: number; // 1-based in manifest
  filename: string;
  crop: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    width: number;
    height: number;
  };
  dimensions: {
    width: number;
    height: number;
  };
  duration: number;
  hash: string;
  size: number;
}

export interface ProjectManifest {
  version: string;
  application: string;
  generatedAt: string;
  source: {
    filename: string;
    width: number;
    height: number;
    duration: number;
    fps: number;
    timebase?: string;
    orientation?: number | string;
    pixelFormat?: string;
    hasAudio: boolean;
  };
  grid: {
    rows: number;
    cols: number;
    totalTiles: number;
    isAsymmetric: boolean;
  };
  codecSettings: {
    qualityMode: QualityMode;
    videoCodec: string;
    preset?: string;
    crf?: number;
  };
  masterAudio: {
    present: boolean;
    filename?: string;
    channels?: number;
    sampleRate?: number;
    duration?: number;
  };
  tiles: TileManifestItem[];
}

export interface TileProcessingItem {
  tile: TileBoundary;
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  blob?: Blob;
  blobUrl?: string;
  size?: number;
  hash?: string;
  error?: string;
  elapsedMs?: number;
}

export interface TileAdjustment {
  brightness: number; // -100 to 100
  contrast: number;   // -100 to 100
  saturation: number; // -100 to 100
  rotation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  replacedBlob?: Blob;
  replacedUrl?: string;
}

export interface SeamMetrics {
  psnr: number;
  ssim: number;
  mse: number;
  maxPixelDiff: number;
  seamDiscontinuity: number;
  evaluatedFramesCount: number;
}

export interface VideoWallConfig {
  bezelCompensationX: number; // mm or px
  bezelCompensationY: number;
  showCalibrationPattern: boolean;
  patternType: 'smpte' | 'grid' | 'crosshair' | 'checkerboard';
  showTileLabels: boolean;
}
