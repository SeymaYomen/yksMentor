import type { StudentStatusResult } from './studentStatus'
import { UNIVERSITY_SUGGESTIONS, PROGRAM_SUGGESTIONS } from './goalSuggestions.ts'

export type GoalType = 'university_program' | 'rank' | 'score' | 'net'
export type GoalScoreType = 'sayisal' | 'esit_agirlik' | 'sozel' | 'dil' | 'tyt'
export type GoalProgressStatus = 'approaching' | 'stable' | 'moving_away' | 'achieved' | 'insufficient_data'

export type StudentGoal = {
  id: string
  student_id: string
  created_by: string | null
  goal_type: GoalType
  score_type: GoalScoreType | null
  university_name: string | null
  program_name: string | null
  target_rank: number | null
  target_score: number | null
  target_tyt_net: number | null
  target_ayt_net: number | null
  target_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type GoalSaveInput = {
  goalType: GoalType
  scoreType?: GoalScoreType | null
  universityName?: string | null
  programName?: string | null
  targetRank?: number | null
  targetScore?: number | null
  targetTytNet?: number | null
  targetAytNet?: number | null
  targetDate?: string | null
}

export type GoalPerformanceRow = {
  tyt_net?: number | null
  ayt_net?: number | null
  date?: string | null
  created_at?: string | null
}

export type GoalMetricProgress = {
  target: number | null
  current: number | null
  remaining: number | null
  initialRemaining: number | null
  change30Days: number | null
  status: GoalProgressStatus
  reached: boolean
  hasTrendData: boolean
}

export type GoalProgressResult = {
  hasGoal: boolean
  goal: StudentGoal | null
  status: GoalProgressStatus
  label: string
  metrics: { tyt: GoalMetricProgress; ayt: GoalMetricProgress }
  reasons: string[]
  roadmap: string[]
  targetDatePassed: boolean
  reliableRankEstimateAvailable: false
  rankEstimateMessage: string | null
}

export type GoalAcademicInsight = {
  examType: 'TYT' | 'AYT'
  topicName: string
  status: 'strong' | 'developing' | 'weak'
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data'
}

export const GOAL_FIELD_LIMITS = {
  tytNet: { min: 0, max: 120 },
  aytNet: { min: 0, max: 80 },
  rank: { min: 1 },
  score: { min: 0 },
  textLength: { max: 200 },
} as const

export const GOAL_PROGRESS_RULES = {
  trendWindowDays: 30,
  meaningfulNetChange: 1,
  roadmapTaskContinuityThreshold: 75,
} as const

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function isValidDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

export function validateGoalInput(input: GoalSaveInput) {
  const errors: string[] = []
  const universityName = input.universityName?.trim() || null
  const programName = input.programName?.trim() || null
  if (universityName && !(UNIVERSITY_SUGGESTIONS as readonly string[]).includes(universityName)) errors.push('Üniversiteyi öneri listesinden seçin veya alanı boş bırakın.')
  if (programName && !(PROGRAM_SUGGESTIONS as readonly string[]).includes(programName)) errors.push('Bölümü öneri listesinden seçin veya alanı boş bırakın.')
  const numericFields: Array<[string, number | null | undefined, number, number | undefined]> = [
    ['TYT net hedefi', input.targetTytNet, GOAL_FIELD_LIMITS.tytNet.min, GOAL_FIELD_LIMITS.tytNet.max],
    ['AYT net hedefi', input.targetAytNet, GOAL_FIELD_LIMITS.aytNet.min, GOAL_FIELD_LIMITS.aytNet.max],
    ['Hedef puan', input.targetScore, GOAL_FIELD_LIMITS.score.min, undefined],
  ]

  numericFields.forEach(([label, value, min, max]) => {
    if (value === null || value === undefined) return
    if (!Number.isFinite(value) || value < min || (max !== undefined && value > max)) {
      errors.push(max === undefined ? `${label} ${min} veya daha büyük olmalı.` : `${label} ${min}-${max} arasında olmalı.`)
    }
  })

  if (input.targetRank !== null && input.targetRank !== undefined) {
    if (!Number.isInteger(input.targetRank) || input.targetRank < GOAL_FIELD_LIMITS.rank.min) {
      errors.push('Hedef sıralama pozitif bir tam sayı olmalı.')
    }
  }
  if (universityName && universityName.length > GOAL_FIELD_LIMITS.textLength.max) {
    errors.push(`Üniversite adı en fazla ${GOAL_FIELD_LIMITS.textLength.max} karakter olabilir.`)
  }
  if (programName && programName.length > GOAL_FIELD_LIMITS.textLength.max) {
    errors.push(`Bölüm adı en fazla ${GOAL_FIELD_LIMITS.textLength.max} karakter olabilir.`)
  }
  if (input.targetDate && !isValidDateOnly(input.targetDate)) errors.push('Hedef tarihi geçerli bir tarih olmalı.')

  const hasTarget = universityName !== null || programName !== null ||
    input.targetRank !== null && input.targetRank !== undefined ||
    input.targetScore !== null && input.targetScore !== undefined ||
    input.targetTytNet !== null && input.targetTytNet !== undefined ||
    input.targetAytNet !== null && input.targetAytNet !== undefined
  if (!hasTarget) errors.push('En az bir hedef alanı doldurulmalı.')

  return errors
}

function rowTimestamp(row: GoalPerformanceRow) {
  const raw = row.date ?? row.created_at
  if (!raw) return null
  const parsed = new Date(raw).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function emptyMetric(target: number | null): GoalMetricProgress {
  return {
    target,
    current: null,
    remaining: null,
    initialRemaining: null,
    change30Days: null,
    status: 'insufficient_data',
    reached: false,
    hasTrendData: false,
  }
}

function calculateMetric(
  target: number | null,
  performance: GoalPerformanceRow[],
  key: 'tyt_net' | 'ayt_net',
  now: Date,
): GoalMetricProgress {
  const values = performance
    .map(row => ({ value: row[key], time: rowTimestamp(row) }))
    .filter((entry): entry is { value: number; time: number } => (
      typeof entry.value === 'number' &&
      Number.isFinite(entry.value) &&
      entry.time !== null &&
      entry.time <= now.getTime()
    ))
    .sort((a, b) => a.time - b.time)

  if (values.length === 0) return emptyMetric(target)

  const current = values[values.length - 1].value

  if (target === null) {
    return {
      target: null,
      current,
      remaining: null,
      initialRemaining: null,
      change30Days: null,
      status: 'insufficient_data',
      reached: false,
      hasTrendData: false,
    }
  }

  const remaining = Math.max(0, round(target - current))
  const reached = current >= target
  const windowStart = now.getTime() - GOAL_PROGRESS_RULES.trendWindowDays * 86_400_000
  const recentValues = values.filter(entry => entry.time >= windowStart)

  if (recentValues.length < 2) {
    return {
      target,
      current,
      remaining,
      initialRemaining: null,
      change30Days: null,
      status: reached ? 'achieved' : 'insufficient_data',
      reached,
      hasTrendData: false,
    }
  }

  const first = recentValues[0].value
  const last = recentValues[recentValues.length - 1].value
  const change = round(last - first)

  const status: GoalProgressStatus = reached
    ? 'achieved'
    : change >= GOAL_PROGRESS_RULES.meaningfulNetChange
      ? 'approaching'
      : change <= -GOAL_PROGRESS_RULES.meaningfulNetChange
        ? 'moving_away'
        : 'stable'

  return {
    target,
    current,
    remaining,
    initialRemaining: Math.max(0, round(target - first)),
    change30Days: change,
    status,
    reached,
    hasTrendData: true,
  }
}
function overallStatus(metrics: GoalMetricProgress[]): GoalProgressStatus {
  const targeted = metrics.filter(metric => metric.target !== null)
  if (targeted.length === 0) return 'insufficient_data'
  if (targeted.every(metric => metric.reached)) return 'achieved'
  if (targeted.some(metric => metric.current === null)) return 'insufficient_data'

  const statuses = targeted.filter(metric => !metric.reached).map(metric => metric.status)
  if (statuses.some(status => status === 'insufficient_data')) return 'insufficient_data'
  if (statuses.includes('approaching') && statuses.includes('moving_away')) return 'stable'
  if (statuses.includes('moving_away')) return 'moving_away'
  if (statuses.includes('approaching')) return 'approaching'
  return 'stable'
}

function statusLabel(status: GoalProgressStatus) {
  if (status === 'achieved') return 'Hedefe ulaşıldı'
  if (status === 'approaching') return 'Hedefe yaklaşıyor'
  if (status === 'moving_away') return 'Hedeften uzaklaşıyor'
  if (status === 'stable') return 'İlerleme durağan'
  return 'İlerleme için veri yetersiz'
}

function buildReasons(goal: StudentGoal | null, tyt: GoalMetricProgress, ayt: GoalMetricProgress, status: GoalProgressStatus) {
  if (!goal) return ['Henüz yapılandırılmış bir ana hedef yok.']

  const reasons: string[] = []
  const metrics: Array<[string, GoalMetricProgress]> = [['TYT', tyt], ['AYT', ayt]]
  metrics.forEach(([name, metric]) => {
    if (metric.target === null) return
    if (metric.current === null) reasons.push(`${name} hedef mesafesi için henüz performans verisi yok.`)
    else if (metric.reached) reasons.push(`${name} hedef seviyesi aşıldı veya karşılandı.`)
    else reasons.push(`${name} hedefi için ${metric.remaining} net fark kaldı.`)
  })

  if (tyt.target === null && ayt.target === null) {
    reasons.push('Net hedefi tanımlanmadığı için performans verisinden güvenilir sıralama veya puan tahmini yapılmıyor.')
  } else if (status === 'insufficient_data') {
    reasons.push('Hedefe ilerleme trendi için son 30 günde en az iki ölçüm gerekli.')
  }
  return reasons
}

function buildRoadmap(
  goal: StudentGoal | null,
  tyt: GoalMetricProgress,
  ayt: GoalMetricProgress,
  studentStatus: StudentStatusResult | undefined,
  targetDatePassed: boolean,
  academicInsights: GoalAcademicInsight[],
) {
  if (!goal) return ['Önce öğrenci için yapılandırılmış bir ana hedef tanımlanmalı.']

  const roadmap: string[] = []
  if (targetDatePassed) roadmap.push('Hedef tarihi geçti; hedef ve zaman planı mentorla yeniden değerlendirilmeli.')

  const metricEntries: Array<{ name: string; metric: GoalMetricProgress }> = [
    { name: 'TYT', metric: tyt },
    { name: 'AYT', metric: ayt },
  ].filter(entry => entry.metric.target !== null)
  const openMetrics = metricEntries
    .filter(entry => entry.metric.current !== null && !entry.metric.reached)
    .sort((a, b) => {
      const aRatio = (a.metric.remaining ?? 0) / Math.max(a.metric.target ?? 1, 1)
      const bRatio = (b.metric.remaining ?? 0) / Math.max(b.metric.target ?? 1, 1)
      return bRatio - aRatio
    })

  if (openMetrics.length > 0) roadmap.push(`${openMetrics[0].name} açığı öncelikli takip edilmeli.`)
  else if (metricEntries.length > 0 && metricEntries.every(entry => entry.metric.reached)) {
    roadmap.push('Tanımlı net hedefleri karşılanıyor; mevcut seviye ve süreklilik korunmalı.')
  } else if (metricEntries.length > 0) {
    roadmap.push('Net hedefi mesafesini izlemek için düzenli TYT/AYT performans verisi girilmeli.')
  } else if (metricEntries.length === 0) {
    roadmap.push('Sıralama veya puan hedefinin ilerlemesini ölçmek için TYT/AYT net hedefleri de tanımlanabilir.')
  }

  const openExamTypes = new Set(openMetrics.map(entry => entry.name))
  const academicAttention = academicInsights
    .filter(insight => openExamTypes.has(insight.examType) && (insight.status === 'weak' || insight.trend === 'declining'))
    .sort((a, b) => Number(b.trend === 'declining') - Number(a.trend === 'declining'))
    .slice(0, 2)
  if (academicAttention.length > 0) {
    const examType = academicAttention[0].examType
    const topicNames = academicAttention.filter(insight => insight.examType === examType).map(insight => insight.topicName)
    roadmap.push(`${examType} tarafında ${topicNames.join(' ve ')} dikkat gerektiriyor.`)
  }

  const movingAway = metricEntries.find(entry => entry.metric.status === 'moving_away')
  const approaching = metricEntries.find(entry => entry.metric.status === 'approaching')
  if (movingAway) roadmap.push(`${movingAway.name} son 30 günde hedeften uzaklaşıyor; düşüşün nedeni görüşmede ele alınmalı.`)
  else if (approaching) roadmap.push(`${approaching.name} yükselişi korunmalı.`)

  if (studentStatus) {
    if (
      studentStatus.metrics.taskCompletionRate !== null &&
      studentStatus.metrics.taskCompletionRate < GOAL_PROGRESS_RULES.roadmapTaskContinuityThreshold
    ) {
      roadmap.push(`Görev uyumu %${studentStatus.metrics.taskCompletionRate}; süreklilik artırılmalı.`)
    } else if (studentStatus.metrics.studyTrend === 'down') {
      roadmap.push('Çalışma süresindeki düşüş durdurulup düzen yeniden kurulmalı.')
    } else if (studentStatus.metrics.overdueTasks > 0) {
      roadmap.push(`${studentStatus.metrics.overdueTasks} geciken görev kapatılmalı.`)
    }
  }

  return [...new Set(roadmap)].slice(0, 3)
}

export function calculateGoalProgress({
  goal,
  performance,
  studentStatus,
  academicInsights = [],
  now = new Date(),
}: {
  goal: StudentGoal | null
  performance: GoalPerformanceRow[]
  studentStatus?: StudentStatusResult
  academicInsights?: GoalAcademicInsight[]
  now?: Date
}): GoalProgressResult {
  if (!goal) {
    return {
      hasGoal: false,
      goal: null,
      status: 'insufficient_data',
      label: 'Hedef tanımlanmamış',
      metrics: { tyt: emptyMetric(null), ayt: emptyMetric(null) },
      reasons: ['Henüz yapılandırılmış bir ana hedef yok.'],
      roadmap: ['Önce öğrenci için yapılandırılmış bir ana hedef tanımlanmalı.'],
      targetDatePassed: false,
      reliableRankEstimateAvailable: false,
      rankEstimateMessage: null,
    }
  }

  const tyt = calculateMetric(goal.target_tyt_net, performance, 'tyt_net', now)
  const ayt = calculateMetric(goal.target_ayt_net, performance, 'ayt_net', now)
  const status = overallStatus([tyt, ayt])
  const targetDatePassed = !!goal.target_date && goal.target_date.slice(0, 10) < now.toISOString().slice(0, 10)
  const hasRankOrScoreTarget = goal.target_rank !== null || goal.target_score !== null

  return {
    hasGoal: true,
    goal,
    status,
    label: statusLabel(status),
    metrics: { tyt, ayt },
    reasons: buildReasons(goal, tyt, ayt, status),
    roadmap: buildRoadmap(goal, tyt, ayt, studentStatus, targetDatePassed, academicInsights),
    targetDatePassed,
    reliableRankEstimateAvailable: false,
    rankEstimateMessage: hasRankOrScoreTarget
      ? 'Mevcut performans verileriyle güvenilir sıralama veya puan tahmini yapılamıyor.'
      : null,
  }
}
