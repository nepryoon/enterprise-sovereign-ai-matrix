import { afterEach, describe, expect, it, vi } from "vitest";
import { createExecution, decide } from "@/lib/api";
afterEach(()=>vi.restoreAllMocks());
describe("API commands",()=>{
  it("submits a workflow",async()=>{const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(JSON.stringify({execution_id:"e1"}),{status:200,headers:{"Content-Type":"application/json"}}));await createExecution({request:"Assess",scenario:"SAFE"});expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/executions"),expect.objectContaining({method:"POST"}))});
  it("sends approval rationale and reports backend errors",async()=>{const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response(JSON.stringify({execution_id:"e1"}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify({detail:"not waiting"}),{status:409,headers:{"Content-Type":"application/json"}}));await decide("e1","approve","accepted");await expect(decide("e1","reject","late")).rejects.toThrow("not waiting");expect(fetcher).toHaveBeenCalledTimes(2)});
});
