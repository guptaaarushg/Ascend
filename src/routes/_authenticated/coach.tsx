import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { coachChat } from "@/lib/ascend.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/coach")({
  head: () => ({ meta: [{ title: "Ascend Coach, Ask anything" }] }),
  component: CoachPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function CoachPage() {
  const chat = useServerFn(coachChat);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi, I'm your Ascend Coach. Ask me anything about scholarships, FAFSA, internships, summer programs, college, financial aid, essays, careers, or how to find opportunities that fit you. What's on your mind?",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9 }); }, [messages]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const res = await chat({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: res.content }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
    }
  };

  const quick = [
    "How do I apply for FAFSA step by step?",
    "Recommend summer programs that match my profile",
    "Help me write a scholarship essay grounded in my background",
    "What's the difference between need-based and merit aid?",
    "I have no money for application fees, what do I do?",
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-5">
        <h1 className="text-3xl font-bold tracking-tight">Ask the Coach</h1>
        <p className="text-muted-foreground mt-1">A personal mentor for any question about opportunities, applications, aid, or careers.</p>
      </div>

      <Card className="flex flex-col h-[70vh]">
        <div className="border-b px-4 py-3 flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <span className="text-sm font-medium">Ascend Coach</span>
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_h3]:mt-2 [&_h3]:mb-1">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {sending && <div className="text-xs text-muted-foreground">Thinking…</div>}
        </div>
        <CardContent className="border-t p-3 space-y-2">
          {messages.length === 1 && (
            <div className="flex flex-wrap gap-1.5">
              {quick.map((q) => (
                <Button key={q} size="sm" variant="outline" className="h-auto whitespace-normal text-left py-1.5" onClick={() => send(q)}>{q}</Button>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              aria-label="Message the coach"
              placeholder="Ask anything…"
            />
            <Button onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send message">
              <Send className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
