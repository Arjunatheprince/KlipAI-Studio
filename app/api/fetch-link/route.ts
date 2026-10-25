import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

export const runtime = "nodejs";
export const maxDuration = 600;

const execFileAsync = promisify(execFile);
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;
const ALLOWED_VIDEO_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

function isAllowedVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_VIDEO_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Cari path direktori ffmpeg: coba via static_ffmpeg dulu, lalu PATH biasa.
 * yt-dlp butuh ffmpeg untuk MERGE video+audio stream YouTube (keduanya terpisah).
 * Tanpa ffmpeg, yt-dlp hanya mengunduh video-only tanpa audio, atau gagal merge.
 */
async function findFfmpegDir(): Promise<string | null> {
  // 1) Coba static_ffmpeg (sudah di-install via: pip install static-ffmpeg)
  try {
    const { stdout } = await execFileAsync(
      "python",
      ["-c", "import static_ffmpeg, shutil; static_ffmpeg.add_paths(); p=shutil.which('ffmpeg'); print(p or '')"],
      { timeout: 20000 },
    );
    const p = stdout.trim();
    if (p && p !== "None") return dirname(p);
  } catch {
    // static_ffmpeg tidak tersedia
  }

  // 2) Coba ffmpeg di PATH sistem
  try {
    const { stdout } = await execFileAsync("where", ["ffmpeg"], { timeout: 5000 });
    const p = stdout.trim().split(/\r?\n/)[0].trim();
    if (p) return dirname(p);
  } catch {
    // ffmpeg tidak ada di PATH
  }

  return null;
}

/**
 * POST /api/fetch-link — BEST-EFFORT.
 * Mencoba mengunduh video dari URL memakai yt-dlp (jika terinstall di server).
 * Berhasil -> mengembalikan file video (video/mp4) dengan audio+video digabung.
 * Gagal / tidak ada yt-dlp -> { ok:false, message } dengan pesan JUJUR.
 * Tidak pernah berpura-pura sukses.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { url?: unknown };
  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!isAllowedVideoUrl(url)) {
    return NextResponse.json(
      { ok: false, message: "URL tidak didukung. Gunakan link HTTPS dari YouTube atau youtu.be." },
      { status: 400 },
    );
  }

  // Periksa yt-dlp tersedia
  try {
    await execFileAsync("yt-dlp", ["--version"], { timeout: 15000 });
  } catch {
    return NextResponse.json({
      ok: false,
      message:
        "yt-dlp belum terinstall di server ini. Install yt-dlp + Python (lihat README bagian Opsional), atau download videonya manual lalu upload file-nya di sini.",
    });
  }

  // Cari ffmpeg untuk merge video+audio
  const ffmpegDir = await findFfmpegDir();

  const dir = await mkdtemp(join(tmpdir(), "klipai-"));
  try {
    const args: string[] = [];

    // Sisipkan --ffmpeg-location di paling depan jika ditemukan
    if (ffmpegDir) {
      args.push("--ffmpeg-location", ffmpegDir);
    }

    args.push(
      "-f", "bv*[vcodec^=avc][height<=720]+ba[ext=m4a]/b[ext=mp4][height<=720]/b",
      "--merge-output-format", "mp4",
      "--no-playlist",
      "--max-filesize", String(MAX_VIDEO_BYTES),
      "-o", join(dir, "video.%(ext)s"),
      url,
    );

    await execFileAsync("yt-dlp", args, {
      timeout: 540000,
      maxBuffer: 64 * 1024 * 1024,
    });

    const files = await readdir(dir);
    const videoFile = files.find((f) => f.startsWith("video."));
    if (!videoFile) throw new Error("yt-dlp tidak menghasilkan file video.");

    const data = await readFile(join(dir, videoFile));
    if (data.byteLength > MAX_VIDEO_BYTES) {
      throw new Error("Ukuran video melebihi batas 500 MB.");
    }
    return new NextResponse(data, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="video.mp4"',
      },
    });
  } catch (err) {
    const execErr = err as { message?: string; stderr?: string };
    const msg = `${execErr.message ?? ""} ${execErr.stderr ?? ""}`;
    const blocked = /sign in|not a bot|bot|403|429|login|private|unavailable/i.test(msg);
    return NextResponse.json({
      ok: false,
      message: blocked
        ? "YouTube memblokir unduhan otomatis saat ini (bot-check / akses dibatasi). Download videonya secara manual, lalu upload file-nya di sini."
        : "Gagal mengunduh dari link tersebut. Coba link lain, atau download manual lalu upload file-nya di sini.",
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
