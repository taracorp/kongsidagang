import { cn } from "@/lib/utils";

export function BarChart({
  data,
  color = "bg-kongsi-grenadine",
  unit = "",
}: {
  data: { label: string; value: number }[];
  color?: string;
  unit?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-[10px]">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-[120px] shrink-0 truncate text-right text-[12px] font-semibold text-kongsi-ink-soft">
            {d.label}
          </div>
          <div className="h-[18px] flex-1 overflow-hidden rounded-[3px] border-2 border-kongsi-ink bg-kongsi-parchment-2">
            <div
              className={cn("h-full", color)}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <div className="w-[42px] shrink-0 font-fraunces text-[13px] font-black text-kongsi-indigo">
            {d.value}
            {unit}
          </div>
        </div>
      ))}
      {data.length === 0 ? (
        <p className="text-[13px] text-kongsi-ink-soft">Belum ada data.</p>
      ) : null}
    </div>
  );
}
