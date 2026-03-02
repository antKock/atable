import { Skeleton } from "@/components/ui/skeleton";

export default function LibraryLoading() {
  return (
    <div className="px-4 pb-8 pt-6">
      <Skeleton className="mb-6 h-8 w-40 motion-safe:[animation-delay:150ms]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className="aspect-[3/4] w-full rounded-xl motion-safe:[animation-delay:150ms]"
          />
        ))}
      </div>
    </div>
  );
}
