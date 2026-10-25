"use client";
// Timeline geser ganda: dua handle untuk start & end klip.
import { msToClock } from "@/lib/format";

export default function Timeline({
  durationMs,
  startMs,
  endMs,
  onChange,
}: {
  durationMs: number;
  startMs: number;
  endMs: number;
  onChange: (startMs: number, endMs: number) => void;
}) {
  const dur = Math.max(1, durationMs);
  const leftPct = (Math.min(startMs, endMs) / dur) * 100;
  const widthPct = (Math.abs(endMs - startMs) / dur) * 100;

  return (
    <div>
      <div className="relative h-12 select-none rounded-lg bg-zinc-800">
        <div
          className="absolute top-0 h-full rounded-lg bg-yellow-400/30"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
        <input
          type="range"
          className="timeline"
          min={0}
          max={dur}
          step={100}
          value={startMs}
          aria-label="Awal klip"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(Math.min(v, endMs - 1000), endMs);
          }}
        />
        <input
          type="range"
          className="timeline"
          min={0}
          max={dur}
          step={100}
          value={endMs}
          aria-label="Akhir klip"
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(startMs, Math.max(v, startMs + 1000));
          }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs text-zinc-500">
        <span>{msToClock(startMs)}</span>
        <span>{msToClock(endMs)}</span>
        <span>{msToClock(dur)}</span>
      </div>
    </div>
  );
}
