// Pemanggilan API routes milik sendiri dari client.
import type { ClipSuggestion, Turn } from "./types";

export async function checkApiStatus(): Promise<{ hasKey: boolean }> {
  const res = await fetch("/api/status");
  if (!res.ok) return { hasKey: false };
  return res.json();
}

export async function transcribeChunk(audioWav: Blob): Promise<{
  turns: Turn[];
  audioDurationMs: number;
}> {
  const form = new FormData();
  form.append("audio", audioWav, "chunk.wav");
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Transkripsi gagal (HTTP ${res.status})`);
  }
  return {
    turns: (data.turns ?? []) as Turn[],
    audioDurationMs: data.audioDurationMs ?? 0,
  };
}

export async function analyzeTranscript(args: {
  turns: Turn[];
  durationMs: number;
  maxClips: number;
}): Promise<ClipSuggestion[]> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Analisis AI gagal (HTTP ${res.status})`);
  }
  return (data.clips ?? []) as ClipSuggestion[];
}

export async function fetchLinkVideo(url: string): Promise<Blob> {
  const res = await fetch("/api/fetch-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const contentType = res.headers.get("content-type") || "";
  if (!res.ok || contentType.includes("application/json")) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || `Unduhan gagal (HTTP ${res.status})`);
  }
  return res.blob();
}
