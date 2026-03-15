import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "paid" | "due" | "late" | "pending" | "verified" | "rejected" | "none" | "occupied" | "vacant";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  paid: {
    label: "Paid",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  },
  due: {
    label: "Due",
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  late: {
    label: "Late",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  verified: {
    label: "Verified",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  none: {
    label: "No Proof",
    className: "bg-muted text-muted-foreground border-muted",
  },
  occupied: {
    label: "Occupied",
    className: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  },
  vacant: {
    label: "Vacant",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", config.className, className)}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}

export function ProofStatusBadge({ status }: { status: "none" | "submitted" | "verified" | "rejected" }) {
  const mapping: Record<string, StatusType> = {
    none: "none",
    submitted: "pending",
    verified: "verified",
    rejected: "rejected",
  };
  
  const mappedStatus = mapping[status] || "none";
  const labels: Record<string, string> = {
    none: "No Proof",
    submitted: "Proof Pending",
    verified: "Verified",
    rejected: "Rejected",
  };
  
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", statusConfig[mappedStatus].className)}
      data-testid={`badge-proof-${status}`}
    >
      {labels[status]}
    </Badge>
  );
}
