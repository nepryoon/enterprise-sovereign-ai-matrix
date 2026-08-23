import type { AgentView } from "@/types";
export const phases=["Observe","Classify","Analyse","Challenge","Govern","Decide"] as const;
export const disciplines=["Architecture","Security","Compliance","FinOps","Operations"] as const;
export type Task={id:string;title:string;phase:typeof phases[number];discipline:typeof disciplines[number];summary:string;dependencies:string[];};
export const tasks:Task[]=[
{id:"ingest-request",title:"Change request intake",phase:"Observe",discipline:"Operations",summary:"Normalises the synthetic change request and establishes correlation lineage.",dependencies:[]},
{id:"scope-architecture",title:"System boundary",phase:"Observe",discipline:"Architecture",summary:"Identifies affected components and dependency boundaries.",dependencies:["ingest-request"]},
{id:"sensitivity-classifier",title:"Residency classifier",phase:"Classify",discipline:"Compliance",summary:"Classifies data sensitivity and residency constraints.",dependencies:["ingest-request"]},
{id:"threat-classifier",title:"Threat surface",phase:"Classify",discipline:"Security",summary:"Classifies exposure and privileged access impact.",dependencies:["scope-architecture"]},
{id:"cost-envelope",title:"Budget envelope",phase:"Classify",discipline:"FinOps",summary:"Establishes the auditable model and execution budget.",dependencies:["ingest-request"]},
{id:"architecture-assessment",title:"Architecture assessment",phase:"Analyse",discipline:"Architecture",summary:"Assesses coupling, rollback boundaries and service continuity.",dependencies:["scope-architecture"]},
{id:"risk-analysis",title:"Security assessment",phase:"Analyse",discipline:"Security",summary:"Evaluates blast radius, access controls and rollback evidence.",dependencies:["threat-classifier"]},
{id:"compliance-assessment",title:"Control assessment",phase:"Analyse",discipline:"Compliance",summary:"Maps the synthetic request to residency and accountability policy.",dependencies:["sensitivity-classifier"]},
{id:"finops-assessment",title:"Cost assessment",phase:"Analyse",discipline:"FinOps",summary:"Reconciles invocation cost against the approved envelope.",dependencies:["cost-envelope"]},
{id:"resilience-assessment",title:"Resilience review",phase:"Analyse",discipline:"Operations",summary:"Checks recovery objective, change window and rollback readiness.",dependencies:["ingest-request"]},
{id:"challenge-agent",title:"Trade-off challenge",phase:"Challenge",discipline:"Architecture",summary:"Challenges conflicting resilience, security and cost conclusions.",dependencies:["architecture-assessment","risk-analysis","finops-assessment"]},
{id:"policy-evaluator",title:"Policy evaluation",phase:"Govern",discipline:"Compliance",summary:"Applies fail-closed residency and human-accountability policy.",dependencies:["challenge-agent","compliance-assessment"]},
{id:"approval-gate",title:"Human approval gate",phase:"Govern",discipline:"Security",summary:"Pauses the graph until an accountable operator records rationale.",dependencies:["policy-evaluator"]},
{id:"decision-finaliser",title:"Decision synthesis",phase:"Decide",discipline:"Operations",summary:"Produces the final governed decision and audit record.",dependencies:["approval-gate"]},
];
export function agentFor(task:Task,agents:AgentView[]){return agents.find(a=>a.id===task.id||a.id.replaceAll("_","-")===task.id)}
