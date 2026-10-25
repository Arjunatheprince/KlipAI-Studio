"use client";
// Komponen visual preview video 9:16 (vertikal) dan 16:9 dengan overlay subtitle real-time.
// Subtitle disinkronkan dengan timestamp Turn — setiap Turn dipecah menjadi chunk ≤7 kata.
//
// Subtitle timing menggunakan requestAnimationFrame (60fps) + baca video.currentTime LANGSUNG
// bukan via onTimeUpdate (~4Hz) agar tidak lag saat seek ke posisi panjang (mis. 1299s).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDuration, msToClock } from "@/lib/format";
import type { Turn } from "@/lib/types";

interface ClipVisualPreviewProps {
  videoUrl: string;
  startMs: number;
  endMs: number;
  cropXOffset: number;
  turns: Turn[];
  caption?: string;
  title?: string;
  /** Bila false, overlay subtitle tidak ditampilkan sama sekali */
  showSubtitles?: boolean;
  autoPlay?: boolean;
  onClose?: () => void;
}

// ─── Subtitle unit lebih kecil dari Turn ──────────────────────────────────────
interface SubUnit {
  startMs: number;
  endMs: number;
  text: string;
}

const WORDS_PER_CHUNK = 7;

function buildSubUnits(turns: Turn[]): SubUnit[] {
  const units: SubUnit[] = [];
  for (const turn of turns) {
    const text = turn.transcript.trim();
    if (!text) continue;
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
      chunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(" "));
    }
    const totalChars = chunks.reduce((s, c) => s + c.length, 0) || 1;
    const totalDuration = Math.max(1, turn.endMs - turn.startMs);
    let cursor = turn.startMs;
    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const ratio = chunk.length / totalChars;
      const dur = Math.round(ratio * totalDuration);
      const end = ci === chunks.length - 1 ? turn.endMs : Math.min(cursor + dur, turn.endMs);
      units.push({ startMs: cursor, endMs: end, text: chunk });
      cursor = end;
    }
  }
  return units;
}

/**
 * Cari subtitle untuk waktu ms tertentu.
 * Fungsi PURE — dipanggil di dalam rAF loop tanpa menyentuh React state.
 */
function pickSubtitle(ms: number, units: SubUnit[], caption: string | undefined): string {
  // 1. Exact match
  for (const u of units) {
    if (u.startMs <= ms && ms < u.endMs) return u.text;
  }
  // 2. Gap setelah unit (≤500ms): pertahankan teks sebelumnya
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i];
    if (u.endMs <= ms && ms - u.endMs <= 500) return u.text;
  }
  // 3. Gap sebelum unit (≤300ms): tampilkan lebih awal
  for (const u of units) {
    if (u.startMs > ms && u.startMs - ms <= 300) return u.text;
  }
  return caption?.trim() ?? "";
}

