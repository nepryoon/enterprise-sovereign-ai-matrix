"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const navigation = [
  ["Operate", [["Command centre", "/"], ["Runs", "/runs"]]],
  ["Govern", [["Governance", "/governance"]]],
  ["Verify", [["Observability", "/observability"], ["Architecture proof", "/architecture"]]],
] as const;
export function AppShell({children, executionId, connection="ready", cost=0}:{children:ReactNode;executionId?:string|null;connection?:string;cost?:number}){
 const path=usePathname();
 return <div className="app-shell"><a className="skip-link" href="#workspace">Skip to workspace</a>
  <header className="topbar"><Link href="/" className="wordmark" aria-label="Neuromorphic Inference Lab home"><span className="logo">N</span><span><b>Neuromorphic Inference Lab</b><small>Sovereign Decision Control Plane</small></span></Link><div className="top-signals"><span className="demo-badge">DEMO · SYNTHETIC DATA</span><span className="mono">SHOWCASE</span><span className="signal"><i/> EU policy boundary</span><span className="mono">{connection}</span><span className="mono">€{cost.toFixed(5)}</span>{executionId&&<span className="execution-chip" title={executionId}>RUN {executionId.slice(0,8)}</span>}<Link href="/#guided-demo" className="top-demo-link">Start guided demo</Link><a href="https://www.neuromorphicinference.com/" target="_blank" rel="noreferrer" className="portfolio-link">Portfolio ↗</a></div></header>
  <nav className="rail" aria-label="Primary navigation">{navigation.map(([group,items])=><section key={group}><h2>{group}</h2>{items.map(([label,href])=><Link key={href} href={href} aria-current={path===href||href!=="/"&&path.startsWith(href)?"page":undefined}><span aria-hidden>{label[0]}</span><b>{label}</b></Link>)}</section>)}</nav>
  <main id="workspace" className="shell-workspace">{children}</main>
 </div>
}
export function PageHeading({eyebrow,title,description,actions}:{eyebrow:string;title:string;description:string;actions?:ReactNode}){return <header className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{actions&&<div className="heading-actions">{actions}</div>}</header>}
