import { Skeleton } from "~/components/ui/skeleton";

export function ProfileCardSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-3 w-16 hidden md:block" />
    </div>
  );
}
