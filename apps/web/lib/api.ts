import type { Execution, TelemetryEvent } from "@/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(body.detail ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function createExecution(payload: { request: string; scenario: string }) {
  return request<Execution>("/executions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getExecution(id: string) {
  return request<Execution>(`/executions/${id}`);
}

export function getEvents(id: string) {
  return request<TelemetryEvent[]>(`/executions/${id}/events`);
}

export function decide(
  id: string,
  decision: "approve" | "reject",
  reason: string,
) {
  return request<Execution>(`/executions/${id}/${decision}`, {
    method: "POST",
    body: JSON.stringify({ actor: "operator", reason }),
  });
}
