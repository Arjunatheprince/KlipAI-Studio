import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KlipAI — AI Video Clipper",
  description:
    "Ubah video panjang jadi klip-klip vertikal 9:16 bersubtitle otomatis dengan AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
