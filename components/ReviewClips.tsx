"use client";
// Langkah 4: Review — daftar klip (dari AI dan/atau manual), bisa diedit sebelum render.
import { useState, type RefObject } from "react";
import { Btn, Card, TimeInput } from "./ui";
import Timeline from "./Timeline";
import TranscriptPanel from "./TranscriptPanel";
import ClipVisualPreview from "./ClipVisualPreview";
import { formatDuration, msToClock } from "@/lib/format";
import { newId, type ClipSuggestion, type Turn } from "@/lib/types";
import { ASPECT_PRESETS, DEFAULT_ASPECT } from "@/lib/presets";

/** Geser video ke ms lalu putar sampai batas akhir klip. */
function previewRange(
  videoRef: RefObject<HTMLVideoElement | null>,
  startMs: number,
  endMs: number,
) {
  const v = videoRef.current;
  if (!v) return;
  v.currentTime = startMs / 1000;
  void v.play().catch(() => undefined);
  const stop = () => {
    if (v.currentTime * 1000 >= endMs) {
      v.pause();
      v.removeEventListener("timeupdate", stop);
    }
  };
  v.addEventListener("timeupdate", stop);
}

/** Pembuat klip manual: timeline + preview + judul. */
export function ClipBuilder({
  durationMs,
  videoRef,
  videoUrl,
  turns,
  onAdd,
  compact,
}: {
  durationMs: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  turns: Turn[];
  onAdd: (clip: ClipSuggestion) => void;
  compact?: boolean;
}) {
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(Math.min(60000, Math.max(10000, durationMs)));
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [showVisual, setShowVisual] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT);

  const add = () => {
    if (endMs <= startMs) return;
    onAdd({
      id: newId(),
      startMs,
      endMs,
      title: title.trim() || "Klip manual",
      caption: caption.trim(),
      reason: "",
      selected: true,
      cropXOffset: 0,
      showSubtitle,
      aspectRatio,
    });
    setTitle("");
    setCaption("");
    setShowSubtitle(true);
    setAspectRatio(DEFAULT_ASPECT);
    setShowVisual(false);
  };

  return (
    <Card className={compact ? "" : "border-yellow-400/40"}>
      <h3 className="mb-3 text-sm font-bold">✋ Buat klip manual</h3>
      <div className="space-y-3">
        <Timeline
          durationMs={durationMs}
          startMs={startMs}
          endMs={endMs}
          onChange={(s, e) => {
            setStartMs(s);
            setEndMs(e);
          }}
        />
        <div className="grid grid-cols-2 gap-3">
          <TimeInput label="Awal" ms={startMs} max={durationMs} onChange={(ms) => setStartMs(Math.min(ms, endMs - 1000))} />
          <TimeInput label="Akhir" ms={endMs} max={durationMs} onChange={(ms) => setEndMs(Math.max(ms, startMs + 1000))} />
        </div>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">Judul klip</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="mis. Momen paling lucu"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">
            Teks overlay (opsional — tampil sepanjang klip bila tanpa transkrip)
          </span>
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="mis. Tonton sampai habis!"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
        </label>

        {/* Toggle subtitle */}
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
          <div>
            <span className="text-xs font-semibold text-zinc-200">💬 Tampilkan subtitle</span>
            <p className="text-[11px] text-zinc-500">Overlay teks transkrip di atas video</p>
          </div>
          <div
            onClick={() => setShowSubtitle((v) => !v)}
            className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
              showSubtitle ? "bg-yellow-400" : "bg-zinc-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                showSubtitle ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
        </label>
        <div className="flex flex-wrap gap-2">
          <Btn
            variant={showVisual ? "primary" : "ghost"}
            onClick={() => {
              setShowVisual((v) => !v);
              previewRange(videoRef, startMs, endMs);
            }}
          >
            {showVisual ? "👁️ Sembunyikan visual" : "▶ Preview visual potongan"}
          </Btn>
          <Btn onClick={add}>＋ Tambah ke daftar</Btn>
        </div>

        {showVisual && videoUrl && (
          <ClipVisualPreview
            videoUrl={videoUrl}
            startMs={startMs}
            endMs={endMs}
            cropXOffset={0}
            turns={turns}
            caption={caption}
            showSubtitles={showSubtitle}
            title={title || "Preview Klip Manual"}
            onClose={() => setShowVisual(false)}
          />
        )}
      </div>
    </Card>
  );
}

