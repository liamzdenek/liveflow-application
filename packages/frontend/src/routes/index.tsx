import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { Transaction, Account } from '@liveflow/shared'
import { TransactionTable } from '../components/TransactionTable'
import { AccountSummary } from '../components/AccountSummary'
import styles from './transactions.module.css'

export const Route = createFileRoute('/')(({
  component: TransactionsPage,
})

function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    accountId: '',
    transactionType: '',
    dateRange: 'last30days'
  })

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const accountsData = await api.accounts.getAll()
      setAccounts(accountsData.accounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = async (accountId: string) => {
    try {
      setLoading(true)
      setError(null)
      
      const transactionsData = await api.transactions.getAll({ 
        accountId, 
        limit: 50 
      })
      
      setTransactions(transactionsData.transactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }

  const applyFilters = async () => {
    if (!filters.accountId) {
      setError('Please select an account to view transactions')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const data = await api.transactions.getAll({
        accountId: filters.accountId,
        limit: 50
      })
      setTransactions(data.transactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply filters')
    } finally {
      setLoading(false)
    }
  }

  const handleAccountChange = (accountId: string) => {
    setFilters({...filters, accountId})
    setTransactions([]) // Clear previous transactions
    
    if (accountId) {
      loadTransactions(accountId)
    }
  }

  if (loading && accounts.length === 0) {
    return <div className={styles.loading}>Loading accounts...</div>
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>ALL TRANSACTIONS</h2>
      
      <div className={styles.filters}>
        <select 
          value={filters.accountId} 
          onChange={(e) => handleAccountChange(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="">Select Account ▼</option>
          {accounts.map(account => (
            <option key={account.accountId} value={account.accountId}>
              {account.accountId}
            </option>
          ))}
        </select>
        
        <select 
          value={filters.transactionType} 
          onChange={(e) => setFilters({...filters, transactionType: e.target.value})}
          className={styles.filterSelect}
        >
          <option value="">All Types ▼</option>
          <option value="DEPOSIT">DEPOSIT</option>
          <option value="WITHDRAWAL">WITHDRAWAL</option>
          <option value="TRANSFER">TRANSFER</option>
          <option value="PURCHASE">PURCHASE</option>
          <option value="PAYMENT">PAYMENT</option>
        </select>
        
        <select 
          value={filters.dateRange} 
          onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
          className={styles.filterSelect}
        >
          <option value="last30days">Last 30 Days ▼</option>
          <option value="last7days">Last 7 Days</option>
          <option value="today">Today</option>
        </select>
        
        <button 
          onClick={applyFilters} 
          className={styles.applyButton} 
          disabled={loading || !filters.accountId}
        >
          {loading ? 'APPLYING...' : '[APPLY FILTERS]'}
        </button>
      </div>

      {!filters.accountId ? (
        <div className={styles.placeholder}>
          <h3>Please select an account to view transactions</h3>
          <p>Choose an account from the dropdown above to see its transaction history.</p>
        </div>
      ) : (
        <>
          <TransactionTable transactions={transactions} />
          
          <div className={styles.pagination}>
            Showing {transactions.length} transactions for account {filters.accountId}
          </div>
        </>
      )}

      <AccountSummary accounts={accounts} />
    </div>
  )
}