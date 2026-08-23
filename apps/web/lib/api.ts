import type { Execution, TelemetryEvent } from "@/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

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
export interface ExecutionPage { items: Execution[]; total: number; page: number; page_size: number }
export interface MetricsSummary { invocation_count: number; prompt_tokens: number; completion_tokens: number; estimated_cost_eur: number; latency_ms: number }
export function listExecutions(params="page=1&page_size=25") { return request<ExecutionPage>(`/executions?${params}`); }
export function getMetrics() { return request<MetricsSummary>("/observability/metrics"); }
export function getPendingApprovals() { return request<{items:Execution[];total:number}>("/governance/approvals"); }
