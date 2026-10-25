// Generator file subtitle ASS untuk dibakar ke video via filter `subtitles` ffmpeg.
//
// CATATAN JUJUR: API transkripsi Meta hanya memberi timestamp level turn
// (segmen), bukan per kata — jadi subtitle tampil per segmen, bukan karaoke
// per kata seperti efek TikTok yang sebenarnya.
import { msToAss } from "./format";
import type { Turn } from "./types";

const FONT_NAME = "Inter";
const MAX_CHARS_PER_LINE = 26;
const MAX_LINES = 2;

function cleanText(t: string): string {
  return t
    .replace(/\\/g, "")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bungkus teks jadi maks 2 baris. */
function wrapText(t: string): string {
  const words = cleanText(t).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const next = current ? `${current} ${w}` : w;
    if (next.length <= MAX_CHARS_PER_LINE) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= MAX_LINES) break;
    }
  }
  if (current && lines.length < MAX_LINES) lines.push(current);
  if (words.join(" ").length > lines.join(" ").length) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/\.?$/, "…");
  }
  return lines.join("\\N");
}

const WORDS_PER_CHUNK = 7;

export function buildAss(
  turns: Turn[],
  clipStartMs: number,
  clipEndMs: number,
  fallbackCaption?: string,
  playResX = 1080,
  playResY = 1920,
): string {
  let events: string[] = [];

  for (const t of turns) {
    if (t.endMs <= clipStartMs || t.startMs >= clipEndMs || !t.transcript.trim()) continue;

    const text = t.transcript.trim();
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += WORDS_PER_CHUNK) {
      chunks.push(words.slice(i, i + WORDS_PER_CHUNK).join(" "));
    }

    const totalChars = chunks.reduce((s, c) => s + c.length, 0) || 1;
    const totalDuration = Math.max(1, t.endMs - t.startMs);
    let cursor = t.startMs;

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const ratio = chunk.length / totalChars;
      const dur = Math.round(ratio * totalDuration);
      const end = ci === chunks.length - 1 ? t.endMs : Math.min(cursor + dur, t.endMs);

      // Lewati chunk yang sepenuhnya sebelum batas klip
      if (end <= clipStartMs) {
        cursor = end;
        continue;
      }

      // Clamp ke batas klip: jika cursor < clipStartMs (turn mulai sebelum klip),
      // mulai dari clipStartMs agar subtitle tidak semua muncul di t=0
      const clampedStart = Math.max(cursor, clipStartMs);
      const evtStart = clampedStart - clipStartMs;
      const evtEnd = Math.max(evtStart, Math.min(end, clipEndMs) - clipStartMs);

      if (evtStart < evtEnd) {
        events.push(
          `Dialogue: 0,${msToAss(evtStart)},${msToAss(evtEnd)},TikTok,,0,0,0,,${wrapText(chunk)}`
        );
      }
      cursor = end;
    }
  }

  // Mode manual tanpa transkrip: tampilkan caption sebagai teks overlay sepanjang klip.
  if (events.length === 0 && fallbackCaption && fallbackCaption.trim()) {
    events = [
      `Dialogue: 0,${msToAss(0)},${msToAss(clipEndMs - clipStartMs)},TikTok,,0,0,0,,${wrapText(fallbackCaption)}`,
    ];
  }

  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${playResX}
PlayResY: ${playResY}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TikTok,${FONT_NAME},${Math.round(playResX * 0.059)},&H00FFFFFF,&H000019FF,&H96000000,&H96000000,-1,0,0,0,100,100,0.5,0,1,3,0,2,70,70,${Math.round(playResY * 0.088)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${events.join("\n")}
`;
}
