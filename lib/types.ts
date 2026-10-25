// Tipe data bersama antara client dan API routes.

export interface Turn {
  turnId: number;
  /** milidetik relatif terhadap awal audio chunk (sudah di-offset per chunk di client) */
  startMs: number;
  endMs: number;
  transcript: string;
  speaker: string;
}

export interface ClipSuggestion {
  id: string;
  startMs: number;
  endMs: number;
  title: string;
  caption: string;
  reason: string;
  selected: boolean;
  /** offset horizontal crop dalam piksel, 0 = tengah */
  cropXOffset: number;
  /** tampilkan subtitle di preview & render, default true */
  showSubtitle: boolean;
  /** rasio aspek output: '9:16' | '1:1' | '4:5' | '16:9' | '4:3', default '9:16' */
  aspectRatio: string;
  /** hasil render */
  blobUrl?: string;
  fileName?: string;
}


export type Mode = "auto" | "manual";

export type Step = "input" | "mode" | "process" | "review" | "render";

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}
