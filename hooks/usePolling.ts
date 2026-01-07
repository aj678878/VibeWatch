import { useState, useEffect, useRef } from 'react'

interface UsePollingOptions {
  interval?: number
  enabled?: boolean
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  options: UsePollingOptions = {}
) {
  const { interval = 3000, enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!enabled) return

    const poll = async () => {
      try {
        const result = await fetchFn()
        setData(result)
        setError(null)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    poll()

    // Set up polling
    intervalRef.current = setInterval(poll, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchFn, interval, enabled])

  return { data, loading, error }
}
