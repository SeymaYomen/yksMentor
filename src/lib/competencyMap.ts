export type ExamType = 'TYT' | 'AYT'
export type CompetencyStatus = 'strong' | 'developing' | 'weak' | 'insufficient_data'
export type CompetencyTrend = 'improving' | 'stable' | 'declining' | 'insufficient_data'

export type TopicPerformanceSignal = {
  topicId: string
  topicName: string
  topicIsActive: boolean
  subjectId: string
  subjectName: string
  examType: ExamType
  correctCount: number | null
  wrongCount: number | null
  blankCount: number | null
  observedAt: string | null
}

export type TopicCompetencyEvidence = {
  attempts: number
  correct: number
  wrong: number
  blank: number
  knownQuestions: number
  recentAccuracy: number | null
}

export type TopicCompetencyResult = {
  topicId: string
  topicName: string
  topicIsActive: boolean
  subjectId: string
  subjectName: string
  examType: ExamType
  status: CompetencyStatus
  score: number | null
  trend: CompetencyTrend
  evidence: TopicCompetencyEvidence
  reasons: string[]
}

export type CompetencyMapResult = {
  topics: TopicCompetencyResult[]
  strong: TopicCompetencyResult[]
  developing: TopicCompetencyResult[]
  weak: TopicCompetencyResult[]
  insufficient: TopicCompetencyResult[]
  hasReliableData: boolean
}

export type CompetencyHighlights = {
  strong: TopicCompetencyResult[]
  developing: TopicCompetencyResult[]
  attention: TopicCompetencyResult[]
}

export const COMPETENCY_RULES = {
  recentMeasurementLimit: 5,
  minimumMeasurements: 2,
  minimumKnownQuestions: 10,
  strongAccuracy: 0.75,
  weakAccuracy: 0.5,
  trendMinimumMeasurements: 3,
  meaningfulAccuracyChange: 0.08,
  meaningfulWrongCountChange: 1,
  wrongOnlyMinimumMeasurements: 2,
  repeatedWrongMinimum: 4,
} as const

function round(value: number, digits = 2) {
  const multiplier = 10 ** digits
  return Math.round(value * multiplier) / multiplier
}

function timestamp(value: string | null) {
  if (!value) return 0
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : 0
}

function validCount(value: number | null) {
  return value !== null && Number.isFinite(value) && value >= 0
}

