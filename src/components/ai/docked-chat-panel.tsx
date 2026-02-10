"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useParams } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Bot, User, Loader2, X, ChevronRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

export function DockedChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const params = useParams();

  // Extract context from URL
  const meetId = params?.id && pathname.includes("/meets/") ? params.id as string : undefined;
  const teamId = params?.id && pathname.includes("/teams/") ? params.id as string : undefined;

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const requestBody: any = {
        message: userMessage.content,
      };

      if (sessionId) {
        requestBody.sessionId = sessionId;
      }

      // Add context if available
      if (meetId) {
        requestBody.meetId = meetId;
      }
      if (teamId) {
        requestBody.teamId = teamId;
      }

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        const errorDetails = error.details
          ? `: ${JSON.stringify(error.details)}`
          : "";
        throw new Error((error.error || "Failed to send message") + errorDetails);
      }

      const data = await response.json();

      if (!sessionId && data.sessionId) {
        setSessionId(data.sessionId);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
  };

  // Get context description for display
  const getContextDescription = () => {
    if (meetId) return "Viewing a meet";
    if (teamId) return "Viewing a team";
    return "General";
  };

  return (
    <>
      {/* Collapsed Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-auto px-4 py-3 rounded-full shadow-lg z-50 bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
        >
          <Sparkles className="h-5 w-5 text-white" />
          <span className="text-white font-medium">AI</span>
        </Button>
      )}

      {/* Expanded Panel */}
      {isOpen && (
        <div className="fixed bottom-0 right-0 top-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col h-screen">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-slate-900">AI Strategy</h3>
                {meetId || teamId ? (
                  <p className="text-xs text-slate-500">{getContextDescription()}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNewChat}
                  className="text-xs"
                >
                  New
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 min-h-0 px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <Bot className="h-10 w-10 text-slate-400 mb-3" />
                <h4 className="font-semibold text-slate-900 mb-2">
                  AI Strategy Assistant
                </h4>
                <p className="text-sm text-slate-600 max-w-xs mb-4">
                  {meetId
                    ? "Ask me about this meet's strategy, lineups, or optimization."
                    : teamId
                    ? "Ask me about this team's roster, athletes, or performance."
                    : "Ask me about meet strategy, lineup optimization, or team management."}
                </p>
                <div className="text-xs text-slate-500 space-y-1">
                  <p className="font-medium">Try asking:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {meetId ? (
                      <>
                        <li>"How should I optimize this meet?"</li>
                        <li>"What's the best lineup strategy?"</li>
                      </>
                    ) : teamId ? (
                      <>
                        <li>"Who are my best athletes?"</li>
                        <li>"What events should I focus on?"</li>
                      </>
                    ) : (
                      <>
                        <li>"How do I optimize a championship meet?"</li>
                        <li>"What's the best roster strategy?"</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-2",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-1">
                        <Bot className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-900"
                      )}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                    {message.role === "user" && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center mt-1">
                        <User className="h-3.5 w-3.5 text-slate-600" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-2 justify-start">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center mt-1">
                      <Bot className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <div className="bg-slate-100 rounded-lg px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-slate-200 p-4 bg-slate-50 flex-shrink-0">
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  meetId
                    ? "Ask about this meet..."
                    : teamId
                    ? "Ask about this team..."
                    : "Ask about strategy..."
                }
                disabled={loading}
                className="flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
              />
              <Button type="submit" disabled={loading || !input.trim()} size="icon" className="h-9 w-9">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
