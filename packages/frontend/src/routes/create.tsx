import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { api } from '../api/client'
import { Account, Transaction } from '@liveflow/shared'
import { CreateTransactionForm } from '../components/CreateTransactionForm'
import styles from './create.module.css'

export const Route = createFileRoute('/create')({
  component: CreateTransactionPage,
})

function CreateTransactionPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const handleTransactionCreated = (newTransaction: Transaction) => {
    // Update account balance in the accounts list
    setAccounts(prev => prev.map(account => 
      account.accountId === newTransaction.accountId 
        ? { ...account, balance: newTransaction.balanceAfter }
        : account
    ))
  }

  if (loading && accounts.length === 0) {
    return <div className={styles.loading}>Loading accounts...</div>
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.pageTitle}>CREATE NEW TRANSACTION</h2>
      
      <CreateTransactionForm 
        accounts={accounts}
        onTransactionCreated={handleTransactionCreated}
      />
    </div>
  )
}