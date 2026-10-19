import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sanitizeText } from "@/lib/validation";
import { toast } from "sonner";

const EMAIL = "gupta.aarushg@gmail.com";
const SOCIAL = "aarush.guptaaa";

export const Route = createFileRoute("/contact")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Contact and feedback, Ascend" },
      {
        name: "description",
        content:
          "Send feedback, report a bug, or reach the Ascend team directly by email or social media.",
      },
      { property: "og:title", content: "Contact and feedback, Ascend" },
      {
        property: "og:description",
        content: "Tell us what is working, what is broken, and what you wish Ascend could do.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const TOPICS = [
  { value: "general", label: "General feedback" },
  { value: "bug", label: "Something is broken" },
  { value: "feature", label: "Feature request" },
  { value: "partnership", label: "School or partnership" },
  { value: "other", label: "Other" },
];

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("general");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail((prev) => prev || data.user!.email!);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = sanitizeText(name);
    const cleanEmail = sanitizeText(email);
    const cleanMessage = sanitizeText(message);

    if (cleanName.length < 1) return toast.error("Please add your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return toast.error("Please add a valid email.");
    if (cleanMessage.length < 5) return toast.error("Please write a little more so we can help.");

    setSending(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("feedback").insert({
      user_id: userData.user?.id ?? null,
      name: cleanName.slice(0, 120),
      email: cleanEmail.slice(0, 200),
      topic,
      message: cleanMessage.slice(0, 4000),
    });
    setSending(false);

    if (error) {
      toast.error("That did not send. You can email us directly instead.");
      return;
    }
    setSent(true);
    setMessage("");
    toast.success("Thanks, your message is in.");
  };

  const mailto = `mailto:${EMAIL}?subject=${encodeURIComponent("Ascend feedback")}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link to="/" className="text-2xl font-serif font-semibold tracking-tight">
          Ascend
        </Link>
        <Link to="/auth" className="text-sm font-medium hover:text-primary transition-colors">
          Sign in
        </Link>
      </nav>

      <main className="max-w-5xl mx-auto px-6 pb-24 pt-6">
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight">
          Feedback and contact
        </h1>
        <p className="mt-4 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
          Ascend gets better when students, parents, and counselors tell us what is missing. Send a
          note about a bug, a missing opportunity, or an idea, and it goes straight to us.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="space-y-4 py-4">
                  <p className="text-lg font-medium">Got it, thank you.</p>
                  <p className="text-muted-foreground">
                    We read every message and usually reply within a few days.
                  </p>
                  <Button variant="outline" onClick={() => setSent(false)}>
                    Send another
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Your name</Label>
                      <Input
                        id="contact-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jordan Rivera"
                        maxLength={120}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">Email</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        maxLength={200}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-topic">Topic</Label>
                    <select
                      id="contact-topic"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {TOPICS.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-message">Message</Label>
                    <Textarea
                      id="contact-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={7}
                      maxLength={4000}
                      placeholder="Tell us what happened, what you were trying to do, or what you wish existed."
                      required
                    />
                    <p className="text-xs text-muted-foreground">{message.length}/4000</p>
                  </div>

                  <Button type="submit" disabled={sending} className="w-full sm:w-auto">
                    {sending ? "Sending..." : "Send message"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reach us directly</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-sm">
              <div>
                <p className="font-medium text-foreground">Email</p>
                <a href={mailto} className="text-primary underline underline-offset-4 break-all">
                  {EMAIL}
                </a>
              </div>
              <div>
                <p className="font-medium text-foreground">Instagram</p>
                <a
                  href={`https://instagram.com/${SOCIAL}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  @{SOCIAL}
                </a>
              </div>
              <div>
                <p className="font-medium text-foreground">Facebook</p>
                <a
                  href={`https://facebook.com/${SOCIAL}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-4"
                >
                  {SOCIAL}
                </a>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Ascend is built and maintained by Aarush Gupta. If you are a counselor or a
                nonprofit that wants to bring Ascend to your students, say so in the message and we
                will set it up.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
