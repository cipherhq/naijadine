export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-brand">DineRoot</h1>
          <p className="mt-1 text-sm text-gray-500">Restaurant Onboarding</p>
        </div>
        {children}
      </div>
    </div>
  );
}