function normalizedRows(rows: TopicPerformanceSignal[], limit: number) {
  return [...rows]
    .filter(row => {
      const counts = [row.correctCount, row.wrongCount, row.blankCount]
      if (!counts.some(validCount)) return false
      if (counts.some(value => value !== null && !validCount(value))) return false
      return counts.reduce<number>((sum, value) => sum + (value ?? 0), 0) > 0
    })
    .sort((a, b) => timestamp(a.observedAt) - timestamp(b.observedAt))
    .slice(-Math.max(1, limit))
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function splitChange(values: number[]) {
  const splitIndex = Math.floor(values.length / 2)
  return average(values.slice(splitIndex)) - average(values.slice(0, splitIndex))
}

function calculateTrend(rows: TopicPerformanceSignal[]): CompetencyTrend {
  if (rows.length < COMPETENCY_RULES.trendMinimumMeasurements) return 'insufficient_data'

  const accuracySeries = rows
    .filter(row => row.correctCount !== null)
    .map(row => {
      const total = (row.correctCount ?? 0) + (row.wrongCount ?? 0) + (row.blankCount ?? 0)
      return total > 0 ? (row.correctCount ?? 0) / total : null
    })
    .filter((value): value is number => value !== null)

  if (accuracySeries.length >= COMPETENCY_RULES.trendMinimumMeasurements) {
    const change = splitChange(accuracySeries)
    if (change >= COMPETENCY_RULES.meaningfulAccuracyChange) return 'improving'
    if (change <= -COMPETENCY_RULES.meaningfulAccuracyChange) return 'declining'
    return 'stable'
  }

  const wrongOnlySeries = rows
    .filter(row => row.correctCount === null && row.wrongCount !== null)
    .map(row => row.wrongCount as number)
  if (wrongOnlySeries.length >= COMPETENCY_RULES.trendMinimumMeasurements) {
    const change = splitChange(wrongOnlySeries)
    if (change <= -COMPETENCY_RULES.meaningfulWrongCountChange) return 'improving'
    if (change >= COMPETENCY_RULES.meaningfulWrongCountChange) return 'declining'
    return 'stable'
  }

  return 'insufficient_data'
}

export function calculateTopicCompetency({
  topicPerformances,
  recentWindow = COMPETENCY_RULES.recentMeasurementLimit,
}: {
  topicPerformances: TopicPerformanceSignal[]
  recentWindow?: number
}): TopicCompetencyResult {
  if (topicPerformances.length === 0) {
    throw new Error('Topic competency requires at least one topic reference.')
  }

  const reference = topicPerformances[topicPerformances.length - 1]
  const rows = normalizedRows(topicPerformances, recentWindow)
  const correct = rows.reduce((sum, row) => sum + (row.correctCount ?? 0), 0)
  const wrong = rows.reduce((sum, row) => sum + (row.wrongCount ?? 0), 0)
  const blank = rows.reduce((sum, row) => sum + (row.blankCount ?? 0), 0)
  const knownQuestions = correct + wrong + blank
  const accuracyRows = rows.filter(row => row.correctCount !== null)
  const accuracyCorrect = accuracyRows.reduce((sum, row) => sum + (row.correctCount ?? 0), 0)
  const accuracyQuestions = accuracyRows.reduce(
    (sum, row) => sum + (row.correctCount ?? 0) + (row.wrongCount ?? 0) + (row.blankCount ?? 0),
    0,
  )
  const recentAccuracy = accuracyQuestions > 0 ? round(accuracyCorrect / accuracyQuestions, 4) : null
  const trend = calculateTrend(rows)
  const reasons: string[] = []
  const hasMeasurementEvidence = rows.length >= COMPETENCY_RULES.minimumMeasurements
  const hasAccuracyEvidence = accuracyQuestions >= COMPETENCY_RULES.minimumKnownQuestions
  const wrongOnlyRows = rows.filter(row => row.correctCount === null && row.wrongCount !== null)
  const wrongOnlyTotal = wrongOnlyRows.reduce((sum, row) => sum + (row.wrongCount ?? 0), 0)
  const hasRepeatedWrongEvidence = wrongOnlyRows.length >= COMPETENCY_RULES.wrongOnlyMinimumMeasurements &&
    wrongOnlyTotal >= COMPETENCY_RULES.repeatedWrongMinimum

  let status: CompetencyStatus
  if (!hasMeasurementEvidence || (!hasAccuracyEvidence && !hasRepeatedWrongEvidence)) {
    status = 'insufficient_data'
    reasons.push('Güvenilir yorum için en az iki ölçüm ve yeterli soru kanıtı gerekli.')
  } else if (recentAccuracy !== null && recentAccuracy >= COMPETENCY_RULES.strongAccuracy && trend !== 'declining') {
    status = 'strong'
    reasons.push(`Son ölçümlerde doğruluk %${Math.round(recentAccuracy * 100)} ve belirgin düşüş yok.`)
  } else if (trend === 'improving') {
    status = 'developing'
    reasons.push('Son ölçümlerde konu performansı iyileşiyor.')
  } else if (
    recentAccuracy !== null && recentAccuracy <= COMPETENCY_RULES.weakAccuracy ||
    hasRepeatedWrongEvidence
  ) {
    status = 'weak'
    if (recentAccuracy !== null) reasons.push(`Son ölçümlerde doğruluk %${Math.round(recentAccuracy * 100)} seviyesinde.`)
    else reasons.push('Birden fazla ölçümde tekrar eden yanlış kaydı var.')
  } else {
    status = 'developing'
    reasons.push('Doğruluk orta aralıkta; gelişim izlenmeye devam edilmeli.')
  }

  if (trend === 'declining') reasons.push('Son ölçümlerde performans düşüyor.')
  else if (trend === 'stable') reasons.push('Son ölçümlerde belirgin yön değişimi yok.')

  return {
    topicId: reference.topicId,
    topicName: reference.topicName,
    topicIsActive: reference.topicIsActive,
    subjectId: reference.subjectId,
    subjectName: reference.subjectName,
    examType: reference.examType,
    status,
    score: recentAccuracy === null ? null : round(recentAccuracy * 100),
    trend,
    evidence: {
      attempts: rows.length,
      correct,
      wrong,
      blank,
      knownQuestions,
      recentAccuracy,
    },
    reasons,
  }
}

export function calculateCompetencyMap(topicPerformances: TopicPerformanceSignal[]): CompetencyMapResult {
  const grouped = topicPerformances.reduce<Record<string, TopicPerformanceSignal[]>>((result, row) => {
    ;(result[row.topicId] ??= []).push(row)
    return result
  }, {})
  const priority: Record<CompetencyStatus, number> = {
    weak: 0,
    developing: 1,
    strong: 2,
    insufficient_data: 3,
  }
  const topics = Object.values(grouped)
    .map(rows => calculateTopicCompetency({ topicPerformances: rows }))
    .sort((a, b) => priority[a.status] - priority[b.status] || a.examType.localeCompare(b.examType) || a.subjectName.localeCompare(b.subjectName) || a.topicName.localeCompare(b.topicName))

  return {
    topics,
    strong: topics.filter(topic => topic.status === 'strong'),
    developing: topics.filter(topic => topic.status === 'developing'),
    weak: topics.filter(topic => topic.status === 'weak'),
    insufficient: topics.filter(topic => topic.status === 'insufficient_data'),
    hasReliableData: topics.some(topic => topic.status !== 'insufficient_data'),
  }
}

export function selectCompetencyHighlights(map: CompetencyMapResult, limit = 3): CompetencyHighlights {
  const safeLimit = Math.max(0, limit)
  const attention = map.topics
    .filter(topic => topic.status === 'weak' || topic.trend === 'declining')
    .sort((a, b) => Number(b.trend === 'declining') - Number(a.trend === 'declining'))
    .slice(0, safeLimit)
  const attentionIds = new Set(attention.map(topic => topic.topicId))

  return {
    strong: map.strong.slice(0, safeLimit),
    developing: map.developing
      .filter(topic => !attentionIds.has(topic.topicId))
      .sort((a, b) => Number(b.trend === 'improving') - Number(a.trend === 'improving'))
      .slice(0, safeLimit),
    attention,
  }
}
