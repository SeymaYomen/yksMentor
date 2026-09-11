import type { GoalMetricProgress, GoalProgressResult } from './goalProgress'

export function netProgressPercent(metric: GoalMetricProgress): number | null {
  if (metric.target === null || metric.current === null) return null
  if (metric.reached) return 100
  if (metric.target <= 0) return 0
  return Math.max(0, Math.min(100, metric.current / metric.target * 100))
}

// Presentation only: proximity uses the existing net gap, never rank/score confidence.
export function goalReaction(progress: GoalProgressResult): 'far' | 'progress' | 'near' | 'achieved' {
  const targeted = Object.values(progress.metrics).filter(metric => metric.target !== null)
  if (!targeted.length) return 'far'
  if (targeted.every(metric => metric.reached)) return 'achieved'
  if (targeted.every(metric => (netProgressPercent(metric) ?? 0) >= 90)) return 'near'
  if (targeted.some(metric => metric.status === 'approaching')) return 'progress'
  return 'far'
}

export const GOAL_REACTION_LABELS = {
  far: null,
  progress: 'Yolundasın',
  near: 'Hedefine yaklaşıyorsun',
  achieved: 'Hedef bölgesine ulaştın',
} as const
