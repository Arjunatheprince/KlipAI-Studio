import { NextRequest, NextResponse } from "next/server";
import { msToClock } from "@/lib/format";
import { newId, type ClipSuggestion, type Turn } from "@/lib/types";
import { DEFAULT_ASPECT } from "@/lib/presets";

export const runtime = "nodejs";
export const maxDuration = 120;

const META_CHAT_URL = "https://api.meta.ai/v1/chat/completions";

interface AnalyzeBody {
  turns?: Turn[];
  durationMs?: number;
  maxClips?: number;
}

const MAX_TURNS = 10000;

/**
 * POST /api/analyze
 * Body JSON: { turns, durationMs, maxClips }
 * Meminta muse-spark-1.3 memilih momen terbaik via structured output (json_schema).
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.MODEL_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "API key belum dipasang. Isi MODEL_API_KEY di file .env dengan key dari dev.meta.ai, lalu restart server.",
      },
      { status: 400 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as AnalyzeBody;
  const turns = Array.isArray(body.turns) ? body.turns.slice(0, MAX_TURNS) : [];
  const durationMs = typeof body.durationMs === "number" && body.durationMs > 0 ? body.durationMs : 0;
  const maxClips = Math.max(1, Math.min(10, Math.round(body.maxClips ?? 5)));

  if (turns.length === 0) {
    return NextResponse.json(
      { error: "Transkrip kosong — tidak ada yang bisa dianalisis." },
      { status: 400 },
    );
  }

  const validTurns = turns.filter(
    (turn) =>
      turn &&
      Number.isFinite(turn.startMs) &&
      Number.isFinite(turn.endMs) &&
      turn.startMs >= 0 &&
      turn.endMs > turn.startMs &&
      typeof turn.transcript === "string" &&
      turn.transcript.length <= 10000,
  );
  if (validTurns.length === 0) {
    return NextResponse.json({ error: "Format transkrip tidak valid." }, { status: 400 });
  }

  const lines = validTurns
    .map(
      (t) =>
        `[${msToClock(t.startMs)}-${msToClock(t.endMs)}] (${t.speaker || "?"}): ${(t.transcript || "").trim()}`,
    )
    .join("\n");
  // Batas aman: konteks 1M token, tapi hemat biaya dengan memotong transkrip raksasa.
  const transcriptText = lines.length > 300000 ? lines.slice(0, 300000) + "\n[...dipotong...]" : lines;

  const systemPrompt =
    "Kamu adalah editor video profesional untuk konten vertikal (TikTok/Reels/Shorts). " +
    "Bahasa: Bahasa Indonesia. Kamu menerima transkrip video bertimestamp dan memilih " +
    "momen-momen paling menarik: hook kuat di awal, punchline, insight mengejutkan, " +
    "atau cerita yang utuh. Setiap klip idealnya 30-90 detik dan bisa berdiri sendiri " +
    "tanpa konteks video penuh.";

  const userPrompt =
    `Durasi total video: ${msToClock(durationMs)}.\n` +
    `Pilih MAKSIMAL ${maxClips} momen terbaik untuk dijadikan klip vertikal.\n\n` +
    `Aturan:\n` +
    `- startMs/endMs dalam MILIDETIK, 0 <= startMs < endMs <= ${durationMs}.\n` +
    `- Durasi tiap klip 30-90 detik (boleh sedikit di luar rentang bila momennya memang butuh).\n` +
    `- Klip tidak boleh tumpang tindih.\n` +
    `- title: judul singkat yang memancing klik (maks 60 karakter).\n` +
    `- caption: 1-2 kalimat deskripsi untuk postingan.\n` +
    `- reason: 1 kalimat kenapa momen ini menarik.\n\n` +
    `TRANSKRIP:\n${transcriptText}`;

  let res: Response;
  try {
    res = await fetch(META_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "muse-spark-1.3",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "clip_suggestions",
            schema: {
              type: "object",
              properties: {
                clips: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      startMs: { type: "number" },
                      endMs: { type: "number" },
                      title: { type: "string" },
                      caption: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["startMs", "endMs", "title", "caption", "reason"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["clips"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Tidak bisa menghubungi api.meta.ai: ${e instanceof Error ? e.message : e}` },
      { status: 502 },
    );
  }

  const data = (await res.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[];
  } | null;

  if (!res.ok) {
    const hint =
      res.status === 401
        ? "API key ditolak (401). Periksa MODEL_API_KEY di .env."
        : `HTTP ${res.status}`;
    return NextResponse.json(
      { error: `API chat Meta menolak: ${hint}` },
      { status: 502 },
    );
  }

  const content = data?.choices?.[0]?.message?.content;
  let parsed: { clips?: { startMs: number; endMs: number; title: string; caption: string; reason: string }[] };
  try {
    parsed = JSON.parse(content ?? "{}");
  } catch {
    return NextResponse.json(
      { error: "AI mengembalikan format yang tidak valid. Coba lagi." },
      { status: 502 },
    );
  }

  // Validasi & clamp agar selalu aman di-render.
  const clips: ClipSuggestion[] = (parsed.clips ?? [])
    .filter(
      (c) =>
        typeof c?.startMs === "number" &&
        typeof c?.endMs === "number" &&
        Number.isFinite(c.startMs) &&
        Number.isFinite(c.endMs),
    )
    .map((c) => {
      const startMs = Math.max(0, Math.round(c.startMs));
      const endMs = durationMs > 0 ? Math.min(durationMs, Math.round(c.endMs)) : Math.round(c.endMs);
      return { ...c, startMs, endMs };
    })
    .filter((c) => c.endMs - c.startMs >= 10000 && c.endMs - c.startMs <= 180000)
    .sort((a, b) => a.startMs - b.startMs)
    .slice(0, maxClips)
    .map((c) => ({
      id: newId(),
      startMs: c.startMs,
      endMs: c.endMs,
      title: String(c.title || "Klip tanpa judul").slice(0, 80),
      caption: String(c.caption || ""),
      reason: String(c.reason || ""),
      selected: true,
      cropXOffset: 0,
      showSubtitle: true,
      aspectRatio: DEFAULT_ASPECT,
    }));

  if (clips.length === 0) {
    return NextResponse.json(
      { error: "AI tidak menghasilkan klip yang valid. Coba lagi atau pakai mode manual." },
      { status: 502 },
    );
  }

  return NextResponse.json({ clips });
}
