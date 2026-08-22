import { StatusBadge } from "./status-badge";
import type { AgentView } from "@/types";
export function AgentMatrix({ agents }: { agents: AgentView[] }) {
  return <div className="table-wrap"><table><thead><tr>{["Agent","Role","Status","Model class","Provider","Latency","Prompt","Completion","Cost","Outcome"].map(x => <th key={x}>{x}</th>)}</tr></thead><tbody>{agents.length ? agents.map(a => <tr key={a.id}><td className="agent-name">{a.id.replaceAll("_", " ")}</td><td>{a.role}</td><td><StatusBadge status={a.status}/></td><td>{a.modelClass ?? "—"}</td><td>{a.provider ?? "—"}</td><td>{a.latency ? `${a.latency} ms` : "—"}</td><td>{a.promptTokens || "—"}</td><td>{a.completionTokens || "—"}</td><td>€{a.cost.toFixed(5)}</td><td>{a.outcome}</td></tr>) : <tr><td colSpan={10} className="empty">Start a workflow to populate the live agent matrix.</td></tr>}</tbody></table></div>;
}
