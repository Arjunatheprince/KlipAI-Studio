// Komponen UI kecil yang dipakai ulang.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { Step } from "@/lib/types";

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Btn({ variant = "primary", className = "", ...rest }: BtnProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-yellow-400 text-zinc-950 hover:bg-yellow-300",
    ghost: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700",
    danger: "bg-red-600 text-white hover:bg-red-500",
  } as const;
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-zinc-900 p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="w-full">
      {label && (
        <div className="mb-1 flex justify-between text-xs text-zinc-400">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-yellow-400 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const STEPS: { id: Step; label: string }[] = [
  { id: "input", label: "1. Input" },
  { id: "mode", label: "2. Mode" },
  { id: "process", label: "3. Proses" },
  { id: "review", label: "4. Review" },
  { id: "render", label: "5. Render" },
];

export function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex flex-wrap gap-2">
      {STEPS.map((s, i) => (
        <li
          key={s.id}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            i < idx
              ? "bg-zinc-800 text-zinc-400"
              : i === idx
                ? "bg-yellow-400 text-zinc-950"
                : "bg-zinc-900 text-zinc-500 border border-zinc-800"
          }`}
        >
          {s.label}
        </li>
      ))}
    </ol>
  );
}

/** Input waktu dalam menit dan detik, disimpan sebagai milidetik. */
export function TimeInput({
  label,
  ms,
  onChange,
  max,
}: {
  label: string;
  ms: number;
  onChange: (ms: number) => void;
  max?: number;
}) {
  const totalSecs = Math.max(0, ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;

  const handleM = (val: number) => {
    let newSecs = val * 60 + s;
    if (max !== undefined && newSecs * 1000 > max) newSecs = max / 1000;
    onChange(newSecs * 1000);
  };

  const handleS = (val: number) => {
    let newSecs = m * 60 + val;
    if (max !== undefined && newSecs * 1000 > max) newSecs = max / 1000;
    onChange(newSecs * 1000);
  };

  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 focus-within:border-zinc-500">
          <input
            type="number"
            className="w-full bg-transparent text-right text-sm text-zinc-100 outline-none"
            value={m}
            min={0}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 0;
              handleM(Math.max(0, v));
            }}
          />
          <span className="text-xs text-zinc-500">m</span>
        </div>
        <span className="text-zinc-600">:</span>
        <div className="flex-1 flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 focus-within:border-zinc-500">
          <input
            type="number"
            className="w-full bg-transparent text-right text-sm text-zinc-100 outline-none"
            value={Number(s.toFixed(1))}
            min={0}
            max={59.9}
            step={0.5}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              handleS(Math.max(0, v));
            }}
          />
          <span className="text-xs text-zinc-500">s</span>
        </div>
      </div>
    </label>
  );
}

export function Alert({ tone, children }: { tone: "error" | "info" | "warn"; children: ReactNode }) {
  const styles = {
    error: "border-red-800 bg-red-950/60 text-red-200",
    info: "border-sky-800 bg-sky-950/60 text-sky-200",
    warn: "border-amber-800 bg-amber-950/60 text-amber-200",
  } as const;
  return (
    <div className={`rounded-lg border p-3 text-sm ${styles[tone]}`}>{children}</div>
  );
}
