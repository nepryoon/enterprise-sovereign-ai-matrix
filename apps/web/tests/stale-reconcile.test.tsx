import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RECONCILE_INTERVAL_MS, STREAM_IDLE_MS, useStaleStreamReconcile } from "@/hooks/use-stale-stream-reconcile";

describe("stale stream polling fallback", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
  afterEach(() => vi.useRealTimers());

  it("polls after 5 s without stream bytes, every 3 s, until the stream speaks again", () => {
    const reconcile = vi.fn();
    const activity = { current: Date.now() };
    renderHook(() => useStaleStreamReconcile(true, activity, reconcile));
    act(() => { vi.advanceTimersByTime(STREAM_IDLE_MS - 1); });
    expect(reconcile).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(reconcile).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(RECONCILE_INTERVAL_MS); });
    expect(reconcile).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(RECONCILE_INTERVAL_MS); });
    expect(reconcile).toHaveBeenCalledTimes(3);
    // A heartbeat arrives: polling pauses until the stream is idle for another 5 s.
    activity.current = Date.now();
    act(() => { vi.advanceTimersByTime(STREAM_IDLE_MS - 1); });
    expect(reconcile).toHaveBeenCalledTimes(3);
    act(() => { vi.advanceTimersByTime(1); });
    expect(reconcile).toHaveBeenCalledTimes(4);
  });

  it("never polls while the stream keeps delivering bytes", () => {
    const reconcile = vi.fn();
    const activity = { current: Date.now() };
    renderHook(() => useStaleStreamReconcile(true, activity, reconcile));
    for (let i = 0; i < 10; i += 1) {
      act(() => { vi.advanceTimersByTime(4_000); });
      activity.current = Date.now();
    }
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("stops polling once the execution is terminal and never starts for a terminal one", () => {
    const reconcile = vi.fn();
    const activity = { current: Date.now() };
    const { rerender } = renderHook(({ active }) => useStaleStreamReconcile(active, activity, reconcile), { initialProps: { active: true } });
    act(() => { vi.advanceTimersByTime(STREAM_IDLE_MS); });
    expect(reconcile).toHaveBeenCalledTimes(1);
    rerender({ active: false });
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});
