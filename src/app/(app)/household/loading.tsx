import { Skeleton } from '@/components/ui/skeleton'

export default function HouseholdLoading() {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-8 pt-6">
      <Skeleton className="mb-6 h-8 w-36" />
      <Skeleton className="mb-4 h-6 w-48" />
      <Skeleton className="mb-3 h-16 w-full rounded-xl" />
      <Skeleton className="mb-6 h-16 w-full rounded-xl" />
      <Skeleton className="h-4 w-32" />
    </div>
  )
}
