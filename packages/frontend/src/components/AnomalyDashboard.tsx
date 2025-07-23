import { Anomaly, AnomalyStatsResponse } from '@liveflow/shared'
import styles from './AnomalyDashboard.module.css'

interface AnomalyDashboardProps {
  anomalies: Anomaly[]
  stats: AnomalyStatsResponse | null
  onRefresh: () => void
}

export function AnomalyDashboard({ anomalies, stats, onRefresh }: AnomalyDashboardProps) {
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  const formatCurrency = (amount: number) => {
    const sign = amount >= 0 ? '+' : ''
    return `${sign}$${Math.abs(amount).toLocaleString('en-US')}`
  }

  const getRiskClass = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return styles.riskLow
      case 'MEDIUM': return styles.riskMedium
      case 'HIGH': return styles.riskHigh
      default: return styles.riskUnknown
    }
  }

  const getReasonFromFeatures = (features: any) => {
    if (features.amount > 10000) return 'Unusual large amt'
    if (features.hourOfDay < 6 || features.hourOfDay > 22) return 'Off-hours transfer'
    if (features.transactionVelocity > 5) return 'Velocity spike'
    return 'Irregular pattern'
  }

  // Simple ASCII bar chart for risk distribution
  const renderRiskChart = () => {
    if (!stats) return null

    const total = stats.totalAnomalies
    const lowPct = total > 0 ? (stats.lowRisk / total) * 100 : 0
    const medPct = total > 0 ? (stats.mediumRisk / total) * 100 : 0
    const highPct = total > 0 ? (stats.highRisk / total) * 100 : 0

    return (
      <div className={styles.chartContainer}>
        <h3 className={styles.chartTitle}>RISK LEVEL DISTRIBUTION</h3>
        <div className={styles.chart}>
          <div className={styles.chartRow}>
            <span className={styles.chartLabel}>LOW</span>
            <div className={styles.chartBar}>
              <div 
                className={`${styles.chartFill} ${styles.chartLow}`}
                style={{ width: `${lowPct}%` }}
              ></div>
            </div>
            <span className={styles.chartValue}>{stats.lowRisk}</span>
          </div>
          <div className={styles.chartRow}>
            <span className={styles.chartLabel}>MED</span>
            <div className={styles.chartBar}>
              <div 
                className={`${styles.chartFill} ${styles.chartMedium}`}
                style={{ width: `${medPct}%` }}
              ></div>
            </div>
            <span className={styles.chartValue}>{stats.mediumRisk}</span>
          </div>
          <div className={styles.chartRow}>
            <span className={styles.chartLabel}>HIGH</span>
            <div className={styles.chartBar}>
              <div 
                className={`${styles.chartFill} ${styles.chartHigh}`}
                style={{ width: `${highPct}%` }}
              ></div>
            </div>
            <span className={styles.chartValue}>{stats.highRisk}</span>
          </div>
        </div>
      </div>
    )
  }

  // Get high risk anomalies from last 24 hours
  const highRiskAnomalies = anomalies
    .filter(anomaly => anomaly.riskLevel === 'HIGH')
    .slice(0, 10) // Show top 10

  return (
    <div className={styles.container}>
      {renderRiskChart()}

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>HIGH RISK TRANSACTIONS (Recent)</h3>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.headerRow}>
                <th className={styles.headerCell}>Account</th>
                <th className={styles.headerCell}>Time</th>
                <th className={styles.headerCell}>Amount</th>
                <th className={styles.headerCell}>Risk Score</th>
                <th className={styles.headerCell}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {highRiskAnomalies.map((anomaly) => (
                <tr key={anomaly.anomalyId} className={styles.dataRow}>
                  <td className={styles.dataCell}>{anomaly.accountId}</td>
                  <td className={styles.dataCell}>{formatTime(anomaly.detectedAt)}</td>
                  <td className={styles.dataCell}>{formatCurrency(anomaly.features.amount)}</td>
                  <td className={styles.dataCell}>{anomaly.riskScore.toFixed(2)}</td>
                  <td className={styles.dataCell}>{getReasonFromFeatures(anomaly.features)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {highRiskAnomalies.length === 0 && (
            <div className={styles.emptyState}>
              No high-risk transactions found
            </div>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>ANOMALY STATISTICS</h3>
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>{stats.totalAnomalies}</div>
              <div className={styles.statLabel}>Total Anomalies</div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.statHigh}`}>{stats.highRisk}</div>
              <div className={styles.statLabel}>High Risk</div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.statMedium}`}>{stats.mediumRisk}</div>
              <div className={styles.statLabel}>Medium Risk</div>
            </div>
            <div className={styles.statCard}>
              <div className={`${styles.statValue} ${styles.statLow}`}>{stats.lowRisk}</div>
              <div className={styles.statLabel}>Low Risk</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}