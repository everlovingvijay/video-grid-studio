import { describe, it, expect, vi } from 'vitest';
import { MasterPresentationClock } from '../src/services/masterClock';

describe('MasterPresentationClock - Synchronization and Stepping', () => {
  it('initializes with duration and fps', () => {
    const clock = new MasterPresentationClock(10.0, 30);
    expect(clock.getDuration()).toBe(10.0);
    expect(clock.getFps()).toBe(30);
    expect(clock.getCurrentTime()).toBe(0);
  });

  it('seeks and notifies listeners with clamped values', () => {
    const clock = new MasterPresentationClock(10.0, 30);
    let updatedTime = -1;

    clock.registerListener({
      onTimeUpdate: (t) => {
        updatedTime = t;
      },
      onPlayStateChange: () => {},
      onSeek: () => {},
    });

    clock.seek(4.5);
    expect(clock.getCurrentTime()).toBe(4.5);
    expect(updatedTime).toBe(4.5);

    // Clamp over duration
    clock.seek(15.0);
    expect(clock.getCurrentTime()).toBe(10.0);

    // Clamp below 0
    clock.seek(-2.0);
    expect(clock.getCurrentTime()).toBe(0);
  });

  it('steps frame forward and backward deterministically (+/- 1 frame duration)', () => {
    const clock = new MasterPresentationClock(10.0, 25); // 25fps = 0.04s per frame
    clock.seek(1.0);

    clock.stepFrame(1);
    expect(Math.abs(clock.getCurrentTime() - 1.04)).toBeLessThan(0.0001);

    clock.stepFrame(-1);
    expect(Math.abs(clock.getCurrentTime() - 1.0)).toBeLessThan(0.0001);
  });
});
