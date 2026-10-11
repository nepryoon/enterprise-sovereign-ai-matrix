"use client";
import { useEffect, useRef } from "react";
import { API_URL } from "@/lib/api";
import { createSseParser } from "@/lib/sse";
import type { TelemetryEvent } from "@/types";

export type StreamConnection = "connecting" | "connected" | "reconnecting" | "error";

const TERMINAL_EVENTS = new Set(["execution.completed", "execution.failed"]);
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 10_000;

class StreamHttpError extends Error {
  constructor(readonly status: number) { super(`Stream request failed (${status})`); }
}

/**
 * Reads the execution SSE stream with fetch so that comments (": connected", heartbeats) count as
 * liveness. "connected" is reported only after the first byte, never on bare response headers.
 * Reconnects with Last-Event-ID and backoff until a terminal event; the reducer deduplicates
 * replayed events by event_id. Returns the time of the last received byte for stale detection.
 */
export function useExecutionStream(id: string | null, onEvent: (event: TelemetryEvent) => void, onConnection: (state: StreamConnection) => void) {
  const handler = useRef(onEvent);
  const connection = useRef(onConnection);
  const lastActivity = useRef(0);
  useEffect(() => { handler.current = onEvent; connection.current = onConnection; }, [onEvent, onConnection]);
  useEffect(() => {
    if (!id) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let lastEventId: string | null = null;
    let failures = 0;
    let terminal = false;
    const report = (state: StreamConnection) => connection.current(state);
    // Idle time counts from subscription; reconnect attempts are not stream activity.
    lastActivity.current = Date.now();

    const connect = async () => {
      controller = new AbortController();
      report(failures === 0 ? "connecting" : "reconnecting");
      const parser = createSseParser((message) => {
        if (message.id) lastEventId = message.id;
        try {
          const event = JSON.parse(message.data) as TelemetryEvent;
          if (TERMINAL_EVENTS.has(event.event_type)) terminal = true;
          handler.current(event);
        } catch { report("error"); }
      });
      try {
        const headers: Record<string, string> = { Accept: "text/event-stream" };
        if (lastEventId) headers["Last-Event-ID"] = lastEventId;
        const response = await fetch(`${API_URL}/executions/${id}/stream`, { headers, cache: "no-store", signal: controller.signal });
        if (!response.ok || !response.body) throw new StreamHttpError(response.status);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let received = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          lastActivity.current = Date.now();
          if (!received) { received = true; failures = 0; report("connected"); }
          parser.push(decoder.decode(value, { stream: true }));
        }
        if (stopped || terminal) return;
      } catch (error) {
        if (stopped) return;
        // Unknown execution or bad request: retrying cannot help.
        if (error instanceof StreamHttpError && error.status >= 400 && error.status < 500) { report("error"); return; }
      }
      if (terminal) return;
      failures += 1;
      report("reconnecting");
      retryTimer = setTimeout(() => { void connect(); }, Math.min(RETRY_BASE_MS * 2 ** (failures - 1), RETRY_MAX_MS));
    };
    void connect();
    return () => { stopped = true; clearTimeout(retryTimer); controller?.abort(); };
  }, [id]);
  return lastActivity;
}
