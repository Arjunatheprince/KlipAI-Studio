"use client";
// Langkah 5: Render — potong + crop 9:16 + subtitle + edit ringan via ffmpeg.wasm,
// lalu unduh per klip / semua sekaligus. Semua jalan di browser.
import { useEffect, useRef, useState } from "react";
import { Alert, Btn, Card, Progress } from "./ui";
import { getFFmpeg, renderClip } from "@/lib/ffmpegClient";
import { formatDuration, msToClock } from "@/lib/format";
import { getPreset } from "@/lib/presets";
import type { ClipSuggestion, Turn } from "@/lib/types";

interface JobState {
  id: string;
  status: "waiting" | "rendering" | "done" | "error";
  progress: number;
  blobUrl?: string;
  fileName?: string;
  error?: string;
}

function safeFileName(title: string, index: number): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "klip";
  return `${String(index + 1).padStart(2, "0")}-${slug}-9x16.mp4`;
}

export default function RenderPanel({
  file,
  clips,
  turns,
  onBack,
}: {
  file: File;
  clips: ClipSuggestion[];
  turns: Turn[];
  onBack: () => void;
}) {
  const selected = clips.filter((c) => c.selected && c.endMs > c.startMs);
  const [engine, setEngine] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [engineError, setEngineError] = useState("");
  const [jobs, setJobs] = useState<JobState[]>(
    selected.map((c) => ({ id: c.id, status: "waiting", progress: 0 })),
  );
  const [running, setRunning] = useState(false);
  const blobUrls = useRef(new Set<string>());

  useEffect(() => () => {
    blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.current.clear();
  }, []);

  const patchJob = (id: string, p: Partial<JobState>) =>
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, ...p } : j)));

  const startRender = async () => {
    if (running) return;
    setRunning(true);
    blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    blobUrls.current.clear();
    setJobs(selected.map((clip) => ({ id: clip.id, status: "waiting", progress: 0 })));
    try {
      setEngine("loading");
      await getFFmpeg();
      setEngine("ready");
    } catch (e) {
      setEngine("error");
      setEngineError(e instanceof Error ? e.message : "Gagal memuat ffmpeg.wasm.");
      setRunning(false);
      return;
    }

    for (let i = 0; i < selected.length; i++) {
      const clip = selected[i];
      patchJob(clip.id, { status: "rendering", progress: 0 });
      try {
        const blob = await renderClip({
          input: file,
          clip,
          turns,
          onProgress: (r) => patchJob(clip.id, { progress: r }),
        });
        const blobUrl = URL.createObjectURL(blob);
        blobUrls.current.add(blobUrl);
        patchJob(clip.id, {
          status: "done",
          progress: 1,
          blobUrl,
          fileName: safeFileName(clip.title, i),
        });
      } catch (e) {
        patchJob(clip.id, {
          status: "error",
          error: e instanceof Error ? e.message : "Render gagal.",
        });
      }
    }
    setRunning(false);
  };

  const downloadOne = (blobUrl: string, fileName: string) => {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const downloadAll = () => {
    jobs.forEach((j, i) => {
      if (j.status === "done" && j.blobUrl && j.fileName) {
        setTimeout(() => downloadOne(j.blobUrl!, j.fileName!), i * 600);
      }
    });
  };

  const doneCount = jobs.filter((j) => j.status === "done").length;

  if (selected.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Alert tone="warn">
          Tidak ada klip yang dipilih. Kembali ke langkah Review dan centang klip yang mau di-render.
        </Alert>
        <Btn variant="ghost" onClick={onBack}>
          ← Kembali ke Review
        </Btn>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <h2 className="text-center text-2xl font-bold">Render & unduh</h2>
      <p className="text-center text-sm text-zinc-400">
        {selected.length} klip • render di browser
      </p>

      {engine === "error" && <Alert tone="error">{engineError}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Btn onClick={startRender} disabled={running || engine === "loading"}>
          {engine === "loading"
            ? "Memuat mesin render…"
            : running
              ? "Merender…"
              : doneCount > 0
                ? "Render ulang"
                : "🚀 Mulai render"}
        </Btn>
        {doneCount > 0 && (
          <Btn variant="ghost" onClick={downloadAll}>
            ⬇ Unduh semua ({doneCount})
          </Btn>
        )}
        <Btn variant="ghost" onClick={onBack}>
          ← Kembali
        </Btn>
      </div>

      {selected.map((clip, i) => {
        const job = jobs.find((j) => j.id === clip.id);
        return (
          <Card key={clip.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {i + 1}. {clip.title}
                </p>
                <p className="font-mono text-xs text-zinc-500">
                  {msToClock(clip.startMs)} → {msToClock(clip.endMs)} ({formatDuration(clip.endMs - clip.startMs)})
                  {" "}•{" "}
                  {(() => { const p = getPreset(clip.aspectRatio ?? "9:16"); return `${p.icon} ${p.label} (${p.width}×${p.height})`; })()}
                  {clip.showSubtitle === false && " • tanpa subtitle"}
                </p>
              </div>
              {job?.status === "done" && job.blobUrl && job.fileName ? (
                <Btn variant="ghost" onClick={() => downloadOne(job.blobUrl!, job.fileName!)}>
                  ⬇ Unduh MP4
                </Btn>
              ) : (
                <span className="text-xs text-zinc-500">
                  {job?.status === "rendering"
                    ? "Merender…"
                    : job?.status === "error"
                      ? "Gagal"
                      : "Menunggu"}
                </span>
              )}
            </div>
            {job && (job.status === "rendering" || job.status === "waiting") && (
              <div className="mt-2">
                <Progress value={job.progress} />
              </div>
            )}
            {job?.status === "error" && (
              <p className="mt-2 text-xs text-red-300">{job.error}</p>
            )}
            {job?.status === "done" && job.blobUrl && (
              <video src={job.blobUrl} controls className="mt-3 max-h-64 w-auto rounded-lg" />
            )}
          </Card>
        );
      })}

      <Alert tone="info">
        Render memakai CPU browser — klip panjang butuh waktu beberapa menit. Jangan tutup tab
        selama render berjalan.
      </Alert>
    </div>
  );
}
