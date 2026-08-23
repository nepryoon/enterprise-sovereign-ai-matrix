import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:{default:"Neuromorphic Inference Lab — Sovereign AI Mission Control",template:"%s — NIL Sovereign Control Plane"},description:"Enterprise AI orchestration control plane with deterministic showcase workflow, sovereign routing, human governance and auditable decision lineage."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="en"><body>{children}</body></html>}
