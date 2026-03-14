import { Skeleton } from "@/components/ui/skeleton";

function CarouselCardSkeleton() {
  return (
    <div className="w-[70vw] flex-none overflow-hidden rounded-xl border border-border/40 bg-background shadow-[0_2px_12px_rgba(0,0,0,0.08)] lg:w-[280px]">
      <Skeleton className="aspect-[3/2] w-full rounded-none" />
      <div className="px-1.5 py-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="mt-1 h-3 w-1/2" />
      </div>
    </div>
  );
}

function CarouselSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 ml-4 h-5 w-28" />
      <div className="flex gap-3 overflow-hidden px-4">
        <CarouselCardSkeleton />
        <CarouselCardSkeleton />
      </div>
    </div>
  );
}

export default function HomeLoading() {
  return (
    <div className="pb-6 pt-6">
      {/* Brand title + household icon */}
      <div className="mb-4 flex items-center justify-between px-4">
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>
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
