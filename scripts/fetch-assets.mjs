// Mengunduh aset biner yang dibutuhkan saat render:
// 1. Font TTF untuk subtitle (dibakar ke video via filter subtitles/ass)
// 2. ffmpeg.wasm single-threaded core (dijalankan lokal dari /public/ffmpeg,
//    supaya tidak bergantung pada CDN saat render)
import { mkdirSync, existsSync, createWriteStream } from "node:fs";
import { get } from "node:https";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const ASSETS = [
  {
    url: "https://cdn.jsdelivr.net/npm/@expo-google-fonts/inter@0.4.2/700Bold/Inter_700Bold.ttf",
    dest: "public/fonts/Inter-Bold.ttf",
  },
  {
    url: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js",
    dest: "public/ffmpeg/ffmpeg-core.js",
  },
  {
    url: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm",
    dest: "public/ffmpeg/ffmpeg-core.wasm",
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    get(url, { headers: { "User-Agent": "klipai-fetch-assets" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} untuk ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => reject(err));
  });
}

for (const { url, dest } of ASSETS) {
  const full = join(root, dest);
  mkdirSync(dirname(full), { recursive: true });
  if (existsSync(full)) {
    console.log(`lewati (sudah ada): ${dest}`);
    continue;
  }
  console.log(`unduh: ${url}`);
  await download(url, full);
  console.log(`tersimpan: ${dest}`);
}
console.log("selesai.");
