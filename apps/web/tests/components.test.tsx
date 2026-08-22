import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AgentMatrix } from "@/components/agent-matrix";
import { ApprovalModal } from "@/components/approval-modal";
import { StatusBadge } from "@/components/status-badge";
const execution = {execution_id:"12345678-abcd",correlation_id:"cid",status:"WAITING_APPROVAL" as const,risk_level:"HIGH",data_sensitivity:"INTERNAL",current_node:"approval",created_at:"",updated_at:"",evidence:["Blast radius exceeds threshold"]};
describe("Mission Control components",()=>{
  it("renders all agent matrix telemetry",()=>{ render(<AgentMatrix agents={[{id:"risk_analysis",role:"Change risk",status:"COMPLETED",modelClass:"REASONING",provider:"litellm",latency:420,promptTokens:125,completionTokens:68,cost:.00042,outcome:"Success"}]}/>); expect(screen.getByText("risk analysis")).toBeInTheDocument(); expect(screen.getByText("420 ms")).toBeInTheDocument(); expect(screen.getByText("Success")).toBeInTheDocument(); });
  it("uses accessible human-readable statuses",()=>{render(<StatusBadge status="WAITING_APPROVAL"/>);expect(screen.getByText("Waiting Approval")).toBeInTheDocument()});
  it("captures rationale and approves",async()=>{const user=userEvent.setup();const action=vi.fn().mockResolvedValue(undefined);render(<ApprovalModal execution={execution} busy={false} onDecision={action}/>);expect(screen.getByRole("dialog",{name:"Human decision required"})).toBeInTheDocument();expect(screen.getByText("Blast radius exceeds threshold")).toBeInTheDocument();await user.type(screen.getByRole("textbox"),"Rollback verified");await user.click(screen.getByRole("button",{name:"Approve & resume"}));expect(action).toHaveBeenCalledWith("approve","Rollback verified")});
  it("supports explicit rejection",async()=>{const user=userEvent.setup();const action=vi.fn().mockResolvedValue(undefined);render(<ApprovalModal execution={execution} busy={false} onDecision={action}/>);await user.click(screen.getByRole("button",{name:"Reject change"}));expect(action).toHaveBeenCalledWith("reject","")});
});
