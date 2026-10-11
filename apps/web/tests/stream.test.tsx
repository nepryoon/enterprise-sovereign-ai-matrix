import { act, render, renderHook, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useExecutionStream } from "@/hooks/use-execution-stream";

const encoder = new TextEncoder();

// A controllable streamed response body, as the web server delivers it chunk by chunk.
function openStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
  return {
    response: new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
    send: (text: string) => controller.enqueue(encoder.encode(text)),
    close: () => controller.close(),
  };
}
const frame = (id: string, type: string) => `id: ${id}\nevent: ${type}\ndata: ${JSON.stringify({ event_id: id, event_type: type })}\n\n`;

function Probe({ id = "e1" }: { id?: string }) {
  const [states, setStates] = useState<string[]>([]);
  const [events, setEvents] = useState<string[]>([]);
  useExecutionStream(id, (e) => setEvents((all) => [...all, e.event_type]), (s) => setStates((all) => [...all, s]));
  return <><span data-testid="state">{states.at(-1)}</span><span data-testid="states">{states.join(",")}</span><span data-testid="events">{events.join(",")}</span></>;
}

describe("execution SSE stream", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("reports connected only after the first byte, counting a comment as that byte", async () => {
    const stream = openStream();
    const fetchMock = vi.fn().mockResolvedValue(stream.response);
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Probe />);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/executions/e1/stream");
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Accept: "text/event-stream" });
    await act(async () => { await Promise.resolve(); });
    expect(view.getByTestId("state")).toHaveTextContent("connecting");
    act(() => stream.send(": connected\n\n"));
    await waitFor(() => expect(view.getByTestId("state")).toHaveTextContent("connected"));
    expect(view.getByTestId("events")).toHaveTextContent("");
    act(() => stream.send(frame("a", "agent.started") + frame("b", "approval.requested")));
    await waitFor(() => expect(view.getByTestId("events")).toHaveTextContent("agent.started,approval.requested"));
  });

  it("reconnects with Last-Event-ID when the stream ends before a terminal event", async () => {
    const first = openStream();
    const second = openStream();
    const fetchMock = vi.fn().mockResolvedValueOnce(first.response).mockResolvedValueOnce(second.response);
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Probe />);
    act(() => { first.send(frame("a", "agent.started")); first.close(); });
    await waitFor(() => expect(view.getByTestId("state")).toHaveTextContent("reconnecting"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2_000 });
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ Accept: "text/event-stream", "Last-Event-ID": "a" });
    act(() => second.send(frame("b", "execution.completed")));
    await waitFor(() => expect(view.getByTestId("events")).toHaveTextContent("agent.started,execution.completed"));
    expect(view.getByTestId("state")).toHaveTextContent("connected");
  });

  it("stops after a terminal event and does not reconnect when the server closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const stream = openStream();
    const fetchMock = vi.fn().mockResolvedValue(stream.response);
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Probe />);
    act(() => { stream.send(frame("z", "execution.failed")); stream.close(); });
    await waitFor(() => expect(view.getByTestId("events")).toHaveTextContent("execution.failed"));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(view.getByTestId("states")).not.toHaveTextContent("reconnecting");
  });

  it("surfaces an error and does not retry an unknown execution", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Probe />);
    await waitFor(() => expect(view.getByTestId("state")).toHaveTextContent("error"));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces reconnect state on a network failure and aborts the request on unmount", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockImplementation((_url: string, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<Probe />);
    await waitFor(() => expect(view.getByTestId("state")).toHaveTextContent("reconnecting"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2), { timeout: 2_000 });
    const signal = (fetchMock.mock.calls[1][1] as RequestInit).signal!;
    view.unmount();
    expect(signal.aborted).toBe(true);
  });

  it("counts only received bytes as activity, not reconnect attempts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(1_000_000);
    const stream = openStream();
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("network")).mockRejectedValueOnce(new TypeError("network")).mockResolvedValueOnce(stream.response);
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useExecutionStream("e1", () => undefined, () => undefined));
    const subscribedAt = result.current.current;
    await act(async () => { await vi.advanceTimersByTimeAsync(3_500); });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.current).toBe(subscribedAt);
    act(() => stream.send(": heartbeat\n\n"));
    await waitFor(() => expect(result.current.current).toBeGreaterThan(subscribedAt));
  });
});
