// Incremental text/event-stream parser (WHATWG HTML "event stream interpretation"). The browser's
// EventSource hides comments and reports "open" before any byte arrives; reading the stream with
// fetch lets the client treat heartbeats as liveness and report "connected" only after data.
export interface SseMessage { id: string | null; event: string; data: string }

export function createSseParser(onMessage: (message: SseMessage) => void) {
  let buffer = "";
  let data: string[] = [];
  let eventType = "";
  let lastEventId: string | null = null;

  const dispatch = () => {
    if (data.length) onMessage({ id: lastEventId, event: eventType || "message", data: data.join("\n") });
    data = [];
    eventType = "";
  };

  const line = (text: string) => {
    if (text === "") return dispatch();
    if (text.startsWith(":")) return;
    const colon = text.indexOf(":");
    const field = colon === -1 ? text : text.slice(0, colon);
    let value = colon === -1 ? "" : text.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") data.push(value);
    else if (field === "event") eventType = value;
    else if (field === "id" && !value.includes("\0")) lastEventId = value;
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      for (;;) {
        const match = /\r\n|\r|\n/.exec(buffer);
        // A trailing CR may be the first half of a CRLF split across chunks.
        if (!match || (match[0] === "\r" && match.index === buffer.length - 1)) break;
        line(buffer.slice(0, match.index));
        buffer = buffer.slice(match.index + match[0].length);
      }
    },
    get lastEventId() { return lastEventId; },
  };
}
