import JSZip from 'jszip';
import { ProjectManifest } from '../types/video';
import { validateManifest, ManifestValidationResult } from './manifestService';
import { parseTileFilename } from './gridCalculator';

export interface ExtractedProject {
  manifest?: ProjectManifest;
  manifestValidation?: ManifestValidationResult;
  tiles: Map<string, Blob>; // filename -> Blob
  audioBlob?: Blob;
  audioFilename?: string;
  allFileNames: string[];
}

/**
 * Creates a project ZIP file containing all tiles, manifest.json, and master audio track.
 */
export async function createProjectZip(params: {
  manifest: ProjectManifest;
  tiles: { filename: string; blob: Blob }[];
  audio?: { filename: string; blob: Blob };
  onProgress?: (progress: number) => void;
}): Promise<Blob> {
  const { manifest, tiles, audio, onProgress } = params;
  const zip = new JSZip();

  // Add manifest.json
  const manifestContent = JSON.stringify(manifest, null, 2);
  zip.file('manifest.json', manifestContent);

  // Add all tile videos
  for (const item of tiles) {
    zip.file(item.filename, item.blob);
  }

  // Add master audio track if available
  if (audio && audio.blob) {
    zip.file(audio.filename, audio.blob);
  }

  // Generate ZIP blob with progress updates
  return zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      if (onProgress) {
        onProgress(Math.round(metadata.percent));
      }
    }
  );
}

/**
 * Extracts and parses a project ZIP archive.
 */
export async function extractProjectZip(
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<ExtractedProject> {
  const zip = await JSZip.loadAsync(file);
  const allFileNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  const tiles = new Map<string, Blob>();
  let manifest: ProjectManifest | undefined;
  let manifestValidation: ManifestValidationResult | undefined;
  let audioBlob: Blob | undefined;
  let audioFilename: string | undefined;

  const total = allFileNames.length;
  let processed = 0;

  // First look for manifest.json
  const manifestEntry = zip.file('manifest.json');
  if (manifestEntry) {
    try {
      const manifestText = await manifestEntry.async('string');
      const rawJson = JSON.parse(manifestText);
      manifestValidation = validateManifest(rawJson);
      if (manifestValidation.valid && manifestValidation.manifest) {
        manifest = manifestValidation.manifest;
      }
    } catch (e) {
      manifestValidation = {
        valid: false,
        errors: [`Failed to parse manifest.json: ${e instanceof Error ? e.message : String(e)}`],
        warnings: [],
      };
    }
  }

  // Extract all video and audio files
  for (const filename of allFileNames) {
    if (filename === 'manifest.json' || filename.startsWith('__MACOSX/')) {
      processed++;
      if (onProgress) onProgress(Math.round((processed / total) * 100));
      continue;
    }

    const fileEntry = zip.file(filename);
    if (!fileEntry) continue;

    const lower = filename.toLowerCase();
    const isVideo = lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov') || lower.endsWith('.mkv');
    const isAudio = lower.endsWith('.aac') || lower.endsWith('.m4a') || lower.endsWith('.mp3') || lower.endsWith('.wav') || (manifest?.masterAudio?.filename === filename);

    if (isVideo) {
      const blob = await fileEntry.async('blob');
      // If this video file happens to be named exactly as the master audio track in manifest
      if (manifest?.masterAudio?.present && manifest.masterAudio.filename === filename) {
        audioBlob = blob;
        audioFilename = filename;
      } else {
        tiles.set(filename, blob);
      }
    } else if (isAudio) {
      audioBlob = await fileEntry.async('blob');
      audioFilename = filename;
    }

    processed++;
    if (onProgress) onProgress(Math.round((processed / total) * 100));
  }

  return {
    manifest,
    manifestValidation,
    tiles,
    audioBlob,
    audioFilename,
    allFileNames,
  };
}
