"use client";

import clsx from "clsx";

type BoardControlsProps = {
  isPlaying: boolean;
  speed: number;
  onSpeedChange: (value: number) => void;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onTogglePlay: () => void;
};

export function BoardControls({
  isPlaying,
  speed,
  onSpeedChange,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onTogglePlay
}: BoardControlsProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={onFirst}>
          |&lt;
        </button>
        <button className="btn" onClick={onPrev}>
          &lt;
        </button>
        <button className={clsx("btn", isPlaying && "bg-emerald-500/80")} onClick={onTogglePlay}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button className="btn" onClick={onNext}>
          &gt;
        </button>
        <button className="btn" onClick={onLast}>
          &gt;|
        </button>
      </div>
      <div className="space-y-1">
        <label className="text-xs uppercase text-slate-400">Replay speed</label>
        <input
          type="range"
          min={300}
          max={2000}
          step={100}
          value={speed}
          onChange={(event) => onSpeedChange(Number(event.target.value))}
          className="w-full"
        />
        <div className="text-xs text-slate-400">{speed}ms per move</div>
      </div>
    </div>
  );
}
