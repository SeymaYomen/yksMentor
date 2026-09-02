import { useEffect, useState } from 'react'
import { loadAcademicCatalog, type AcademicCatalog } from '../lib/academicData'

const EMPTY_CATALOG: AcademicCatalog = { subjects: [], topics: [] }

export function useAcademicCatalog() {
  const [catalog, setCatalog] = useState<AcademicCatalog>(EMPTY_CATALOG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    loadAcademicCatalog()
      .then(result => {
        if (!cancelled) setCatalog(result)
      })
      .catch(caughtError => {
        if (!cancelled) {
          setCatalog(EMPTY_CATALOG)
          setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  return { ...catalog, loading, error }
}
