import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

const DEMO_KEY = "bs4u_demo_user";

export interface DemoUser { email: string; role: string; name: string }

export function setDemoSession(u: DemoUser) {
  try { sessionStorage.setItem(DEMO_KEY, JSON.stringify(u)); } catch {}
}
export function clearDemoSession() {
  try { sessionStorage.removeItem(DEMO_KEY); } catch {}
}
function readDemoSession(): DemoUser | null {
  try { const r = sessionStorage.getItem(DEMO_KEY); return r ? JSON.parse(r) as DemoUser : null; }
  catch { return null; }
}

interface AuthState {
  session: Session | null;
  demoUser: DemoUser | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [demoUser, setDemoUser] = useState<DemoUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check demo session first (no network needed)
    const demo = readDemoSession();
    if (demo) { setDemoUser(demo); setLoading(false); return; }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setDemoUser(null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, demoUser, isAuthenticated: !!(session || demoUser), loading };
}