function ClipCard({
  clip,
  index,
  videoRef,
  videoUrl,
  turns,
  onPatch,
  onDelete,
}: {
  clip: ClipSuggestion;
  index: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  turns: Turn[];
  onPatch: (patch: Partial<ClipSuggestion>) => void;
  onDelete: () => void;
}) {
  const [showVisual, setShowVisual] = useState(false);

  return (
    <Card className={clip.selected ? "border-zinc-700" : "opacity-60"}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={clip.selected}
          onChange={(e) => onPatch({ selected: e.target.checked })}
          className="mt-1 h-5 w-5 accent-yellow-400"
          title="Pilih untuk render"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-bold text-yellow-300">
              Klip {index + 1} • {formatDuration(clip.endMs - clip.startMs)}
            </span>
            <button onClick={onDelete} className="text-xs text-red-400 hover:text-red-300">
              🗑 Hapus
            </button>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Judul</span>
            <input
              type="text"
              value={clip.title}
              onChange={(e) => onPatch({ title: e.target.value })}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <TimeInput
              label="Awal"
              ms={clip.startMs}
              onChange={(ms) => onPatch({ startMs: Math.min(ms, clip.endMs - 1000) })}
            />
            <TimeInput
              label="Akhir"
              ms={clip.endMs}
              onChange={(ms) => onPatch({ endMs: Math.max(ms, clip.startMs + 1000) })}
            />
          </div>
          {/* Selector Rasio Aspek */}
          <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-2">
            <p className="mb-1.5 text-xs font-semibold text-zinc-400">📐 Format & Platform</p>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPatch({ aspectRatio: p.id })}
                  title={p.platforms}
                  className={`flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-center transition ${
                    (clip.aspectRatio ?? DEFAULT_ASPECT) === p.id
                      ? "border-yellow-400 bg-yellow-400/10 text-yellow-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  <span className="text-base leading-none">{p.icon}</span>
                  <span className="mt-0.5 text-[10px] font-bold">{p.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              {ASPECT_PRESETS.find((p) => p.id === (clip.aspectRatio ?? DEFAULT_ASPECT))?.platforms}
            </p>
          </div>

          {clip.reason && (
            <p className="text-xs italic text-zinc-500">💡 {clip.reason}</p>
          )}
          {clip.caption && (
            <p className="text-xs text-zinc-400">💬 {clip.caption}</p>
          )}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
            <div>
              <span className="text-xs font-semibold text-zinc-200">💬 Subtitle</span>
              <p className="text-[11px] text-zinc-500">Overlay teks transkrip di atas video</p>
            </div>
            <div
              onClick={() => onPatch({ showSubtitle: !clip.showSubtitle })}
              className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                clip.showSubtitle ? "bg-yellow-400" : "bg-zinc-700"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  clip.showSubtitle ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </div>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">
              Posisi crop horizontal: {clip.cropXOffset}px (0 = tengah)
            </span>
            <input
              type="range"
              min={-400}
              max={400}
              step={10}
              value={clip.cropXOffset}
              onChange={(e) => onPatch({ cropXOffset: Number(e.target.value) })}
              className="w-full accent-yellow-400"
            />
          </label>
          <div>
            <Btn
              variant={showVisual ? "primary" : "ghost"}
              onClick={() => {
                setShowVisual((v) => !v);
                previewRange(videoRef, clip.startMs, clip.endMs);
              }}
            >
              {showVisual ? "👁️ Sembunyikan visual" : `▶ Preview visual klip (${msToClock(clip.startMs)})`}
            </Btn>
          </div>

          {showVisual && videoUrl && (
            <ClipVisualPreview
              videoUrl={videoUrl}
              startMs={clip.startMs}
              endMs={clip.endMs}
              cropXOffset={clip.cropXOffset}
              turns={turns}
              caption={clip.caption}
              showSubtitles={clip.showSubtitle}
              title={`Klip ${index + 1}: ${clip.title}`}
              onClose={() => setShowVisual(false)}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ReviewClips({
  clips,
  onChange,
  videoRef,
  videoUrl,
  durationMs,
  turns,
  onSeek,
  mode,
  className = "",
}: {
  clips: ClipSuggestion[];
  onChange: (clips: ClipSuggestion[]) => void;
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  durationMs: number;
  turns: Turn[];
  onSeek: (ms: number) => void;
  mode: "auto" | "manual";
  className?: string;
}) {
  const [showBuilder, setShowBuilder] = useState(mode === "manual");

  const patch = (id: string, p: Partial<ClipSuggestion>) =>
    onChange(clips.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const remove = (id: string) => onChange(clips.filter((c) => c.id !== id));
  const add = (clip: ClipSuggestion) => onChange([...clips, clip]);

  // Jadikan satu Turn sebagai klip baru otomatis
  const addFromTurn = (turn: Turn) => {
    const startMs = Math.max(0, turn.startMs - 500);
    const endMs = Math.min(durationMs, turn.endMs + 500);
    const snippet = turn.transcript.trim().slice(0, 60);
    add({
      id: newId(),
      startMs,
      endMs,
      title: snippet || "Klip dari transkrip",
      caption: turn.transcript.trim(),
      reason: "Dipilih manual dari transkrip",
      selected: true,
      cropXOffset: 0,
      showSubtitle: true,
      aspectRatio: DEFAULT_ASPECT,
    });
  };

  const selectedCount = clips.filter((c) => c.selected).length;

  return (
    <div className={`min-w-0 overflow-hidden space-y-4 ${className}`}>
      {turns.length > 0 && (
        <TranscriptPanel turns={turns} onSeek={onSeek} onAddClip={addFromTurn} />
      )}

      {mode === "auto" ? (
        <button
          onClick={() => setShowBuilder((s) => !s)}
          className="text-sm font-semibold text-yellow-300 hover:text-yellow-200"
        >
          {showBuilder ? "▾ Sembunyikan" : "▸ ＋ Tambah klip manual"}
        </button>
      ) : (
        <p className="text-sm text-zinc-400">
          Tentukan potongan lewat timeline di bawah, lalu tambah ke daftar klip.
        </p>
      )}
      {showBuilder && (
        <ClipBuilder
          durationMs={durationMs}
          videoRef={videoRef}
          videoUrl={videoUrl}
          turns={turns}
          onAdd={add}
          compact={mode === "auto"}
        />
      )}

      <h3 className="text-sm font-bold text-zinc-300">
        Daftar klip ({clips.length}) — {selectedCount} dipilih untuk render
      </h3>
      {clips.length === 0 && (
        <Card>
          <p className="text-sm text-zinc-500">
            Belum ada klip. Buat lewat pembuat klip manual di atas.
          </p>
        </Card>
      )}
      {clips.map((clip, i) => (
        <ClipCard
          key={clip.id}
          clip={clip}
          index={i}
          videoRef={videoRef}
          videoUrl={videoUrl}
          turns={turns}
          onPatch={(p) => patch(clip.id, p)}
          onDelete={() => remove(clip.id)}
        />
      ))}
    </div>
  );
}
