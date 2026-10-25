"use client";
// KlipAI — AI Video Clipper.
// Alur: 1) Input → 2) Mode → 3) Proses → 4) Review → 5) Render & unduh.
import { useEffect, useRef, useState } from "react";
import StepInput from "@/components/StepInput";
import StepMode from "@/components/StepMode";
import StepProcess from "@/components/StepProcess";
import ReviewClips from "@/components/ReviewClips";
import RenderPanel from "@/components/RenderPanel";
import { Alert, Btn, Stepper } from "@/components/ui";
import { checkApiStatus } from "@/lib/apiClient";
import type { ClipSuggestion, Mode, Step, Turn } from "@/lib/types";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("input");
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [maxClips, setMaxClips] = useState(5);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [durationMs, setDurationMs] = useState(0);
  const [clips, setClips] = useState<ClipSuggestion[]>([]);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setMounted(true);
    checkApiStatus()
      .then((s) => setHasKey(s.hasKey))
      .catch(() => setHasKey(false));
  }, []);

  useEffect(() => () => {

  }, [videoUrl]);

  const handleFile = (f: File) => {

    setFile(f);
    setVideoUrl(URL.createObjectURL(f));
    setTurns([]);
    setClips([]);
    setDurationMs(0);
    setError("");
    setStep("mode");
  };

  const resetAll = () => {

    setFile(null);
    setVideoUrl("");
    setTurns([]);
    setClips([]);
    setDurationMs(0);
    setError("");
    setStep("input");
  };

  const seek = (ms: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = ms / 1000;
    void v.play().catch(() => undefined);
  };

  if (!mounted) {
    return null;
  }

  return (
    <main className="mx-auto max-w-5xl overflow-x-hidden px-4 py-8">
      <div className="mb-8 flex flex-col items-start justify-between gap-4">
        <Stepper current={step} />
        {step !== "input" && (
          <button onClick={resetAll} className="text-xs text-zinc-500 hover:text-zinc-300">
            ↺ Mulai dari awal (video baru)
          </button>
        )}
      </div>

      {error && (
        <div className="mx-auto mb-6 w-full max-w-2xl space-y-3">
          <Alert tone="error">{error}</Alert>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={() => { setError(""); setStep("mode"); }}>
              ← Kembali
            </Btn>
            {mode === "auto" && (
              <Btn
                variant="ghost"
                onClick={() => {
                  setError("");
                  setMode("manual");
                  setStep("process");
                }}
              >
                Lanjut pakai mode manual →
              </Btn>
            )}
          </div>
        </div>
      )}

      {!error && step === "input" && <StepInput hasKey={hasKey} onFile={handleFile} />}

      {!error && step === "mode" && (
        <StepMode
          hasKey={hasKey}
          mode={mode}
          setMode={setMode}
          maxClips={maxClips}
          setMaxClips={setMaxClips}
          onNext={() => setStep("process")}
          onBack={() => setStep("input")}
        />
      )}

      {!error && step === "process" && file && (
        <StepProcess
          file={file}
          videoUrl={videoUrl}
          mode={mode}
          maxClips={maxClips}
          onDone={(t, d, c) => {
            setTurns(t);
            setDurationMs(d);
            setClips(c);
            setStep("review");
          }}
          onFail={(msg) => setError(msg)}
          onBack={() => setStep("mode")}
        />
      )}

      {!error && (step === "review" || step === "render") && file && (
        <div className="space-y-6">
          {step === "review" && (
            <>
              <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
                <div className="space-y-4 lg:sticky lg:top-6 self-start min-w-0">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3">
                    <p className="mb-2 text-xs font-semibold text-zinc-400">
                      📺 Pemutar Video Utama
                    </p>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      playsInline
                      className="max-h-[50vh] w-full rounded-lg bg-black"
                    />
                    <p className="mt-2 text-[11px] text-zinc-500">
                      {file.name} • klik tombol preview di bawah untuk melihat visual 9:16 atau melompat.
                    </p>
                  </div>
                </div>
                <ReviewClips
                  clips={clips}
                  onChange={setClips}
                  videoRef={videoRef}
                  videoUrl={videoUrl}
                  durationMs={durationMs}
                  turns={turns}
                  onSeek={seek}
                  mode={mode}
                  className="min-w-0 overflow-hidden"
                />
              </div>
              <div className="flex justify-between">
                <Btn variant="ghost" onClick={() => setStep("mode")}>
                  ← Kembali
                </Btn>
                <Btn
                  onClick={() => setStep("render")}
                  disabled={clips.filter((c) => c.selected).length === 0}
                >
                  Lanjut ke render ({clips.filter((c) => c.selected).length} klip) →
                </Btn>
              </div>
            </>
          )}

          {step === "render" && (
            <RenderPanel
              file={file}
              clips={clips}
              turns={turns}
              onBack={() => setStep("review")}
            />
          )}
        </div>
      )}

      <footer className="mt-16 border-t border-zinc-800 pt-4 text-center text-xs text-zinc-600">
        <p>
          KlipAI — prototipe. AI: Meta Model API (dev.meta.ai) • Render: ffmpeg.wasm (gratis,
          di browser).
        </p>
        <p className="mt-1">
          Batasan jujur: subtitle per segmen (bukan per kata) • audio &gt;10 menit di-chunk
          otomatis • link YouTube best-effort • tanpa API key hanya mode manual.
        </p>
      </footer>
    </main>
  );
}
