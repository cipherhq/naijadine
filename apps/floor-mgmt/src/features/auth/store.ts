import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface SessionState {
  user: User | null;
  restaurantId: string | null;
  role: string | null;
  loading: boolean;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  setRestaurant: (id: string, role: string) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  restaurantId: null,
  role: null,
  loading: true,

  init: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Get first restaurant membership
      const { data: membership } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      set({
        user,
        restaurantId: membership?.restaurant_id || null,
        role: membership?.role || null,
        loading: false,
      });
    } else {
      set({ user: null, loading: false });
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user || null });
    });
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: membership } = await supabase
        .from('restaurant_staff')
        .select('restaurant_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      set({
        user,
        restaurantId: membership?.restaurant_id || null,
        role: membership?.role || null,
      });
    }
    return {};
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, restaurantId: null, role: null });
  },

  setRestaurant: (id, role) => set({ restaurantId: id, role }),
}));
