import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "medewerker";

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hour
const ABSOLUTE_TIMEOUT = 8 * 60 * 60 * 1000; // 8 hours
const SESSION_START_KEY = "session_start_time";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isTeamMember: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user role:", error);
        return null;
      }

      return data?.role as AppRole | null;
    } catch (error) {
      console.error("Error fetching user role:", error);
      return null;
    }
  };

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  }, []);

  // Inactivity auto-logout
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      // Only sign out if there's an active session
      if (session) {
        console.log("Sessie verlopen door inactiviteit");
        signOut();
      }
    }, INACTIVITY_TIMEOUT);
  }, [session, signOut]);

  useEffect(() => {
    if (!session) {
      localStorage.removeItem(SESSION_START_KEY);
      return;
    }

    // Track absolute session start
    if (!localStorage.getItem(SESSION_START_KEY)) {
      localStorage.setItem(SESSION_START_KEY, Date.now().toString());
    }

    // Check absolute timeout every minute
    const absoluteCheck = setInterval(() => {
      const start = localStorage.getItem(SESSION_START_KEY);
      if (start && Date.now() - parseInt(start) > ABSOLUTE_TIMEOUT) {
        console.log("Sessie verlopen na 8 uur");
        localStorage.removeItem(SESSION_START_KEY);
        signOut();
      }
    }, 60000);

    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
    
    let lastReset = Date.now();
    const throttledReset = () => {
      const now = Date.now();
      if (now - lastReset > 30000) {
        lastReset = now;
        resetInactivityTimer();
      }
    };

    events.forEach((event) => window.addEventListener(event, throttledReset, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach((event) => window.removeEventListener(event, throttledReset));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      clearInterval(absoluteCheck);
    };
  }, [session, resetInactivityTimer, signOut]);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // Use setTimeout to prevent Supabase deadlock
          setTimeout(async () => {
            const userRole = await fetchUserRole(session.user.id);
            setRole(userRole);
            setIsLoading(false);
          }, 0);
        } else {
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    // THEN get the initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserRole(session.user.id).then((userRole) => {
          setRole(userRole);
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const value: AuthContextType = {
    user,
    session,
    role,
    isLoading,
    signIn,
    signOut,
    isTeamMember: role !== null,
    isAdmin: role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
