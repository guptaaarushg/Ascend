import { createFileRoute, Outlet, redirect, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Compass, MessageSquare, Route as RouteIcon, UserRound, LogOut, Shield, Heart, Bookmark } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState(false);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const signOutPending = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!active || signOutPending.current || !userData.user) return;
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userData.user.id),
        supabase.from("profiles").select("onboarded").eq("id", userData.user.id).maybeSingle(),
      ]);
      if (!active || signOutPending.current) return;
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      setOnboarded(profile?.onboarded ?? false);
    })();
    return () => { active = false; };
  }, [location.pathname]);

                                     
  useEffect(() => {
    if (!signOutPending.current && onboarded === false && location.pathname !== "/onboarding" && location.pathname !== "/profile") {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [onboarded, location.pathname, navigate]);

  const handleSignOut = async () => {
    if (signOutPending.current) return;
    signOutPending.current = true;
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await navigate({ to: "/auth", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sign out failed. Please try again.");
    } finally {
      signOutPending.current = false;
      setSigningOut(false);
    }
  };

    const navItems = [
      { to: "/feed", label: "Feed", icon: Compass },
      { to: "/tracker", label: "Tracker", icon: Bookmark },
      { to: "/life-path", label: "Life Path", icon: RouteIcon },
      { to: "/coach", label: "Coach", icon: MessageSquare },
      { to: "/support", label: "Support", icon: Heart },
      { to: "/profile", label: "Profile", icon: UserRound },
    ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4 flex h-14 items-center justify-between">
          <Link to="/feed" aria-label="Ascend home">
            <Logo size="sm" />
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={cn(
                  "px-2.5 sm:px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 shrink-0 hover:bg-accent/40 transition",
                  location.pathname === item.to && "bg-accent/60 text-accent-foreground font-medium"
                )}
              >
                <item.icon className="size-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
            <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={signingOut} className="ml-2" aria-label={signingOut ? "Signing out" : "Sign out"} aria-busy={signingOut}>
              <LogOut className="size-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-6 mt-10">
        <div className="container mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>Ascend</span>
          <div className="flex items-center gap-5">
            <Link to="/contact" className="hover:text-foreground transition-colors">
              Feedback and contact
            </Link>
          </div>
        </div>
      </footer>
    </div>

  );
}
