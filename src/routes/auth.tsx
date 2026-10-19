import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in, Ascend" },
      { name: "description", content: "Sign in or create an account to discover opportunities matched to your life." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/feed", replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const uname = email.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(uname)) {
      toast.error("Username must be 3 to 30 letters, numbers, dots, or underscores.");
      return;
    }
    const authEmail = `${uname}@ascend-users.app`;
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail,
          password,
          options: { data: { full_name: name || uname, username: uname } },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Welcome to Ascend!");
          navigate({ to: "/feed", replace: true });
        } else {
          toast.success("Account created! You can sign in now.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
        if (error) throw new Error("Wrong username or password.");
        toast.success("Welcome back");
        navigate({ to: "/feed", replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      toast.error(/already registered/i.test(msg) ? "That username is taken." : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 py-10 bg-background">
      <Link to="/" className="mb-8 flex flex-col items-center gap-2" aria-label="Ascend home">
        <Logo size="xl" tone="default" />
        <span className="text-sm text-muted-foreground tracking-wide">Your opportunity engine</span>
      </Link>
      <Card className="w-full max-w-md rounded-[20px] border border-border shadow-lg">
        <CardHeader className="space-y-2 pb-4">
          <CardTitle className="text-2xl">{mode === "signin" ? "Welcome back" : "Create your account"}</CardTitle>
          <CardDescription className="text-base">
            {mode === "signin" ? "Continue discovering opportunities matched to you." : "Pick a username and password to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="username">Username</Label>
              <Input id="username" className="h-11" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" className="h-11" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full h-11 text-base" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="text-sm text-muted-foreground text-center">
            {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-primary font-medium hover:underline">
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
