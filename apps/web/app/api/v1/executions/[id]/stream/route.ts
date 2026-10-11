// Execution SSE delivered through the web server without buffering. The generic /api/v1 rewrite
// lets the Next.js server gzip the proxied body, which holds back an open stream (a run waiting
// for a human) indefinitely. This handler pipes the upstream body chunk by chunk instead, marks it
// no-transform so no compressor touches it, and reads API_INTERNAL_URL at runtime.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EXECUTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SSE_RESPONSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "Content-Encoding": "identity",
  "X-Accel-Buffering": "no",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!EXECUTION_ID.test(id)) {
    return Response.json({ detail: "Execution not found" }, { status: 404 });
  }
  const origin = process.env.API_INTERNAL_URL ?? "http://api:8000";
  const headers = new Headers({ Accept: "text/event-stream", "Accept-Encoding": "identity" });
  const lastEventId = request.headers.get("last-event-id");
  if (lastEventId) headers.set("Last-Event-ID", lastEventId);

  let upstream: Response;
  try {
    upstream = await fetch(`${origin}/api/v1/executions/${id}/stream`, {
      headers,
      cache: "no-store",
      signal: request.signal,
    });
  } catch {
    return Response.json({ detail: "Execution stream unavailable" }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.json().catch(() => ({ detail: "Execution stream unavailable" }));
    return Response.json(detail, { status: upstream.ok ? 502 : upstream.status });
  }
  return new Response(upstream.body, { status: 200, headers: SSE_RESPONSE_HEADERS });
}
