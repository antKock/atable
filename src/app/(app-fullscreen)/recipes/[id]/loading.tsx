import { Skeleton } from "@/components/ui/skeleton";

export default function RecipeDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Hero photo with overlaid back button */}
      <div className="relative">
        <Skeleton className="aspect-[4/3] w-full rounded-none" />
        <Skeleton className="absolute left-3 top-3 h-9 w-9 rounded-full" />
      </div>

      <div className="px-4 pt-6">
        {/* Title */}
        <Skeleton className="h-7 w-3/4" />

        {/* Metadata grid */}
        <div className="mt-4 rounded-lg bg-secondary/50 px-4 py-3">
          <div className="grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-4 gap-y-3">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-4 w-10" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>

        {/* Ingredients */}
        <div className="my-5 h-px bg-border" />
        <Skeleton className="mb-3 h-3 w-24" />
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-none" />
          ))}
        </div>

        {/* Steps */}
        <div className="my-5 h-px bg-border" />
        <Skeleton className="mb-4 h-3 w-20" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-6 w-6 flex-shrink-0 rounded-full" />
              <Skeleton className="h-6 flex-1" />
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="my-5 h-px bg-border" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}
