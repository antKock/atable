import { Skeleton } from "@/components/ui/skeleton";

export default function HouseholdLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      {/* Title */}
      <Skeleton className="mb-6 h-10 w-52" />

      {/* « Toi » — section label + one profile row */}
      <Skeleton className="mb-2 h-3 w-8" />
      <div className="mb-6 rounded-xl border border-border bg-surface px-4 py-3">
        <Skeleton className="h-4 w-2/5" />
        <Skeleton className="mt-1.5 h-3.5 w-1/3" />
      </div>

      {/* « Tes foyers » — section label + household rows */}
      <Skeleton className="mb-2 h-3 w-20" />
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="px-4 py-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-1.5 h-3.5 w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
