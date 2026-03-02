import { Skeleton } from "@/components/ui/skeleton";

export default function RecipeDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Hero photo */}
      <Skeleton className="aspect-[4/3] w-full" />

      <div className="px-4 pt-6">
        {/* Title */}
        <Skeleton className="h-7 w-3/4" />

        {/* Tags */}
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>

        {/* Ingredients */}
        <Skeleton className="my-5 h-px w-full" />
        <Skeleton className="mb-3 h-3 w-24" />
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-none" />
          ))}
        </div>

        {/* Steps */}
        <Skeleton className="my-5 h-px w-full" />
        <Skeleton className="mb-4 h-3 w-20" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-6 w-6 flex-shrink-0 rounded-full" />
              <Skeleton className="h-6 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
