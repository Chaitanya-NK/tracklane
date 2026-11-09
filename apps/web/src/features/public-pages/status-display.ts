export const COMPONENT_STATUS_LABELS = {
  operational: "Operational",
  degraded: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
  maintenance: "Under maintenance",
} as const;

/** Dot / bar colours; text always accompanies them. */
export const COMPONENT_STATUS_TONE = {
  operational: "bg-emerald-500",
  degraded: "bg-amber-400",
  partial_outage: "bg-orange-500",
  major_outage: "bg-red-600",
  maintenance: "bg-sky-500",
} as const;

export const INCIDENT_STATUS_LABELS = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
} as const;

export const IMPACT_LABELS = {
  minor: "Minor",
  major: "Major",
  critical: "Critical",
  maintenance: "Maintenance",
} as const;

export const IMPACT_TONE = {
  minor: "bg-amber-400",
  major: "bg-orange-500",
  critical: "bg-red-600",
  maintenance: "bg-sky-500",
} as const;

type ComponentStatus = keyof typeof COMPONENT_STATUS_LABELS;

/** The page headline: the worst component status. */
export function overallStatus(statuses: ComponentStatus[]) {
  const order: ComponentStatus[] = ["major_outage", "partial_outage", "degraded", "maintenance"];
  const worst = order.find((s) => statuses.includes(s));
  if (!worst) return { tone: COMPONENT_STATUS_TONE.operational, label: "All systems operational" };
  const headline: Record<Exclude<ComponentStatus, "operational">, string> = {
    major_outage: "Major outage",
    partial_outage: "Partial outage",
    degraded: "Some systems are degraded",
    maintenance: "Scheduled maintenance in progress",
  };
  const label = headline[worst as Exclude<ComponentStatus, "operational">];
  return { tone: COMPONENT_STATUS_TONE[worst], label };
}
