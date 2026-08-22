import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Sovereign AI Mission Control", description: "Governed enterprise AI orchestration control plane" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
