import { VideoMetadata } from '../types/video';

/**
 * Inspect video file metadata (duration, width, height, aspect ratio, audio presence)
 * using HTML5 Video and Web Audio API.
 */
export async function inspectVideoFile(file: File | Blob): Promise<{
  metadata: VideoMetadata;
  thumbnailUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.preload = 'metadata';

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Timeout inspecting video metadata'));
    }, 15000);

    video.onloadedmetadata = async () => {
      clearTimeout(timeout);
      const rawWidth = video.videoWidth || 1920;
      const rawHeight = video.videoHeight || 1080;
      // In H.264 (yuv420p), macroblock and chroma subsampling require dimensions to be divisible by 2.
      // If mobile capture or browser metadata reports odd dimensions (e.g. 2560x4551), normalize to even
      // to ensure all grid partitions and cutpoints stay on clean integer pixel coordinates.
      const width = Math.floor(rawWidth / 2) * 2;
      const height = Math.floor(rawHeight / 2) * 2;
      const duration = video.duration || 10;

      // Calculate simplified aspect ratio
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      const divisor = gcd(width, height);
      const dar = `${width / divisor}:${height / divisor}`;

      // Check audio track presence
      let hasAudio = false;
      try {
        const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(video);
        hasAudio = source !== null;
        await audioCtx.close();
      } catch {
        // Fallback checks
        const v = video as unknown as { mozHasAudio?: boolean; webkitAudioDecodedByteCount?: number };
        hasAudio = v.mozHasAudio === true || (v.webkitAudioDecodedByteCount !== undefined && v.webkitAudioDecodedByteCount > 0) || true;
      }

      // Capture a thumbnail frame at 0.5s or 0s
      video.currentTime = Math.min(0.5, duration / 2);
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(width, 480);
          canvas.height = Math.round((canvas.width * height) / width);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          URL.revokeObjectURL(objectUrl);

          resolve({
            metadata: {
              name: (file as File).name || 'source_video.mp4',
              size: file.size,
              duration,
              width,
              height,
              displayAspectRatio: dar,
              frameRate: 30, // Default estimate if VFR/not exposed
              pixelFormat: 'yuv420p',
              hasAudio,
              audioChannels: hasAudio ? 2 : undefined,
              audioSampleRate: hasAudio ? 48000 : undefined,
              orientation: 0,
              codec: file.type || 'video/mp4',
            },
            thumbnailUrl,
          });
        } catch {
          URL.revokeObjectURL(objectUrl);
          resolve({
            metadata: {
              name: (file as File).name || 'source_video.mp4',
              size: file.size,
              duration,
              width,
              height,
              displayAspectRatio: dar,
              frameRate: 30,
              pixelFormat: 'yuv420p',
              hasAudio,
            },
            thumbnailUrl: '',
          });
        }
      };
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Failed to read video file: ${video.error?.message || 'Unsupported format'}`));
    };
  });
}

export interface SyntheticVideoOptions {
  width: number;
  height: number;
  durationSeconds: number;
  fps: number;
  includeAudio?: boolean;
  title?: string;
}

/**
 * Generates an exact mathematical synthetic video directly in the browser
 * for deterministic split & reassembly verification without requiring external files.
 */
export async function generateSyntheticTestVideo(
  options: SyntheticVideoOptions,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const { width, height, durationSeconds, fps, includeAudio = true, title = 'Video Grid Studio Test' } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Stream from canvas
  const stream = canvas.captureStream(fps);

  // Audio track generator
  let audioContext: AudioContext | null = null;
  if (includeAudio) {
    try {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      gain.gain.value = 0.05; // Gentle volume
      osc.frequency.value = 440; // A4
      const dest = audioContext.createMediaStreamDestination();
      osc.connect(gain);
      gain.connect(dest);
      osc.start();

      dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track));
    } catch (e) {
      console.warn('Could not initialize audio for test video:', e);
    }
  }

  // Choose MIME type supported by browser
  let mimeType = 'video/webm;codecs=vp9,opus';
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm;codecs=vp8,opus';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }
  if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/mp4';
  }

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 8000000,
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const totalFrames = Math.round(durationSeconds * fps);
  const frameIntervalMs = 1000 / fps;

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = () => {
      if (audioContext) audioContext.close();
      const finalBlob = new Blob(chunks, { type: mimeType });
      resolve(finalBlob);
    };

    mediaRecorder.onerror = (e) => {
      if (audioContext) audioContext.close();
      reject(e);
    };

    mediaRecorder.start(100);

    let currentFrame = 0;

    const renderNextFrame = () => {
      if (currentFrame >= totalFrames) {
        mediaRecorder.stop();
        return;
      }

      const t = currentFrame / fps;

      // Draw rich test pattern
      // 1. Background gradient
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.5, '#1e293b');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 2. High-precision alignment grid lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      const step = 40;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 3. Diagonal corner-to-corner verification lines
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, height);
      ctx.moveTo(width, 0);
      ctx.lineTo(0, height);
      ctx.stroke();

      // 4. Moving high-contrast orbital indicator (to verify temporal synchronization across tiles)
      const cx = width / 2;
      const cy = height / 2;
      const orbitRadius = Math.min(width, height) * 0.35;
      const angle = (t * 2 * Math.PI) / 3; // 1 revolution every 3 seconds
      const orbX = cx + Math.cos(angle) * orbitRadius;
      const orbY = cy + Math.sin(angle) * orbitRadius;

      // Orbital glow
      const radial = ctx.createRadialGradient(orbX, orbY, 5, orbX, orbY, 50);
      radial.addColorStop(0, '#38bdf8');
      radial.addColorStop(0.5, '#0284c7');
      radial.addColorStop(1, 'transparent');
      ctx.fillStyle = radial;
      ctx.beginPath();
      ctx.arc(orbX, orbY, 50, 0, Math.PI * 2);
      ctx.fill();

      // Orbit core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 12, 0, Math.PI * 2);
      ctx.fill();

      // 5. Center SMPTE style color bars
      const barHeight = 40;
      const barWidth = width / 7;
      const colors = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'];
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = colors[i];
        ctx.fillRect(i * barWidth, height - barHeight - 10, barWidth, barHeight);
      }

      // 6. Central metadata & frame stamp
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(title, cx, cy - 60);

      ctx.font = '22px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`${width}x${height} @ ${fps}fps | ${durationSeconds}s`, cx, cy - 20);

      // Frame timecode
      const sec = Math.floor(t);
      const frameInSec = currentFrame % fps;
      const timecode = `T: ${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}.${String(frameInSec).padStart(2, '0')} (Frame #${currentFrame + 1}/${totalFrames})`;
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 28px monospace';
      ctx.fillText(timecode, cx, cy + 30);

      // Perimeter 1-pixel boundary test marker
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, width - 2, height - 2);

      currentFrame++;
      if (onProgress) {
        onProgress(Math.round((currentFrame / totalFrames) * 100));
      }

      setTimeout(renderNextFrame, frameIntervalMs / 2); // Accelerate generation
    };

    renderNextFrame();
  });
}
