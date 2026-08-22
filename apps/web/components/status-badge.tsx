const labels: Record<string, string> = { RUNNING: "Running", WAITING_APPROVAL: "Waiting Approval", COMPLETED: "Completed", FAILED: "Failed", QUEUED: "Queued", CANCELLED: "Cancelled" };
export function StatusBadge({ status }: { status: string }) { return <span className={`status status-${status.toLowerCase()}`}><span aria-hidden="true" />{labels[status] ?? status}</span>; }
