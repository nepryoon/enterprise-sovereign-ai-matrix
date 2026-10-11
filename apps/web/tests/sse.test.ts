import { describe, expect, it } from "vitest";
import { createSseParser, type SseMessage } from "@/lib/sse";

function parse(chunks: string[]) {
  const messages: SseMessage[] = [];
  const parser = createSseParser((message) => messages.push(message));
  chunks.forEach((chunk) => parser.push(chunk));
  return { messages, parser };
}

describe("SSE parser", () => {
  it("ignores comments and heartbeats and dispatches named events with their id", () => {
    const { messages, parser } = parse([": connected\n\n", "id: e1\nevent: agent.started\ndata: {\"a\":1}\n\n", ": heartbeat\n\n"]);
    expect(messages).toEqual([{ id: "e1", event: "agent.started", data: "{\"a\":1}" }]);
    expect(parser.lastEventId).toBe("e1");
  });
  it("reassembles fields split across chunks, including a CRLF split between chunks", () => {
    const { messages } = parse(["id: e", "2\r", "\nevent: approval.req", "uested\r\ndata: x\r\n", "\r\n"]);
    expect(messages).toEqual([{ id: "e2", event: "approval.requested", data: "x" }]);
  });
  it("joins multi-line data, defaults the type to message and waits for the blank line", () => {
    const { messages } = parse(["data: one\ndata:two\n", "data: three\n"]);
    expect(messages).toEqual([]);
    const done = parse(["data: one\ndata:two\n\n"]);
    expect(done.messages).toEqual([{ id: null, event: "message", data: "one\ntwo" }]);
  });
  it("does not dispatch an event without data and keeps the last id across events", () => {
    const { messages } = parse(["id: e3\nevent: x\n\n", "data: y\n\n"]);
    expect(messages).toEqual([{ id: "e3", event: "message", data: "y" }]);
  });
});
