import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}>({ session: null, loading: true, signOut: async () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queries = useQueryClient();
  useEffect(() => {
    let mounted = true;
    void supabase!.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setLoading(false);
      }
    });
    const { data } = supabase!.auth.onAuthStateChange((event, next) => {
      setSession(next);
      setLoading(false);
      if (event === "SIGNED_OUT") queries.clear();
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [queries]);
  const signOut = async () => {
    await supabase!.auth.signOut({ scope: "local" });
    queries.clear();
    setSession(null);
  };
  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
