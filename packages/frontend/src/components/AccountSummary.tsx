import { Account } from '@liveflow/shared'
import styles from './AccountSummary.module.css'

interface AccountSummaryProps {
  accounts: Account[]
}

export function AccountSummary({ accounts }: AccountSummaryProps) {
  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const getRiskIndicator = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW':
        return <span className={styles.riskLow}>●LOW RISK</span>
      case 'MEDIUM':
        return <span className={styles.riskMedium}>●MED RISK</span>
      case 'HIGH':
        return <span className={styles.riskHigh}>●HIGH RISK</span>
      default:
        return <span className={styles.riskUnknown}>●UNKNOWN</span>
    }
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>ACCOUNT SUMMARIES</h3>
      <div className={styles.grid}>
        {accounts.map((account) => (
          <div key={account.accountId} className={styles.card}>
            <div className={styles.accountId}>{account.accountId}</div>
            <div className={styles.balance}>{formatCurrency(account.balance)}</div>
            <div className={styles.risk}>{getRiskIndicator(account.riskLevel)}</div>
          </div>
        ))}
        
        {accounts.length === 0 && (
          <div className={styles.emptyState}>
            No accounts available
          </div>
        )}
      </div>
    </div>
  )
}