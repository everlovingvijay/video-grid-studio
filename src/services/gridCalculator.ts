import { GridConfig, TileBoundary } from '../types/video';

/**
 * Deterministically compute integer pixel boundaries for a grid partition.
 * x0 = floor(c * W / C), x1 = floor((c + 1) * W / C)
 * y0 = floor(r * H / R), y1 = floor((r + 1) * H / R)
 *
 * Each pixel belongs to exactly one tile; non-divisible sizes produce
 * tiles differing by at most one pixel.
 */
export function computeGridBoundaries(
  width: number,
  height: number,
  config: GridConfig,
  fileExtension: string = 'mp4'
): TileBoundary[] {
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid source dimensions: ${width}x${height}`);
  }
  if (config.rows <= 0 || config.cols <= 0) {
    throw new Error(`Invalid grid rows/cols: ${config.rows}x${config.cols}`);
  }

  const { rows, cols, isAsymmetric, customColumnRatios, customRowRatios } = config;
  const tiles: TileBoundary[] = [];

  // Compute column cutpoints: X[c] for c in 0..cols
  const colCuts: number[] = new Array(cols + 1);
  colCuts[0] = 0;
  colCuts[cols] = width;

  if (isAsymmetric && customColumnRatios && customColumnRatios.length === cols) {
    const sum = customColumnRatios.reduce((a, b) => a + b, 0);
    let accum = 0;
    for (let c = 1; c < cols; c++) {
      accum += customColumnRatios[c - 1];
      colCuts[c] = Math.floor((accum / sum) * width);
    }
  } else {
    for (let c = 1; c < cols; c++) {
      colCuts[c] = Math.floor((c * width) / cols);
    }
  }

  // Compute row cutpoints: Y[r] for r in 0..rows
  const rowCuts: number[] = new Array(rows + 1);
  rowCuts[0] = 0;
  rowCuts[rows] = height;

  if (isAsymmetric && customRowRatios && customRowRatios.length === rows) {
    const sum = customRowRatios.reduce((a, b) => a + b, 0);
    let accum = 0;
    for (let r = 1; r < rows; r++) {
      accum += customRowRatios[r - 1];
      rowCuts[r] = Math.floor((accum / sum) * height);
    }
  } else {
    for (let r = 1; r < rows; r++) {
      rowCuts[r] = Math.floor((r * height) / rows);
    }
  }

  let index = 0;
  for (let r = 0; r < rows; r++) {
    const y0 = rowCuts[r];
    const y1 = rowCuts[r + 1];
    const tileH = y1 - y0;

    for (let c = 0; c < cols; c++) {
      const x0 = colCuts[c];
      const x1 = colCuts[c + 1];
      const tileW = x1 - x0;

      const rowStr = String(r + 1).padStart(2, '0');
      const colStr = String(c + 1).padStart(2, '0');
      const filename = `tile_r${rowStr}_c${colStr}.${fileExtension}`;

      tiles.push({
        row: r,
        col: c,
        index,
        x0,
        x1,
        y0,
        y1,
        width: tileW,
        height: tileH,
        filename,
      });

      index++;
    }
  }

  return tiles;
}

export function formatTileFilename(row: number, col: number, ext: string = 'mp4'): string {
  const rowStr = String(row).padStart(2, '0');
  const colStr = String(col).padStart(2, '0');
  return `tile_r${rowStr}_c${colStr}.${ext}`;
}

export function parseTileFilename(filename: string): { row: number; col: number } | null {
  const match = filename.match(/tile_r(\d+)_c(\d+)\.[a-zA-Z0-9]+/i);
  if (!match) return null;
  return {
    row: parseInt(match[1], 10),
    col: parseInt(match[2], 10),
  };
}

export interface GeometryValidationResult {
  valid: boolean;
  totalArea: number;
  expectedArea: number;
  coveredWidth: number;
  coveredHeight: number;
  errors: string[];
}

/**
 * Validates that a list of tiles forms an exact geometric partition of (width x height)
 * without any gaps or overlaps.
 */
export function validateGridGeometry(
  tiles: TileBoundary[],
  expectedWidth: number,
  expectedHeight: number
): GeometryValidationResult {
  const errors: string[] = [];
  const expectedArea = expectedWidth * expectedHeight;

  if (tiles.length === 0) {
    return {
      valid: false,
      totalArea: 0,
      expectedArea,
      coveredWidth: 0,
      coveredHeight: 0,
      errors: ['No tiles provided'],
    };
  }

  let totalArea = 0;
  let minX0 = Infinity;
  let maxX1 = -Infinity;
  let minY0 = Infinity;
  let maxY1 = -Infinity;

  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];

    if (t.x0 >= t.x1 || t.y0 >= t.y1) {
      errors.push(`Tile ${t.filename} has non-positive dimension: ${t.width}x${t.height}`);
    }
    if (t.x1 - t.x0 !== t.width || t.y1 - t.y0 !== t.height) {
      errors.push(`Tile ${t.filename} dimension mismatch: crop (${t.x1 - t.x0}x${t.y1 - t.y0}) != declared (${t.width}x${t.height})`);
    }

    minX0 = Math.min(minX0, t.x0);
    maxX1 = Math.max(maxX1, t.x1);
    minY0 = Math.min(minY0, t.y0);
    maxY1 = Math.max(maxY1, t.y1);

    totalArea += t.width * t.height;

    // Check overlap with any subsequent tile
    for (let j = i + 1; j < tiles.length; j++) {
      const u = tiles[j];
      const overlapX = Math.max(0, Math.min(t.x1, u.x1) - Math.max(t.x0, u.x0));
      const overlapY = Math.max(0, Math.min(t.y1, u.y1) - Math.max(t.y0, u.y0));
      if (overlapX > 0 && overlapY > 0) {
        errors.push(`Geometric collision between ${t.filename} and ${u.filename} (overlap: ${overlapX}x${overlapY})`);
      }
    }
  }

  if (minX0 !== 0 || minY0 !== 0) {
    errors.push(`Grid does not start at origin (0,0): starts at (${minX0}, ${minY0})`);
  }
  if (maxX1 !== expectedWidth || maxY1 !== expectedHeight) {
    errors.push(`Grid bounds (${maxX1}x${maxY1}) do not match expected dimensions (${expectedWidth}x${expectedHeight})`);
  }
  if (totalArea !== expectedArea) {
    errors.push(`Total tile area (${totalArea}) does not match expected area (${expectedArea}) - gap/overlap of ${Math.abs(totalArea - expectedArea)} pixels`);
  }

  return {
    valid: errors.length === 0,
    totalArea,
    expectedArea,
    coveredWidth: maxX1 - minX0,
    coveredHeight: maxY1 - minY0,
    errors,
  };
}
