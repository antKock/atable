import { Skeleton } from "@/components/ui/skeleton";

function CarouselSkeleton() {
  return (
    <div>
      <Skeleton className="mb-3 ml-4 h-6 w-28 motion-safe:[animation-delay:150ms]" />
      <div className="flex gap-3 px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-[3/4] w-44 flex-none rounded-xl lg:w-56 motion-safe:[animation-delay:150ms]"
          />
        ))}
      </div>
    </div>
  );
}

export default function HomeLoading() {
  return (
    <div className="pb-6 pt-6">
      <Skeleton className="mb-6 ml-4 h-8 w-24 motion-safe:[animation-delay:150ms]" />
      <div className="flex flex-col gap-8">
        <CarouselSkeleton />
        <CarouselSkeleton />
      </div>
    </div>
  );
}
