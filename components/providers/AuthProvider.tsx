"use client";

/**
 * AuthProvider
 * Wraps the app with a React context that subscribes to Supabase auth state changes.
 * - On mount: calls getUser() to hydrate initial session state
 * - Subscribes to onAuthStateChange so login/logout propagates instantly app-wide
 * - Shows the loading screen until initial auth resolution completes
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import LoadingScreen from "@/components/ui/LoadingScreen";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, loading: true });

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Hydrate initial state — getUser() revalidates against Supabase server
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Subscribe to auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Show loading screen while resolving initial auth state
  if (loading) return <LoadingScreen label="Authenticating…" />;

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
