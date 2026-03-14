import { Skeleton } from "@/components/ui/skeleton";

export default function HouseholdLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      {/* Title */}
      <Skeleton className="mb-6 h-8 w-36" />

      {/* Household name label + value */}
      <Skeleton className="mb-1 h-3 w-28" />
      <Skeleton className="mb-6 h-6 w-48" />

      {/* Join code card */}
      <Skeleton className="mb-3 h-16 w-full rounded-xl" />

      {/* Invite link card */}
      <Skeleton className="mb-6 h-16 w-full rounded-xl" />

      {/* Devices label */}
      <Skeleton className="mb-2 h-3 w-20" />
      {/* Device rows */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
