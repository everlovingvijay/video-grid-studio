import { SeamMetrics } from '../types/video';

export interface FrameComparisonResult {
  metrics: SeamMetrics;
  heatmapDataUrl: string;
}

/**
 * Calculates MSE, PSNR, SSIM and difference heatmap between two canvas frames.
 */
export function compareFrames(
  imageDataA: ImageData,
  imageDataB: ImageData
): FrameComparisonResult {
  const width = Math.min(imageDataA.width, imageDataB.width);
  const height = Math.min(imageDataA.height, imageDataB.height);
  const dataA = imageDataA.data;
  const dataB = imageDataB.data;

  const totalPixels = width * height;
  let sumSquaredError = 0;
  let maxPixelDiff = 0;

  // Heatmap image data
  const heatmapData = new Uint8ClampedArray(width * height * 4);

  // SSIM calculation accumulators
  let sumA = 0;
  let sumB = 0;
  let sumSqA = 0;
  let sumSqB = 0;
  let sumAB = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const idxA = (y * imageDataA.width + x) * 4;
      const idxB = (y * imageDataB.width + x) * 4;

      const dr = Math.abs(dataA[idxA] - dataB[idxB]);
      const dg = Math.abs(dataA[idxA + 1] - dataB[idxB + 1]);
      const db = Math.abs(dataA[idxA + 2] - dataB[idxB + 2]);

      const pixelDiff = Math.max(dr, dg, db);
      if (pixelDiff > maxPixelDiff) maxPixelDiff = pixelDiff;

      const sqErr = (dr * dr + dg * dg + db * db) / 3;
      sumSquaredError += sqErr;

      // Luminance approximation for SSIM
      const lumA = 0.299 * dataA[idxA] + 0.587 * dataA[idxA + 1] + 0.114 * dataA[idxA + 2];
      const lumB = 0.299 * dataB[idxB] + 0.587 * dataB[idxB + 1] + 0.114 * dataB[idxB + 2];

      sumA += lumA;
      sumB += lumB;
      sumSqA += lumA * lumA;
      sumSqB += lumB * lumB;
      sumAB += lumA * lumB;

      // Build Heatmap color:
      // Exact (0 diff): deep dark navy/slate
      // Low diff (1-8): cyan
      // Medium diff (9-30): yellow/amber
      // High diff (>30): vivid red/magenta
      if (pixelDiff === 0) {
        heatmapData[idx] = 15;     // R
        heatmapData[idx + 1] = 23; // G
        heatmapData[idx + 2] = 42; // B
        heatmapData[idx + 3] = 255;
      } else if (pixelDiff < 8) {
        heatmapData[idx] = 6;
        heatmapData[idx + 1] = 182;
        heatmapData[idx + 2] = 212; // Cyan
        heatmapData[idx + 3] = 255;
      } else if (pixelDiff < 30) {
        heatmapData[idx] = 245;
        heatmapData[idx + 1] = 158;
        heatmapData[idx + 2] = 11; // Amber
        heatmapData[idx + 3] = 255;
      } else {
        heatmapData[idx] = 244;
        heatmapData[idx + 1] = 63;
        heatmapData[idx + 2] = 94; // Red/Rose
        heatmapData[idx + 3] = 255;
      }
    }
  }

  const mse = sumSquaredError / totalPixels;

  // PSNR = 10 * log10(255^2 / MSE)
  let psnr = 100; // Perfect match
  if (mse > 0) {
    psnr = Math.round(10 * Math.log10((255 * 255) / mse) * 100) / 100;
  }

  // Simplified global SSIM
  const c1 = 6.5025; // (0.01 * 255)^2
  const c2 = 58.5225; // (0.03 * 255)^2
  const meanA = sumA / totalPixels;
  const meanB = sumB / totalPixels;
  const varA = sumSqA / totalPixels - meanA * meanA;
  const varB = sumSqB / totalPixels - meanB * meanB;
  const covarAB = sumAB / totalPixels - meanA * meanB;

  const ssimNumerator = (2 * meanA * meanB + c1) * (2 * covarAB + c2);
  const ssimDenominator = (meanA * meanA + meanB * meanB + c1) * (varA + varB + c2);
  const ssim = Math.max(0, Math.min(1.0, Math.round((ssimNumerator / (ssimDenominator || 1)) * 10000) / 10000));

  // Create heatmap data URL using offscreen canvas
  const hCanvas = document.createElement('canvas');
  hCanvas.width = width;
  hCanvas.height = height;
  const hCtx = hCanvas.getContext('2d')!;
  const hImgData = new ImageData(heatmapData, width, height);
  hCtx.putImageData(hImgData, 0, 0);
  const heatmapDataUrl = hCanvas.toDataURL('image/png');

  return {
    metrics: {
      psnr,
      ssim,
      mse: Math.round(mse * 100) / 100,
      maxPixelDiff,
      seamDiscontinuity: Math.round((maxPixelDiff / 255) * 100),
      evaluatedFramesCount: 1,
    },
    heatmapDataUrl,
  };
}

/**
 * Checks horizontal seam continuity between two adjacent tiles.
 */
export function checkSeamDiscontinuity(
  leftEdgeImageData: ImageData,
  rightEdgeImageData: ImageData
): number {
  const height = Math.min(leftEdgeImageData.height, rightEdgeImageData.height);
  let totalDelta = 0;

  for (let y = 0; y < height; y++) {
    // Last column of left
    const leftIdx = (y * leftEdgeImageData.width + (leftEdgeImageData.width - 1)) * 4;
    // First column of right
    const rightIdx = (y * rightEdgeImageData.width + 0) * 4;

    const dr = Math.abs(leftEdgeImageData.data[leftIdx] - rightEdgeImageData.data[rightIdx]);
    const dg = Math.abs(leftEdgeImageData.data[leftIdx + 1] - rightEdgeImageData.data[rightIdx + 1]);
    const db = Math.abs(leftEdgeImageData.data[leftIdx + 2] - rightEdgeImageData.data[rightIdx + 2]);

    totalDelta += (dr + dg + db) / 3;
  }

  return totalDelta / height;
}
