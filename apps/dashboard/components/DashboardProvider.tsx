'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  phone: string | null;
  email: string | null;
  city: string;
  neighborhood: string;
  cuisine_types: string[];
  pricing_tier: string;
  cover_photo_url: string | null;
  menu_url: string | null;
  logo_url: string | null;
  instagram_handle: string | null;
  website_url: string | null;
  operating_hours: Record<string, { open: string; close: string }> | null;
  deposit_per_guest: number;
  avg_rating: number;
  total_reviews: number;
  max_party_size: number;
  advance_booking_days: number;
  cancellation_hours: number;
  status: string;
  product_type: string;
  business_category: string | null;
  payment_gateway: string | null;
  gateway_subaccount_code: string | null;
  created_at: string;
}

interface DashboardContextType {
  restaurant: Restaurant;
  userId: string;
}

const DashboardContext = createContext<DashboardContextType | null>(null);

export function DashboardProvider({
  restaurant,
  userId,
  children,
}: {
  restaurant: Restaurant;
  userId: string;
  children: ReactNode;
}) {
  return (
    <DashboardContext.Provider value={{ restaurant, userId }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useRestaurant() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useRestaurant must be used within DashboardProvider');
  return ctx.restaurant;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
