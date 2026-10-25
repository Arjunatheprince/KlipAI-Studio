"use client";
// Langkah 1: Input — drag & drop / pilih file video, atau tempel link.
import { useRef, useState } from "react";
import { Alert, Btn, Card } from "./ui";
import { fetchLinkVideo } from "@/lib/apiClient";

export default function StepInput({
  hasKey,
  onFile,
}: {
  hasKey: boolean | null;
  onFile: (file: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [link, setLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("video/") && !/\.(mp4|webm|mov|mkv|avi)$/i.test(f.name)) {
      setLinkError("File tidak dikenali sebagai video. Pakai MP4/WebM/MOV.");
      return;
    }
    setLinkError("");
    onFile(f);
  };

  const handleLink = async () => {
    const url = link.trim();
    if (!url) return;
    setLinkLoading(true);
    setLinkError("");
    try {
      const blob = await fetchLinkVideo(url);
      const name = "video-dari-link.mp4";
      acceptFile(new File([blob], name, { type: "video/mp4" }));
    } catch (e) {
      // Pesan jujur dari server (mis. diblokir YouTube / yt-dlp belum install).
      setLinkError(e instanceof Error ? e.message : "Gagal mengunduh dari link.");
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">KlipAI ✂️</h1>
        <p className="mt-2 text-zinc-400">
          Ubah video panjang jadi klip-klip vertikal 9:16 bersubtitle otomatis.
        </p>
      </div>

      {hasKey === false && (
        <Alert tone="warn">
          API key dev.meta.ai belum dipasang di server — <b>mode otomatis (AI) nonaktif</b>.
          Mode manual tetap bisa dipakai penuh. Lihat README untuk cara memasang key.
        </Alert>
      )}

      <Card
        className={`cursor-pointer border-2 border-dashed text-center transition ${
          dragOver ? "border-yellow-400 bg-zinc-800" : "border-zinc-700 hover:border-zinc-500"
        }`}
      >
        <div
          className="py-10"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="text-4xl">🎬</div>
          <p className="mt-3 font-semibold">Seret & letakkan file video di sini</p>
          <p className="mt-1 text-sm text-zinc-400">atau klik untuk memilih file</p>
          <p className="mt-2 text-xs text-zinc-500">MP4 / WebM / MOV — video milikmu sendiri</p>
          <input
            ref={fileRef}
            type="file"
            accept="video/*,.mkv,.avi"
            className="hidden"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </div>
      </Card>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-zinc-800" />
        <span>atau tempel link (best-effort)</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <Card className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-zinc-400">Link video (mis. YouTube)</span>
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="https://..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLink()}
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm"
            />
            <Btn onClick={handleLink} disabled={linkLoading || !link.trim()}>
              {linkLoading ? "Mengunduh…" : "Ambil video"}
            </Btn>
          </div>
        </label>
        <p className="text-xs text-zinc-500">
          Fitur link bersifat best-effort: YouTube bisa memblokir unduhan otomatis kapan saja.
          Jika gagal, download manual lalu upload file-nya di sini.
        </p>
      </Card>

      {linkError && <Alert tone="error">{linkError}</Alert>}
    </div>
  );
}
