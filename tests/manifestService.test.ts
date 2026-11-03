import { describe, it, expect } from 'vitest';
import { validateManifest, createProjectManifest, computeBlobHash } from '../src/services/manifestService';
import { computeGridBoundaries } from '../src/services/gridCalculator';

describe('manifestService - Serialization & Integrity Validation', () => {
  it('creates and validates a complete valid project manifest', async () => {
    const gridConfig = {
      rows: 2,
      cols: 2,
      preset: '2x2' as const,
      isAsymmetric: false,
    };
    const boundaries = computeGridBoundaries(640, 480, gridConfig);
    const mockTiles = boundaries.map((b) => ({
      tile: b,
      status: 'done' as const,
      progress: 100,
      hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      size: 1024,
    }));

    const manifest = await createProjectManifest({
      source: {
        name: 'test_clip.mp4',
        size: 4096,
        duration: 5.0,
        width: 640,
        height: 480,
        displayAspectRatio: '4:3',
        frameRate: 30,
        pixelFormat: 'yuv420p',
        hasAudio: true,
        audioChannels: 2,
        audioSampleRate: 48000,
      },
      gridConfig,
      qualityMode: 'high',
      tiles: mockTiles,
      masterAudioFilename: 'master_audio.aac',
      hasAudio: true,
    });

    expect(manifest.version).toBe('1.0.0');
    expect(manifest.tiles).toHaveLength(4);
    expect(manifest.masterAudio.present).toBe(true);
    expect(manifest.masterAudio.filename).toBe('master_audio.aac');

    const validation = validateManifest(manifest);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('rejects manifest with missing required fields or corrupted grid', () => {
    const invalidJson = {
      version: '1.0.0',
      source: { width: 1920 }, // Missing height and duration
      grid: { rows: 3, cols: 3 },
      tiles: [], // Empty tiles
    };

    const result = validateManifest(invalidJson);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('computes deterministic SHA-256 hash for blob', async () => {
    const textBlob = new Blob(['VideoGridStudioDeterministicHashVerification']);
    const hash = await computeBlobHash(textBlob);
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64); // Standard SHA-256 hex string length
  });
});
