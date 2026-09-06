import { useCallback, useEffect, useState } from 'react'
import { loadTopicPerformanceSignals } from '../lib/academicData'
import { calculateCompetencyMap, type CompetencyMapResult } from '../lib/competencyMap'

const EMPTY_MAP: CompetencyMapResult = {
  topics: [],
  strong: [],
  developing: [],
  weak: [],
  insufficient: [],
  hasReliableData: false,
}

export function useCompetencyMap(studentId: string) {
  const [competencyMap, setCompetencyMap] = useState<CompetencyMapResult>(EMPTY_MAP)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const reload = useCallback(async () => {
    if (!studentId) {
      setCompetencyMap(EMPTY_MAP)
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const rows = await loadTopicPerformanceSignals([studentId])
      setCompetencyMap(calculateCompetencyMap(rows))
    } catch (caughtError) {
      console.error('Competency map could not be loaded:')
      setCompetencyMap(EMPTY_MAP)
      setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)))
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    void reload()
    const handleUpdate = () => void reload()
    window.addEventListener('topic_performance_updated', handleUpdate)
    return () => window.removeEventListener('topic_performance_updated', handleUpdate)
  }, [reload])

  return { competencyMap, loading, error, reload }
}
