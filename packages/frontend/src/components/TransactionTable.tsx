import { useState } from 'react'
import { Transaction } from '@liveflow/shared'
import styles from './TransactionTable.module.css'

interface TransactionTableProps {
  transactions: Transaction[]
}

type SortField = 'timestamp' | 'amount' | 'balanceAfter' | 'riskLevel'
type SortDirection = 'asc' | 'desc'

export function TransactionTable({ transactions }: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField>('timestamp')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedTransactions = [...transactions].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'timestamp':
        aValue = new Date(a.timestamp)
        bValue = new Date(b.timestamp)
        break
      case 'amount':
        aValue = a.amount
        bValue = b.amount
        break
      case 'balanceAfter':
        aValue = a.balanceAfter
        bValue = b.balanceAfter
        break
      case 'riskLevel':
        const riskOrder = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3 }
        aValue = riskOrder[a.riskLevel as keyof typeof riskOrder] || 0
        bValue = riskOrder[b.riskLevel as keyof typeof riskOrder] || 0
        break
      default:
        return 0
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  const formatCurrency = (amount: number) => {
    const sign = amount >= 0 ? '+' : ''
    return `${sign}$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  }

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const getRiskIndicator = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'LOW':
        return <span className={styles.riskLow}>●LOW</span>
      case 'MEDIUM':
        return <span className={styles.riskMedium}>●MED</span>
      case 'HIGH':
        return <span className={styles.riskHigh}>●HIGH</span>
      default:
        return <span className={styles.riskUnknown}>●—</span>
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return ''
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            <th className={styles.headerCell}>Account</th>
            <th 
              className={`${styles.headerCell} ${styles.sortable}`}
              onClick={() => handleSort('timestamp')}
            >
              Date{getSortIcon('timestamp')}
            </th>
            <th className={styles.headerCell}>Type</th>
            <th 
              className={`${styles.headerCell} ${styles.sortable}`}
              onClick={() => handleSort('amount')}
            >
              Amount{getSortIcon('amount')}
            </th>
            <th 
              className={`${styles.headerCell} ${styles.sortable}`}
              onClick={() => handleSort('balanceAfter')}
            >
              Balance{getSortIcon('balanceAfter')}
            </th>
            <th 
              className={`${styles.headerCell} ${styles.sortable}`}
              onClick={() => handleSort('riskLevel')}
            >
              Risk{getSortIcon('riskLevel')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTransactions.map((transaction) => (
            <tr key={transaction.transactionId} className={styles.dataRow}>
              <td className={styles.dataCell}>{transaction.accountId}</td>
              <td className={styles.dataCell}>{formatDate(transaction.timestamp)}</td>
              <td className={styles.dataCell}>{transaction.transactionType}</td>
              <td className={`${styles.dataCell} ${styles.amountCell}`}>
                {formatCurrency(transaction.amount)}
              </td>
              <td className={styles.dataCell}>
                ${transaction.balanceAfter.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td className={styles.dataCell}>
                {getRiskIndicator(transaction.riskLevel)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {transactions.length === 0 && (
        <div className={styles.emptyState}>
          No transactions found
        </div>
      )}
    </div>
  )
}