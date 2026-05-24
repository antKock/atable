import { Skeleton } from "@/components/ui/skeleton";

export default function HouseholdLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      {/* Title */}
      <Skeleton className="mb-6 h-8 w-36" />

      {/* Household name label + value */}
      <div className="mb-6">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-1 h-6 w-48" />
      </div>

      {/* Join code card — matches CodeDisplay chrome */}
      <div className="mb-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-1.5 h-6 w-32" />
      </div>

      {/* Invite link card — matches InviteLinkDisplay chrome */}
      <div className="mb-6 rounded-xl border border-border bg-muted/50 px-4 py-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-1.5 h-4 w-full max-w-xs" />
      </div>

      {/* Devices label */}
      <Skeleton className="mb-2 h-3 w-20" />
      {/* Device rows */}
      <div className="mb-6 flex flex-col gap-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-background px-4 py-3"
          >
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="mt-1.5 h-3.5 w-1/4" />
          </div>
        ))}
      </div>

      {/* Leave household button */}
      <Skeleton className="h-11 w-40 rounded-lg" />
    </div>
  );
}
