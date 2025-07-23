import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { Anomaly, AnomalyStatsResponse } from '@liveflow/shared'
import { AnomalyDashboard } from '../components/AnomalyDashboard'
import styles from './anomalies.module.css'

export const Route = createFileRoute('/anomalies')({
  component: AnomaliesPage,
})

function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [stats, setStats] = useState<AnomalyStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const [anomaliesData, statsData] = await Promise.all([
        api.anomalies.getAll({ limit: 50 }),
        api.anomalies.getStats()
      ])
      
      setAnomalies(anomaliesData.anomalies)
      setStats(statsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load anomaly data')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !stats) {
    return <div className={styles.loading}>Loading anomaly data...</div>
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>ANOMALY DETECTION DASHBOARD</h2>
      
      <div className={styles.statusBar}>
        <span className={styles.status}>
          Detection Status: <span className={styles.statusActive}>●ACTIVE</span> 
          (Last run: {stats ? new Date(stats.lastDetectionRun).toLocaleString() : 'Unknown'})
        </span>
      </div>

      <AnomalyDashboard 
        anomalies={anomalies} 
        stats={stats} 
        onRefresh={loadData}
      />
    </div>
  )
}