export type ClusterRow<T> =
  | { kind: "single"; notification: T }
  | { kind: "cluster"; clusterId: string; notifications: T[] }

/**
 * Group rows that share `ai_cluster_id` (system notifications only).
 * Input should already be sorted (e.g. by priority, then recency).
 */
export function groupNotificationRows<T extends { type: string; ai_cluster_id?: string | null }>(
  rows: T[],
  clusterEnabled: boolean,
): ClusterRow<T>[] {
  if (!clusterEnabled) {
    return rows.map((notification) => ({ kind: "single" as const, notification }))
  }

  const out: ClusterRow<T>[] = []
  const emittedClusters = new Set<string>()

  for (const notification of rows) {
    const cid =
      notification.type === "notification" && notification.ai_cluster_id
        ? String(notification.ai_cluster_id)
        : ""
    if (!cid) {
      out.push({ kind: "single", notification })
      continue
    }
    if (emittedClusters.has(cid)) continue

    const group = rows.filter(
      (r) => r.type === "notification" && r.ai_cluster_id && String(r.ai_cluster_id) === cid,
    )
    if (group.length <= 1) {
      out.push({ kind: "single", notification })
    } else {
      emittedClusters.add(cid)
      out.push({ kind: "cluster", clusterId: cid, notifications: group })
    }
  }

  return out
}
