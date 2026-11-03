import { describe, it, expect } from 'vitest';
import {
  computeGridBoundaries,
  validateGridGeometry,
  formatTileFilename,
  parseTileFilename,
} from '../src/services/gridCalculator';

describe('gridCalculator - Mathematical & Geometric Precision', () => {
  it('1920x1080 3x3 grid produces exactly nine 640x360 tiles', () => {
    const tiles = computeGridBoundaries(1920, 1080, {
      rows: 3,
      cols: 3,
      preset: '3x3',
      isAsymmetric: false,
    });

    expect(tiles).toHaveLength(9);

    tiles.forEach((tile) => {
      expect(tile.width).toBe(640);
      expect(tile.height).toBe(360);
      expect(tile.x1 - tile.x0).toBe(640);
      expect(tile.y1 - tile.y0).toBe(360);
    });

    // Check filenames
    expect(tiles[0].filename).toBe('tile_r01_c01.mp4');
    expect(tiles[8].filename).toBe('tile_r03_c03.mp4');

    const validation = validateGridGeometry(tiles, 1920, 1080);
    expect(validation.valid).toBe(true);
    expect(validation.totalArea).toBe(1920 * 1080);
    expect(validation.errors).toHaveLength(0);
  });

  it('4x4 grid reconstructs without geometric gaps', () => {
    const tiles = computeGridBoundaries(1920, 1080, {
      rows: 4,
      cols: 4,
      preset: '4x4',
      isAsymmetric: false,
    });

    expect(tiles).toHaveLength(16);

    const validation = validateGridGeometry(tiles, 1920, 1080);
    expect(validation.valid).toBe(true);
    expect(validation.totalArea).toBe(1920 * 1080);
    expect(validation.errors).toHaveLength(0);
  });

  it('custom 3x5 grid reconstructs without geometric gaps', () => {
    const tiles = computeGridBoundaries(1920, 1080, {
      rows: 3,
      cols: 5,
      preset: '3x5',
      isAsymmetric: false,
    });

    expect(tiles).toHaveLength(15);

    const validation = validateGridGeometry(tiles, 1920, 1080);
    expect(validation.valid).toBe(true);
    expect(validation.totalArea).toBe(1920 * 1080);
    expect(validation.errors).toHaveLength(0);
  });

  it('1921x1081 odd dimensions: covers all source pixels exactly once and restores dimensions exactly', () => {
    const W = 1921;
    const H = 1081;
    const tiles = computeGridBoundaries(W, H, {
      rows: 3,
      cols: 3,
      preset: '3x3',
      isAsymmetric: false,
    });

    expect(tiles).toHaveLength(9);

    // Verify non-divisible sizes produce tiles differing by at most one pixel
    const widths = tiles.map((t) => t.width);
    const minW = Math.min(...widths);
    const maxW = Math.max(...widths);
    expect(maxW - minW).toBeLessThanOrEqual(1);

    const heights = tiles.map((t) => t.height);
    const minH = Math.min(...heights);
    const maxH = Math.max(...heights);
    expect(maxH - minH).toBeLessThanOrEqual(1);

    // Verify deterministic pixel coordinates
    // c=0: x0=0, x1=floor(1921/3)=640
    // c=1: x0=640, x1=floor(3842/3)=1280
    // c=2: x0=1280, x1=1921
    expect(tiles[0].x0).toBe(0);
    expect(tiles[0].x1).toBe(640);
    expect(tiles[1].x0).toBe(640);
    expect(tiles[1].x1).toBe(1280);
    expect(tiles[2].x0).toBe(1280);
    expect(tiles[2].x1).toBe(1921);

    const validation = validateGridGeometry(tiles, W, H);
    expect(validation.valid).toBe(true);
    expect(validation.coveredWidth).toBe(W);
    expect(validation.coveredHeight).toBe(H);
    expect(validation.totalArea).toBe(W * H);
    expect(validation.errors).toHaveLength(0);
  });

  it('custom asymmetric grid cuts partition source exactly', () => {
    const tiles = computeGridBoundaries(1000, 800, {
      rows: 2,
      cols: 3,
      preset: 'custom',
      isAsymmetric: true,
      customColumnRatios: [0.2, 0.5, 0.3], // 200px, 500px, 300px
      customRowRatios: [0.4, 0.6],         // 320px, 480px
    });

    expect(tiles).toHaveLength(6);
    expect(tiles[0].width).toBe(200);
    expect(tiles[0].height).toBe(320);

    const validation = validateGridGeometry(tiles, 1000, 800);
    expect(validation.valid).toBe(true);
    expect(validation.totalArea).toBe(800000);
  });

  it('portrait 576x1024 3x3 grid with chroma alignment produces even tile dimensions with zero gaps', () => {
    const tiles = computeGridBoundaries(576, 1024, {
      rows: 3,
      cols: 3,
      preset: '3x3',
      isAsymmetric: false,
      chromaAligned: true,
    });

    expect(tiles).toHaveLength(9);

    // Every tile must have even width and height for YUV420p chroma alignment
    tiles.forEach((t) => {
      expect(t.width % 2).toBe(0);
      expect(t.height % 2).toBe(0);
      expect(t.x0 % 2).toBe(0);
      expect(t.y0 % 2).toBe(0);
    });

    // Heights are 342, 340, 342 -> 342+340+342 = 1024
    expect(tiles[0].height).toBe(342);
    expect(tiles[3].height).toBe(340);
    expect(tiles[6].height).toBe(342);

    const validation = validateGridGeometry(tiles, 576, 1024);
    expect(validation.valid).toBe(true);
    expect(validation.totalArea).toBe(576 * 1024);
    expect(validation.errors).toHaveLength(0);
  });

  it('detects invalid, overlapping, or gapped grids', () => {
    const tiles = computeGridBoundaries(100, 100, {
      rows: 2,
      cols: 2,
      preset: '2x2',
      isAsymmetric: false,
    });

    // Artificially corrupt one tile coordinate to induce overlap
    tiles[0].x1 = 60; // Was 50, now overlaps with tile 1 (x0: 50)
    tiles[0].width = 60;

    const validation = validateGridGeometry(tiles, 100, 100);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('collision'))).toBe(true);
  });

  it('parses and formats standard tile filenames correctly', () => {
    expect(formatTileFilename(1, 1)).toBe('tile_r01_c01.mp4');
    expect(formatTileFilename(3, 4, 'webm')).toBe('tile_r03_c04.webm');

    const parsed = parseTileFilename('tile_r02_c03.mp4');
    expect(parsed).toEqual({ row: 2, col: 3 });

    const invalid = parseTileFilename('my_arbitrary_video.mp4');
    expect(invalid).toBeNull();
  });
});
