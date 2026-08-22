import { afterEach, describe, expect, it, vi } from "vitest";

import { createExecution, decide } from "@/lib/api";

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

afterEach(() => vi.restoreAllMocks());

describe("API commands", () => {
  it("submits a workflow", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(response({ execution_id: "e1" }));
    await createExecution({ request: "Assess", scenario: "SAFE" });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/executions"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("sends approval rationale and reports backend errors", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response({ execution_id: "e1" }))
      .mockResolvedValueOnce(response({ detail: "not waiting" }, 409));
    await decide("e1", "approve", "accepted");
    await expect(decide("e1", "reject", "late")).rejects.toThrow("not waiting");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
