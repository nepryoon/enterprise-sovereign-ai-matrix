"use client";
import { useEffect, useRef } from "react";
import { API_URL } from "@/lib/api";
import type { TelemetryEvent } from "@/types";
export function useExecutionStream(id: string | null, onEvent: (event: TelemetryEvent) => void, onConnection: (state: "connecting" | "connected" | "reconnecting" | "error") => void) {
  const handler = useRef(onEvent); handler.current = onEvent;
  useEffect(() => {
    if (!id) return;
    onConnection("connecting");
    const source = new EventSource(`${API_URL}/executions/${id}/stream`);
    source.onopen = () => onConnection("connected");
    const consume = (message: MessageEvent<string>) => { try { handler.current(JSON.parse(message.data) as TelemetryEvent); } catch { onConnection("error"); } };
    source.onmessage = consume;
    const eventTypes = ["execution.started", "agent.started", "agent.completed", "agent.failed", "routing.selected", "approval.requested", "approval.approved", "approval.rejected", "execution.completed", "execution.failed"];
    eventTypes.forEach((eventType) => source.addEventListener(eventType, consume as EventListener));
    source.onerror = () => onConnection(source.readyState === EventSource.CLOSED ? "error" : "reconnecting");
    return () => { eventTypes.forEach((eventType) => source.removeEventListener(eventType, consume as EventListener)); source.close(); };
  }, [id, onConnection]);
}
