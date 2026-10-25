import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Beri waktu cukup untuk upload chunk besar (efektif saat self-host / dev lokal).
export const maxDuration = 300;

const META_ASR_URL = "https://api.meta.ai/v1/asr/transcribe";
const MAX_AUDIO_BYTES = 32 * 1024 * 1024;

/**
 * POST /api/transcribe
 * Body: multipart/form-data, field `audio` = satu chunk WAV
 * (mono 16-bit PCM 16kHz, <= 9.5 menit).
 * Meneruskan ke Meta Model API (muse-voice-transcribe-1.0, mode DIARIZATION).
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "API key belum dipasang. Isi MODEL_API_KEY di file .env (salin dari .env.example) dengan key dari dev.meta.ai, lalu restart server.",
      },
      { status: 400 },
    );
  }

  let audio: Blob | null = null;
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (f instanceof Blob) audio = f;
  } catch {
    // abaikan, ditangani di bawah
  }
  if (!audio || audio.size === 0) {
    return NextResponse.json(
      { error: "Field `audio` kosong. Kirim satu chunk WAV via multipart." },
      { status: 400 },
    );
  }

  if (audio.size > MAX_AUDIO_BYTES || (audio.type && !audio.type.includes("wav"))) {
    return NextResponse.json(
      { error: "Audio harus berupa WAV dengan ukuran maksimal 32 MB." },
      { status: 413 },
    );
  }

  const outgoing = new FormData();
  outgoing.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          mode: "DIARIZATION",
          model: "muse-voice-transcribe-1.0",
          audioEncoding: "WAV",
          languageBias: ["Indonesian", "English"],
        }),
      ],
      { type: "application/json" },
    ),
  );
  outgoing.append("audio", audio, "chunk.wav");

  let res: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 180000);
  try {
    res = await fetch(META_ASR_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: outgoing,
      signal: controller.signal,
    });
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        error: isAbort
          ? "Request ke api.meta.ai timeout (>3 menit). Coba lagi atau gunakan potongan video lebih pendek."
          : `Tidak bisa menghubungi api.meta.ai: ${e instanceof Error ? e.message : e}`,
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await res.json().catch(() => null)) as {
    turns?: unknown;
    audioDurationMs?: unknown;
    transcript?: unknown;
  } | null;

  if (!res.ok) {
    const hint =
      res.status === 401
        ? "API key ditolak (401). Periksa MODEL_API_KEY di .env."
        : res.status === 413
          ? "Chunk audio kebesaran (413). Batas 32MB / 10 menit per request."
          : res.status === 400
            ? "Request ditolak (400). Pastikan audio WAV mono 16-bit PCM 16kHz dan durasi ≤ 10 menit."
            : `HTTP ${res.status}`;
    return NextResponse.json(
      { error: `API transkripsi Meta menolak: ${hint}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    turns: Array.isArray(data?.turns) ? data.turns : [],
    audioDurationMs: typeof data?.audioDurationMs === "number" ? data.audioDurationMs : 0,
    transcript: typeof data?.transcript === "string" ? data.transcript : "",
  });
}
