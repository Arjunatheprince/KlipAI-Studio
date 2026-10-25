// Ekstraksi audio 100% di browser (tanpa ffmpeg server):
// decode file video -> resample 16kHz mono -> encode WAV -> potong jadi chunk.
//
// Batas endpoint transkripsi Meta: audio <= 10 menit & body <= 32MB per request.
// Chunk 9.5 menit @16kHz mono 16-bit = ~18MB, aman di bawah kedua batas itu.

export const TARGET_SAMPLE_RATE = 16000;
// Chunk 3.5 menit @16kHz mono 16-bit = ~6.7MB (cepat di-upload & transkripsi responsif).
export const CHUNK_MS = 3.5 * 60 * 1000;

function getAudioContext(): AudioContext {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error("Browser tidak mendukung Web Audio API.");
  return new AC();
}

/** Resample satu potongan AudioBuffer ke mono 16kHz (interpolasi linear). */
function resampleChunk(
  buffer: AudioBuffer,
  startSample: number,
  endSample: number,
): Float32Array {
  const srcRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const srcLen = endSample - startSample;
  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) {
    channelData.push(buffer.getChannelData(c).subarray(startSample, endSample));
  }
  const ratio = srcRate / TARGET_SAMPLE_RATE;
  const outLen = Math.max(1, Math.floor(srcLen / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, srcLen - 1);
    const frac = srcPos - i0;
    let sum = 0;
    for (let c = 0; c < channels; c++) {
      const d = channelData[c];
      sum += d[i0] * (1 - frac) + d[i1] * frac;
    }
    out[i] = sum / channels;
  }
  return out;
}

/** Encode Float32 [-1,1] jadi WAV PCM 16-bit mono. */
function encodeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface ExtractedAudio {
  chunks: Blob[];
  /** offset awal tiap chunk dalam ms */
  chunkOffsetsMs: number[];
  durationMs: number;
}

/**
 * Ambil audio dari file video dan pecah jadi chunk WAV siap kirim
 * ke /api/transcribe. onProgress dipanggil dengan 0..1.
 */
export async function extractAudioChunks(
  file: File,
  onProgress?: (p: number) => void,
): Promise<ExtractedAudio> {
  const ctx = getAudioContext();
  let decoded: AudioBuffer;
  try {
    const raw = await file.arrayBuffer();
    decoded = await ctx.decodeAudioData(raw);
  } catch {
    throw new Error(
      "Gagal membaca audio dari file ini. Coba format MP4/WebM/MOV yang umum.",
    );
  } finally {
    void ctx.close().catch(() => undefined);
  }

  const durationMs = Math.round(decoded.duration * 1000);
  const totalSamples = decoded.length;
  const chunkSamples = Math.floor((CHUNK_MS / 1000) * decoded.sampleRate);

  const chunks: Blob[] = [];
  const chunkOffsetsMs: number[] = [];
  const nChunks = Math.max(1, Math.ceil(totalSamples / chunkSamples));
  for (let i = 0; i < nChunks; i++) {
    const startSample = i * chunkSamples;
    const endSample = Math.min(totalSamples, startSample + chunkSamples);
    const mono = resampleChunk(decoded, startSample, endSample);
    chunks.push(encodeWav(mono));
    chunkOffsetsMs.push(Math.round((startSample / decoded.sampleRate) * 1000));
    onProgress?.((i + 1) / nChunks);
  }
  return { chunks, chunkOffsetsMs, durationMs };
}
