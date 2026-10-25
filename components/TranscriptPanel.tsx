"use client";
// Panel transkrip: daftar segmen turn, klik untuk lompat ke detik itu di video.
import { msToClock } from "@/lib/format";
import type { Turn } from "@/lib/types";
import { Card } from "./ui";

export default function TranscriptPanel({
  turns,
  onSeek,
  onAddClip,
}: {
  turns: Turn[];
  onSeek: (ms: number) => void;
  onAddClip?: (turn: Turn) => void;
}) {
  if (turns.length === 0) {
    return (
      <Card>
        <p className="text-sm text-zinc-500">
          Tidak ada transkrip. (Mode manual tanpa API key memang tidak membuat transkrip.)
        </p>
      </Card>
    );
  }
  return (
    <Card className="p-0">
      <div className="border-b border-zinc-800 px-4 py-2">
        <h3 className="text-sm font-bold">📝 Transkrip ({turns.length} segmen)</h3>
        <p className="text-xs text-zinc-500">Klik segmen untuk lompat ke video, atau klik + untuk membuat klip.</p>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {turns.map((t, i) => (
          <div
            key={`${t.turnId}-${i}`}
            className="group flex w-full flex-col border-b border-zinc-800/60 px-4 py-2 text-left hover:bg-zinc-800/60"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-yellow-300">
                  {msToClock(t.startMs)}–{msToClock(t.endMs)}
                </span>
                {t.speaker && (
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 font-semibold text-zinc-200">
                    {t.speaker}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onSeek(t.startMs)}
                  className="rounded px-2 py-0.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-700 hover:text-white"
                  title="Lompat ke waktu ini"
                >
                  ▶ Putar
                </button>
                {onAddClip && (
                  <button
                    onClick={() => onAddClip(t)}
                    className="rounded bg-yellow-400/10 px-2 py-0.5 text-xs font-bold text-yellow-400 hover:bg-yellow-400 hover:text-zinc-950"
                    title="Jadikan Klip"
                  >
                    ＋ Jadikan Klip
                  </button>
                )}
              </div>
            </div>
            <p className="mt-0.5 text-sm text-zinc-300">{t.transcript}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
