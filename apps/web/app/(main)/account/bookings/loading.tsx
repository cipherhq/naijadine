import { Navbar } from '@/components/Navbar';
import { BookingCardSkeleton } from '@/components/ui/Skeleton';

export default function BookingsLoading() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-6 h-8 w-40 animate-pulse rounded-lg bg-gray-200" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <BookingCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