// ─── Komponen utama ───────────────────────────────────────────────────────────
export default function ClipVisualPreview({
  videoUrl,
  startMs,
  endMs,
  cropXOffset,
  turns,
  caption,
  title,
  showSubtitles = true,
  autoPlay = true,
  onClose,
}: ClipVisualPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(startMs);       // untuk scrubber (throttle)
  const [activeSubtitle, setActiveSubtitle] = useState("");   // hanya update saat teks ganti
  const [aspectMode, setAspectMode] = useState<"9:16" | "16:9">("9:16");
  const [videoDims, setVideoDims] = useState({ width: 1920, height: 1080 });

  const subUnits = useMemo(() => buildSubUnits(turns), [turns]);

  // Ref agar rAF loop bisa baca nilai terbaru tanpa closure stale
  const subUnitsRef = useRef(subUnits);
  subUnitsRef.current = subUnits;
  const captionRef = useRef(caption);
  captionRef.current = caption;
  const startMsRef = useRef(startMs);
  startMsRef.current = startMs;
  const endMsRef = useRef(endMs);
  endMsRef.current = endMs;

  // Ref untuk fade subtitle tanpa re-mount DOM
  const subtitleSpanRef = useRef<HTMLSpanElement>(null);
  const prevSubtitleRef = useRef<string>("");

  // ── Seek + autoplay saat startMs/endMs berubah ─────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startMs / 1000;
    setCurrentMs(startMs);
    if (autoPlay) {
      void v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, [startMs, endMs, autoPlay]);

  // ── rAF loop: polling video.currentTime 60fps ──────────────────────────────
  // Ini menggantikan onTimeUpdate (~4Hz) agar subtitle presisi saat seek jauh.
  useEffect(() => {
    let rafId: number;
    let scrubFrame = 0;
    let isPlayingLocal = false;

    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const ms = v.currentTime * 1000; // presisi, langsung dari browser

        // ① Cek batas akhir klip
        const endBound = endMsRef.current;
        const startBound = startMsRef.current;
        if (!v.paused && ms >= endBound) {
          v.pause();
          v.currentTime = startBound / 1000;
          setIsPlaying(false);
          isPlayingLocal = false;
          setCurrentMs(startBound);
          setActiveSubtitle("");
          prevSubtitleRef.current = "";
          rafId = requestAnimationFrame(tick);
          return;
        }

        // ② Sinkronisasi status play/pause ke state (satu kali per perubahan)
        const nowPlaying = !v.paused;
        if (nowPlaying !== isPlayingLocal) {
          isPlayingLocal = nowPlaying;
          setIsPlaying(nowPlaying);
        }

        // ③ Hitung subtitle dari ms AKTUAL (bukan state) → tidak ada lag
        const newSub = pickSubtitle(ms, subUnitsRef.current, captionRef.current);
        if (newSub !== prevSubtitleRef.current) {
          prevSubtitleRef.current = newSub;
          setActiveSubtitle(newSub);

          // Animasi opacity langsung (bukan via re-mount)
          const span = subtitleSpanRef.current;
          if (span) {
            span.style.opacity = "0";
            setTimeout(() => { span.style.opacity = "1"; }, 70);
          }
        }

        // ④ Update scrubber ~15fps (setiap 4 frame) agar tidak 60 render/detik
        scrubFrame = (scrubFrame + 1) % 4;
        if (scrubFrame === 0) {
          setCurrentMs(Math.round(ms));
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []); // mount/unmount saja — gunakan ref untuk akses nilai terbaru

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (v?.videoWidth && v.videoHeight) {
      setVideoDims({ width: v.videoWidth, height: v.videoHeight });
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) {
      v.pause();
    } else {
      if (v.currentTime * 1000 < startMs || v.currentTime * 1000 >= endMs) {
        v.currentTime = startMs / 1000;
      }
      void v.play().catch(() => undefined);
    }
  };

  const restart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = startMs / 1000;
    void v.play().catch(() => undefined);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const targetMs = Number(e.target.value);
    v.currentTime = targetMs / 1000;
    setCurrentMs(targetMs);
  };

  const clipDuration = Math.max(1, endMs - startMs);
  const elapsedInClip = Math.max(0, currentMs - startMs);
  const xPercent = videoDims.width > 0 ? (cropXOffset / videoDims.width) * 100 : 0;

  // ── Subtitle overlay (shared antara 9:16 dan 16:9) ─────────────────────────
  const SubtitleOverlay = useCallback(
    ({ size = "sm" }: { size?: "sm" | "md" }) => {
      // Bila subtitle dimatikan untuk klip ini, render nothing
      if (!showSubtitles) return null;
      return (
        <div
          className={`absolute ${size === "sm" ? "bottom-10" : "bottom-4"} left-2 right-2 text-center pointer-events-none z-10 px-1`}
          style={{ visibility: activeSubtitle ? "visible" : "hidden" }}
        >
          <span
            ref={subtitleSpanRef}
            className={`inline-block max-w-[92%] rounded-md bg-black/65 px-2 py-1 ${
              size === "sm" ? "text-xs" : "text-sm"
            } font-bold text-white shadow-lg backdrop-blur-sm`}
            style={{
              textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000",
              transition: "opacity 0.12s ease",
            }}
          >
            {activeSubtitle || "\u00a0"}
          </span>
        </div>
      );
    },

    [activeSubtitle, showSubtitles],
  );

  return (
    <div className="mt-3 w-full max-w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 p-3 shadow-inner">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-yellow-300">
            🎬 Visual Preview: {title || "Potongan Klip"}
          </p>
          <p className="text-[11px] text-zinc-400">
            Rentang: {msToClock(startMs)} → {msToClock(endMs)} ({formatDuration(clipDuration)})
            {subUnits.length > 0 && (
              <span className="ml-2 text-green-400">· {subUnits.length} segmen subtitle</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="inline-flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-800 text-xs">
            <button
              onClick={() => setAspectMode("9:16")}
              className={`rounded px-2 py-0.5 font-medium transition ${
                aspectMode === "9:16"
                  ? "bg-yellow-400 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Preview hasil vertikal 9:16"
            >
              📱 9:16
            </button>
            <button
              onClick={() => setAspectMode("16:9")}
              className={`rounded px-2 py-0.5 font-medium transition ${
                aspectMode === "16:9"
                  ? "bg-yellow-400 text-zinc-950 font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Preview video asli 16:9"
            >
              🖥️ Asli
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              title="Tutup preview visual"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Screen Player */}
      <div className="flex justify-center bg-black/60 rounded-xl p-2">
        {aspectMode === "9:16" ? (
          <div className="relative aspect-[9/16] w-48 sm:w-56 max-w-full overflow-hidden rounded-2xl border-2 border-zinc-700 bg-black shadow-2xl">
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              className="absolute top-1/2 left-1/2 h-full max-w-none pointer-events-none"
              style={{ transform: `translate(calc(-50% - ${xPercent}%), -50%)` }}
            />
            <SubtitleOverlay size="sm" />
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/20 transition group"
              >
                <div className="h-12 w-12 rounded-full bg-yellow-400 text-zinc-950 flex items-center justify-center font-bold text-lg shadow-xl group-hover:scale-110 transition">
                  ▶
                </div>
              </button>
            )}
            <div className="absolute top-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-mono text-zinc-300">
              9:16 Crop
            </div>
          </div>
        ) : (
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-black">
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full h-auto"
            />
            <SubtitleOverlay size="md" />
            {!isPlaying && (
              <button
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/10 transition"
              >
                <div className="h-10 w-10 rounded-full bg-yellow-400 text-zinc-950 flex items-center justify-center font-bold shadow-lg">
                  ▶
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Debug bar: timestamp aktual + subtitle */}
      {subUnits.length > 0 && (
        <div className="mt-1.5 rounded bg-zinc-900/80 px-2 py-1 text-[10px] text-zinc-500 font-mono truncate">
          ⏱ {msToClock(currentMs)} &nbsp;|&nbsp; 💬&nbsp;
          <span className="text-zinc-300">{activeSubtitle || "—"}</span>
        </div>
      )}

      {/* Kontrol Player & Scrubber Bar */}
      <div className="mt-3 space-y-2">
        <div className="relative">
          <input
            type="range"
            min={startMs}
            max={endMs}
            value={Math.min(Math.max(currentMs, startMs), endMs)}
            onChange={handleSeek}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-yellow-400"
          />
          {/* Marker titik awal setiap turn */}
          <div className="pointer-events-none absolute inset-y-0 left-0 right-0">
            {turns.map((t, i) => {
              const pct = ((Math.max(t.startMs, startMs) - startMs) / clipDuration) * 100;
              if (pct < 0 || pct > 100) return null;
              return (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2 bg-yellow-400/50 rounded-full"
                  style={{ left: `${pct}%` }}
                  title={`Turn ${i + 1}: ${t.transcript.slice(0, 40)}`}
                />
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2.5 py-1 font-semibold text-zinc-200 hover:bg-zinc-700 transition"
            >
              {isPlaying ? "⏸ Jeda" : "▶ Putar"}
            </button>
            <button
              onClick={restart}
              className="rounded bg-zinc-800 px-2 py-1 text-zinc-300 hover:bg-zinc-700 transition"
              title="Putar dari awal potongan"
            >
              ↺ Awal
            </button>
          </div>

          <div className="font-mono text-zinc-300">
            {msToClock(elapsedInClip)} / {formatDuration(clipDuration)}
          </div>

          <div className="text-[11px] text-zinc-500">
            Crop: <span className="text-yellow-400 font-semibold">{cropXOffset}px</span>
          </div>
        </div>
      </div>
    </div>
  );
}
