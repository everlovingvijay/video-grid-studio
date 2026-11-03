export interface ClockListener {
  onTimeUpdate: (time: number) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onSeek: (time: number) => void;
}

export class MasterPresentationClock {
  private currentTime = 0;
  private duration = 0;
  private isPlaying = false;
  private playbackRate = 1.0;
  private fps = 30;
  private isLooping = false;

  private lastWallClock = 0;
  private rafId: number | null = null;
  private listeners: Set<ClockListener> = new Set();
  private slavedVideos: Set<HTMLVideoElement> = new Set();

  constructor(duration: number = 0, fps: number = 30) {
    this.duration = duration;
    this.fps = fps;
  }

  public setDuration(d: number) {
    this.duration = Math.max(0, d);
  }

  public getDuration(): number {
    return this.duration;
  }

  public setFps(fps: number) {
    this.fps = fps > 0 ? fps : 30;
  }

  public getFps(): number {
    return this.fps;
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.1, Math.min(4.0, rate));
    this.slavedVideos.forEach((v) => {
      v.playbackRate = this.playbackRate;
    });
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public setLoop(loop: boolean) {
    this.isLooping = loop;
  }

  public isLoop(): boolean {
    return this.isLooping;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public registerListener(listener: ClockListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public registerVideo(video: HTMLVideoElement): () => void {
    this.slavedVideos.add(video);
    video.currentTime = this.currentTime;
    video.playbackRate = this.playbackRate;
    return () => this.slavedVideos.delete(video);
  }

  public play() {
    if (this.isPlaying) return;
    if (this.currentTime >= this.duration && this.duration > 0) {
      this.currentTime = 0;
    }
    this.isPlaying = true;
    this.lastWallClock = performance.now();
    this.notifyPlayState(true);

    // Sync all slaved videos
    this.slavedVideos.forEach((v) => {
      v.currentTime = this.currentTime;
      v.play().catch(() => {});
    });

    this.tick();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.notifyPlayState(false);

    this.slavedVideos.forEach((v) => {
      v.pause();
      v.currentTime = this.currentTime;
    });
  }

  public togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(targetTime: number) {
    const clamped = Math.max(0, Math.min(this.duration, targetTime));
    this.currentTime = clamped;
    this.lastWallClock = performance.now();

    // Synchronize all registered videos with drift guard
    this.slavedVideos.forEach((v) => {
      v.currentTime = clamped;
    });

    this.notifySeek(clamped);
    this.notifyTime(clamped);
  }

  public stepFrame(direction: 1 | -1) {
    this.pause();
    const frameDuration = 1 / this.fps;
    this.seek(this.currentTime + direction * frameDuration);
  }

  private tick = () => {
    if (!this.isPlaying) return;

    const now = performance.now();
    const deltaSeconds = (now - this.lastWallClock) / 1000;
    this.lastWallClock = now;

    this.currentTime += deltaSeconds * this.playbackRate;

    if (this.currentTime >= this.duration) {
      if (this.isLooping && this.duration > 0) {
        this.currentTime = 0;
        this.slavedVideos.forEach((v) => {
          v.currentTime = 0;
        });
      } else {
        this.currentTime = this.duration;
        this.pause();
        this.notifyTime(this.currentTime);
        return;
      }
    }

    // Maintain tight synchronization threshold: clamp drift > 40ms
    const driftThreshold = 0.04;
    this.slavedVideos.forEach((v) => {
      if (Math.abs(v.currentTime - this.currentTime) > driftThreshold) {
        v.currentTime = this.currentTime;
      }
    });

    this.notifyTime(this.currentTime);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private notifyTime(time: number) {
    this.listeners.forEach((l) => l.onTimeUpdate(time));
  }

  private notifyPlayState(playing: boolean) {
    this.listeners.forEach((l) => l.onPlayStateChange(playing));
  }

  private notifySeek(time: number) {
    this.listeners.forEach((l) => l.onSeek(time));
  }

  public destroy() {
    this.pause();
    this.listeners.clear();
    this.slavedVideos.clear();
  }
}
