import { Navbar } from '@/components/Navbar';
import { RestaurantCardSkeleton } from '@/components/ui/Skeleton';

export default function RestaurantsLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-gray-200" />
        <div className="mb-8 h-12 w-full animate-pulse rounded-xl bg-gray-200" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <RestaurantCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
