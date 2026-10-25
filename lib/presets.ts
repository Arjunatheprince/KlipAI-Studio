// Preset rasio aspek untuk berbagai platform media sosial.
// Dipakai bersama oleh UI (Review/Preview) dan ffmpegClient (render).

export interface AspectPreset {
  id: string;
  label: string;
  icon: string;
  /** Nama-nama platform yang cocok */
  platforms: string;
  /** Resolusi output piksel */
  width: number;
  height: number;
  /** Ekspresi lebar crop ffmpeg (ffmpeg filter syntax) */
  cropW: string;
  /** Ekspresi tinggi crop ffmpeg */
  cropH: string;
}

export const ASPECT_PRESETS: AspectPreset[] = [
  {
    id: "9:16",
    label: "9:16",
    icon: "📱",
    platforms: "TikTok · Reels · Shorts",
    width: 1080,
    height: 1920,
    cropW: "min(iw,ih*9/16)",
    cropH: "min(ih,iw*16/9)",
  },
  {
    id: "1:1",
    label: "1:1",
    icon: "⬛",
    platforms: "Instagram Feed · Twitter/X",
    width: 1080,
    height: 1080,
    cropW: "min(iw,ih)",
    cropH: "min(iw,ih)",
  },
  {
    id: "4:5",
    label: "4:5",
    icon: "📸",
    platforms: "Instagram Portrait",
    width: 1080,
    height: 1350,
    cropW: "min(iw,ih*4/5)",
    cropH: "min(ih,iw*5/4)",
  },
  {
    id: "16:9",
    label: "16:9",
    icon: "🖥️",
    platforms: "YouTube · Twitter/X · LinkedIn",
    width: 1920,
    height: 1080,
    cropW: "min(iw,ih*16/9)",
    cropH: "min(ih,iw*9/16)",
  },
  {
    id: "4:3",
    label: "4:3",
    icon: "📺",
    platforms: "Facebook · Presentasi",
    width: 1080,
    height: 810,
    cropW: "min(iw,ih*4/3)",
    cropH: "min(ih,iw*3/4)",
  },
];

export function getPreset(id: string): AspectPreset {
  return ASPECT_PRESETS.find((p) => p.id === id) ?? ASPECT_PRESETS[0];
}

export const DEFAULT_ASPECT = "9:16";
