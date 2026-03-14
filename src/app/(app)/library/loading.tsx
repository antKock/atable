import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryLoading() {
  return (
    <div className="pb-8 pt-6">
      {/* Title */}
      <Skeleton className="mb-4 ml-4 h-8 w-40" />
      {/* Search bar */}
      <div className="px-4 pb-3">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      {/* Filter pills */}
      <div className="flex gap-2 px-3 pb-3">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      {/* Recipe grid */}
      <div className="grid grid-cols-2 gap-3 px-4 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-[3/4] w-full rounded-xl"
          />
        ))}
      </div>
    </div>
  );
}
