import { render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useExecutionStream } from "@/hooks/use-execution-stream";
class FakeEventSource {
  static CLOSED=2; static instance: FakeEventSource; readyState=1; onopen: (()=>void)|null=null; onmessage: ((event:MessageEvent)=>void)|null=null; onerror: (()=>void)|null=null; close=vi.fn();
  addEventListener=vi.fn(); removeEventListener=vi.fn();
  constructor(public url:string){FakeEventSource.instance=this}
}
function Probe(){const [status,setStatus]=useState("idle");const [event,setEvent]=useState("");useExecutionStream("e1",e=>setEvent(e.event_type),setStatus);return <><span>{status}</span><span>{event}</span></>}
describe("execution SSE stream",()=>{
  afterEach(()=>vi.unstubAllGlobals());
  it("connects, consumes events and closes cleanly",async()=>{vi.stubGlobal("EventSource",FakeEventSource);const view=render(<Probe/>);expect(FakeEventSource.instance.url).toContain("/executions/e1/stream");FakeEventSource.instance.onopen?.();FakeEventSource.instance.onmessage?.({data:JSON.stringify({event_type:"agent.started"})} as MessageEvent);await waitFor(()=>expect(view.getByText("agent.started")).toBeInTheDocument());view.unmount();expect(FakeEventSource.instance.close).toHaveBeenCalled()});
  it("surfaces reconnect state",async()=>{vi.stubGlobal("EventSource",FakeEventSource);const view=render(<Probe/>);FakeEventSource.instance.onerror?.();await waitFor(()=>expect(view.getByText("reconnecting")).toBeInTheDocument())});
});
