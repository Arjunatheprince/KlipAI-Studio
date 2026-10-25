import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Cek apakah API key terpasang — TANPA pernah membocorkan nilainya. */
export async function GET() {
  return NextResponse.json({ hasKey: !!process.env.MODEL_API_KEY });
}
