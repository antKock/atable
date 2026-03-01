import { Skeleton } from "@/components/ui/skeleton";

function CarouselSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 ml-4 h-5 w-28" />
      <div className="flex gap-3 px-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-[3/2] w-56 flex-none rounded-xl lg:w-64"
          />
        ))}
      </div>
    </div>
  );
}

export default function HomeLoading() {
  return (
    <div className="pb-6 pt-6">
      {/* Brand title */}
      <Skeleton className="mb-4 ml-4 h-7 w-20" />
      {/* Search bar */}
      <div className="px-4 pb-4">
        <Skeleton className="h-11 w-full rounded-xl" />
      </div>
      {/* Carousels */}
      <div className="flex flex-col gap-8">
        <CarouselSkeleton />
        <CarouselSkeleton />
      </div>
    </div>
  );
}
