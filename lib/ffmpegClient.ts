// Mesin render di browser memakai ffmpeg.wasm (@ffmpeg/core single-threaded).
//
// Pola yang dipakai:
// - core (ffmpeg-core.js/.wasm) disajikan lokal dari /public/ffmpeg dan
//   dimuat via toBlobURL (tidak butuh header COOP/COEP karena single-threaded).
// - font TTF ditulis ke MEMFS, direferensikan filter `subtitles` via fontsdir='/'
// - Semua argumen diteruskan sebagai array (tanpa shell).
//
// PENTING (@ffmpeg/ffmpeg v0.12):
//   writeFile() dengan Uint8Array SELALU men-TRANSFER buffer ke worker
//   (trans.push(data.buffer) → postMessage dengan transfer list).
//   Setelah transfer, buffer di-detach. Maka:
//   - fontData harus dibuat SALINAN baru setiap kali via rawBytes.slice(0)
//   - inputData dibuat dari File.arrayBuffer() → Uint8Array baru setiap saat ✓
//   - Jika FFmpeg instance rusak, reset ke null agar dibuat ulang

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { buildAss } from "./ass";
import { getPreset } from "./presets";
import type { ClipSuggestion, Turn } from "./types";

let ffmpegInstance: FFmpeg | null = null;

// Cache font sebagai ArrayBuffer murni — jangan pernah di-transfer.
// Setiap kali butuh, ambil salinan (slice) agar buffer asli tidak di-detach.
let fontRawCache: ArrayBuffer | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) return ffmpegInstance;
  const ff = new FFmpeg();
  await ff.load({
    coreURL: await toBlobURL("/ffmpeg/ffmpeg-core.js", "text/javascript"),
    wasmURL: await toBlobURL("/ffmpeg/ffmpeg-core.wasm", "application/wasm"),
  });
  ffmpegInstance = ff;
  return ff;
}

/** Reset paksa instance — dipanggil setelah error agar render berikutnya mulai bersih. */
export function resetFFmpeg() {
  try { ffmpegInstance?.terminate?.(); } catch { /* ignore */ }
  ffmpegInstance = null;
}

/**
 * Kembalikan SALINAN BARU font data setiap kali dipanggil.
 * fontRawCache (ArrayBuffer) tidak pernah langsung di-pass ke writeFile
 * sehingga tidak pernah di-detach oleh transfer.
 */
async function getFontData(): Promise<Uint8Array> {
  if (!fontRawCache) {
    const res = await fetch("/fonts/Inter-Bold.ttf");
    if (!res.ok) throw new Error("File font subtitle tidak ditemukan di /fonts/Inter-Bold.ttf");
    fontRawCache = await res.arrayBuffer();
  }
  // .slice(0) → buat ArrayBuffer BARU → Uint8Array BARU, aman untuk di-transfer
  return new Uint8Array(fontRawCache.slice(0));
}

/**
 * Render satu klip: trim presisi → crop & scale sesuai aspect ratio →
 * (opsional) bakar subtitle ASS → normalisasi audio.
 * Mengembalikan Blob MP4.
 */
export async function renderClip(args: {
  input: File | Blob;
  clip: ClipSuggestion;
  turns: Turn[];
  onProgress?: (ratio: number) => void;
}): Promise<Blob> {
  const { input, clip, turns, onProgress } = args;

  let ff: FFmpeg;
  try {
    ff = await getFFmpeg();
  } catch (e) {
    resetFFmpeg();
    throw e;
  }

  const startSec = Math.max(0, clip.startMs / 1000);
  const durSec = Math.max(0.5, (clip.endMs - clip.startMs) / 1000);
  const xOff = Math.max(-600, Math.min(600, Math.round(clip.cropXOffset || 0)));
  const useSubtitle = clip.showSubtitle !== false;

  // Dapatkan preset dimensi sesuai rasio aspek klip
  const preset = getPreset(clip.aspectRatio ?? "9:16");
  const { width: outW, height: outH, cropW, cropH } = preset;

  try {
    // ① Input: fetchFile menghasilkan Uint8Array baru dari Blob setiap kali → aman
    const inputData = await fetchFile(input);
    await ff.writeFile("input.mp4", inputData);

    // ② Font & subtitle (hanya jika subtitle aktif)
    if (useSubtitle) {
      await ff.writeFile("font.ttf", await getFontData());
      await ff.writeFile(
        "clip.ass",
        buildAss(turns, clip.startMs, clip.endMs, clip.caption, outW, outH),
      );
    }

    // ③ Video filter: crop sesuai rasio aspek → scale ke resolusi output
    const x = `min(max((iw-ow)/2+${xOff},0),iw-ow)`;
    const y = `(ih-oh)/2`;
    const cropAndScale =
      `crop=w='${cropW}':h='${cropH}':x='${x}':y='${y}',` +
      `scale=${outW}:${outH}`;

    const vf = useSubtitle
      ? `${cropAndScale},subtitles=clip.ass:fontsdir='/'`
      : cropAndScale;

    let stderr = "";
    const handleLog = ({ message }: { message: string }) => { stderr += message + "\n"; };
    const handleProgress = ({ progress }: { progress: number }) => {
      onProgress?.(Math.max(0, Math.min(1, progress)));
    };
    ff.on("log", handleLog);
    ff.on("progress", handleProgress);

    let exitCode: number;
    try {
      exitCode = await ff.exec([
      "-ss", startSec.toFixed(3),
      "-i", "input.mp4",
      "-t", durSec.toFixed(3),
      "-vf", vf,
      "-af", "dynaudnorm",
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "25",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-y", "out.mp4",
      ]);
    } finally {
      ff.off("log", handleLog);
      ff.off("progress", handleProgress);
    }

    if (exitCode !== 0) {
      throw new Error(`FFmpeg error (code ${exitCode}):\n${stderr.slice(-500)}`);
    }

    const data = await ff.readFile("out.mp4");
    if (typeof data === "string") throw new Error("Hasil render tidak valid (data bertipe string).");
    if (data.byteLength === 0) throw new Error("Hasil render 0 byte (kosong).");

    return new Blob([data.slice()], { type: "video/mp4" });

  } finally {
    await ff.deleteFile("input.mp4").catch(() => undefined);
    await ff.deleteFile("font.ttf").catch(() => undefined);
    await ff.deleteFile("clip.ass").catch(() => undefined);
    await ff.deleteFile("out.mp4").catch(() => undefined);
  }
}
