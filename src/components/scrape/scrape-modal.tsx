"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogEntry {
  message: string;
  ts: string;
  type: "info" | "error" | "success";
}

interface ScrapeModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  endpoint?: string;
  body?: Record<string, unknown>;
  title?: string;
}

export function ScrapeModal({ open, onClose, onComplete, endpoint = "/api/scrape/stream", body, title = "Pipeline" }: ScrapeModalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<"connecting" | "running" | "done" | "error">("connecting");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;

    setLogs([]);
    setStatus("connecting");

    const abort = new AbortController();
    abortRef.current = abort;

    async function run() {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: abort.signal,
        });

        if (!res.ok) {
          const data = await res.json();
          setLogs([{ message: data.error || "Failed to start scrape", ts: new Date().toISOString(), type: "error" }]);
          setStatus("error");
          return;
        }

        setStatus("running");

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7);
            } else if (line.startsWith("data: ")) {
              const data = line.slice(6);
              try {
                const parsed = JSON.parse(data);

                if (currentEvent === "log") {
                  const isError = parsed.message.startsWith("✗") || parsed.message.startsWith("⚠");
                  const isSuccess = parsed.message.includes("✓") || parsed.message.includes("complete");
                  setLogs((prev) => [
                    ...prev,
                    {
                      message: parsed.message,
                      ts: parsed.ts,
                      type: isError ? "error" : isSuccess ? "success" : "info",
                    },
                  ]);
                } else if (currentEvent === "done") {
                  setStatus("done");
                  onComplete();
                } else if (currentEvent === "error") {
                  setLogs((prev) => [
                    ...prev,
                    { message: parsed.message, ts: new Date().toISOString(), type: "error" },
                  ]);
                  setStatus("error");
                }
              } catch {
                // ignore parse errors
              }
              currentEvent = "";
            }
          }
        }

      } catch (err) {
        if (abort.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Connection failed";
        setLogs((prev) => [...prev, { message: msg, ts: new Date().toISOString(), type: "error" }]);
        setStatus("error");
      }
    }

    run();

    return () => {
      abort.abort();
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (!open) return null;

  const canClose = status === "done" || status === "error";

  const statusLabel =
    status === "connecting"
      ? "Starting..."
      : status === "running"
        ? `${title} Running...`
        : status === "done"
          ? `${title} Complete`
          : `${title} Failed`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={canClose ? onClose : undefined}
      />

      {/* Modal card */}
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            {status === "running" || status === "connecting" ? (
              <svg className="w-5 h-5 text-gray-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" />
              </svg>
            ) : status === "done" ? (
              <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
            <span className="text-sm font-semibold text-gray-900">
              {statusLabel}
            </span>
          </div>
          {canClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Log area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto bg-gray-950 mx-4 my-4 rounded-lg px-4 py-3 min-h-[280px] max-h-[400px]"
        >
          {status === "connecting" && logs.length === 0 && (
            <p className="text-sm text-gray-500">Initializing...</p>
          )}
          {logs.map((entry, i) => (
            <div key={i} className="py-0.5 text-[13px] leading-relaxed">
              <span
                className={cn(
                  entry.type === "error"
                    ? "text-red-400"
                    : entry.type === "success"
                      ? "text-emerald-400"
                      : "text-gray-300"
                )}
              >
                {entry.message}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-gray-100 shrink-0">
          {canClose ? (
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          ) : (
            <span className="text-xs text-gray-400">
              {logs.length} log entries
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
