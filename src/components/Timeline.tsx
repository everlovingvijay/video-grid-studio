import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  ChevronLeft,
  ChevronRight,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface TimelineProps {
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  playbackRate: number;
  isLoop: boolean;
  fps: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onStepFrame: (direction: 1 | -1) => void;
  onRateChange: (rate: number) => void;
  onToggleLoop: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  currentTime,
  duration,
  isPlaying,
  playbackRate,
  isLoop,
  fps,
  onTogglePlay,
  onSeek,
  onStepFrame,
  onRateChange,
  onToggleLoop,
  isMuted,
  onToggleMute,
}) => {
  // Format SMPTE style timecode: HH:MM:SS:FF
  const formatTimecode = (seconds: number, rate: number = 30) => {
    const totalFrames = Math.floor(seconds * rate);
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const f = totalFrames % Math.round(rate);

    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <footer className="h-16 bg-studio-900 border-t border-studio-800 px-4 flex items-center justify-between select-none z-20 shrink-0">
      {/* Playback Controls & Frame Stepping */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onSeek(0)}
          title="Jump to Start"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <SkipBack className="w-4 h-4" />
        </button>

        <button
          onClick={() => onStepFrame(-1)}
          title="Step 1 Frame Back (←)"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={onTogglePlay}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          className="w-10 h-10 rounded-full bg-studio-accent hover:bg-studio-accent-hover text-white flex items-center justify-center shadow-lg shadow-studio-accent/25 transition active:scale-95"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <button
          onClick={() => onStepFrame(1)}
          title="Step 1 Frame Forward (→)"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Scrubber & Master Presentation Clock Timecode */}
      <div className="flex-1 max-w-2xl mx-4 flex items-center space-x-3">
        <span className="font-mono text-xs font-semibold text-studio-cyan tabular-nums shrink-0">
          {formatTimecode(currentTime, fps)}
        </span>

        <div className="relative flex-1 flex items-center group cursor-pointer">
          <input
            type="range"
            min={0}
            max={duration || 10}
            step={1 / (fps || 30)}
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-studio-800 rounded-lg appearance-none cursor-pointer accent-studio-accent focus:outline-none"
          />
          {/* Progress fill bar */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-studio-accent rounded-l-lg pointer-events-none"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <span className="font-mono text-xs text-slate-400 tabular-nums shrink-0">
          {formatTimecode(duration, fps)}
        </span>
      </div>

      {/* Auxiliary Controls (Speed, Loop, Volume) */}
      <div className="flex items-center space-x-2">
        {/* Playback Rate Dropdown */}
        <select
          value={playbackRate}
          onChange={(e) => onRateChange(parseFloat(e.target.value))}
          className="bg-studio-800 border border-studio-700 text-slate-300 text-xs rounded-lg px-2 py-1 font-mono hover:text-white focus:outline-none focus:border-studio-accent"
        >
          <option value={0.25}>0.25x</option>
          <option value={0.5}>0.5x</option>
          <option value={1.0}>1.0x</option>
          <option value={1.5}>1.5x</option>
          <option value={2.0}>2.0x</option>
        </select>

        {/* Loop toggle */}
        <button
          onClick={onToggleLoop}
          title={isLoop ? 'Loop Enabled' : 'Loop Disabled'}
          className={`p-1.5 rounded-lg transition ${
            isLoop
              ? 'text-studio-accent bg-studio-accent/20 border border-studio-accent/40'
              : 'text-slate-400 hover:text-white hover:bg-studio-800'
          }`}
        >
          <Repeat className="w-4 h-4" />
        </button>

        {/* Mute toggle */}
        <button
          onClick={onToggleMute}
          title={isMuted ? 'Unmute' : 'Mute'}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-studio-800 transition"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </footer>
  );
};
