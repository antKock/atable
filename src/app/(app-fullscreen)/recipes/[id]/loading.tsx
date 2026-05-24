import { Skeleton } from "@/components/ui/skeleton";

export default function RecipeDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Hero photo with overlaid controls */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
        <Skeleton className="absolute inset-0 rounded-none" />
        {/* Back button */}
        <div
          className="absolute left-3 top-3 h-9 w-9 rounded-full"
          style={{
            background: "#fff",
            boxShadow:
              "0 2px 8px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.10)",
          }}
        />
        {/* Edit + Delete pill */}
        <div
          className="absolute right-3 top-3 h-9 w-[68px] rounded-full"
          style={{
            background: "#fff",
            boxShadow:
              "0 2px 8px rgba(0, 0, 0, 0.18), 0 1px 2px rgba(0, 0, 0, 0.10)",
          }}
        />
      </div>

      <div className="px-4 pt-6">
        {/* Title */}
        <Skeleton className="h-7 w-3/4" />

        {/* Metadata grid — matches MetadataGrid chrome */}
        <div
          className="mt-4 grid grid-cols-[auto_1fr_auto_1fr] items-center gap-x-4 gap-y-3 rounded-lg px-4 py-3"
          style={{
            background: "linear-gradient(168deg, #FFFFFF, #F7F5EE)",
            boxShadow:
              "0 1px 3px rgba(110, 122, 56, 0.05), 0 2px 8px rgba(110, 122, 56, 0.04)",
            border: "1px solid rgba(110, 122, 56, 0.08)",
          }}
        >
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>

        {/* Ingredients */}
        <section className="mt-8">
          <Skeleton className="mb-3.5 h-5 w-32" />
          <div className="pl-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="py-2.5">
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mt-8">
          <Skeleton className="mb-3.5 h-5 w-32" />
          <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-6 w-7 flex-shrink-0" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tags */}
        <div className="mt-8 flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}
