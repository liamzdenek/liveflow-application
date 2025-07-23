import { useState } from 'react'
import { Account, Transaction, CreateTransactionRequest } from '@liveflow/shared'
import { api } from '../api/client'
import styles from './CreateTransactionForm.module.css'

interface CreateTransactionFormProps {
  accounts: Account[]
  onTransactionCreated: (transaction: Transaction) => void
}

export function CreateTransactionForm({ accounts, onTransactionCreated }: CreateTransactionFormProps) {
  const [formData, setFormData] = useState<CreateTransactionRequest>({
    accountId: '',
    transactionType: 'DEPOSIT',
    amount: 0,
    description: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const selectedAccount = accounts.find(account => account.accountId === formData.accountId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.accountId || !formData.amount) {
      setError('Please fill in all required fields')
      return
    }

    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const newTransaction = await api.transactions.create(formData)
      
      setSuccess(`Transaction created successfully! New balance: $${newTransaction.balanceAfter.toLocaleString()}`)
      onTransactionCreated(newTransaction)
      
      // Reset form
      setFormData({
        accountId: '',
        transactionType: 'DEPOSIT',
        amount: 0,
        description: ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction')
    } finally {
      setLoading(false)
    }
  }

  const calculateNewBalance = () => {
    if (!selectedAccount || !formData.amount) return null
    
    const currentBalance = selectedAccount.balance
    const amount = formData.amount
    
    switch (formData.transactionType) {
      case 'DEPOSIT':
      case 'PAYMENT':
        return currentBalance + amount
      case 'WITHDRAWAL':
      case 'TRANSFER':
      case 'PURCHASE':
        return currentBalance - amount
      default:
        return currentBalance
    }
  }

  const newBalance = calculateNewBalance()

  return (
    <div className={styles.container}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>Account ID:</label>
          <select
            value={formData.accountId}
            onChange={(e) => setFormData({...formData, accountId: e.target.value})}
            className={styles.select}
            required
          >
            <option value="">Select Account ▼</option>
            {accounts.map(account => (
              <option key={account.accountId} value={account.accountId}>
                {account.accountId}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Transaction Type:</label>
          <select
            value={formData.transactionType}
            onChange={(e) => setFormData({...formData, transactionType: e.target.value})}
            className={styles.select}
            required
          >
            <option value="DEPOSIT">DEPOSIT</option>
            <option value="WITHDRAWAL">WITHDRAWAL</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="PURCHASE">PURCHASE</option>
            <option value="PAYMENT">PAYMENT</option>
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Amount:</label>
          <div className={styles.amountContainer}>
            <span className={styles.currencySymbol}>$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max="999999999.99"
              value={formData.amount || ''}
              onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
              className={styles.amountInput}
              placeholder="0.00"
              required
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Description:</label>
          <input
            type="text"
            maxLength={255}
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
            className={styles.input}
            placeholder="Optional description"
          />
        </div>

        {selectedAccount && formData.amount > 0 && (
          <div className={styles.preview}>
            <h4 className={styles.previewTitle}>TRANSACTION PREVIEW</h4>
            <div className={styles.previewContent}>
              <div className={styles.previewRow}>
                <span>Account:</span>
                <span>{selectedAccount.accountId}</span>
              </div>
              <div className={styles.previewRow}>
                <span>Current Balance:</span>
                <span>${selectedAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={styles.previewRow}>
                <span>Transaction:</span>
                <span>
                  {['DEPOSIT', 'PAYMENT'].includes(formData.transactionType) ? '+' : '-'}
                  ${formData.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} 
                  ({formData.transactionType})
                </span>
              </div>
              <div className={styles.previewRow}>
                <span>New Balance:</span>
                <span className={styles.newBalance}>
                  ${newBalance?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className={styles.previewRow}>
                <span>Timestamp:</span>
                <span>{new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {success && (
          <div className={styles.success}>{success}</div>
        )}

        <div className={styles.buttons}>
          <button
            type="button"
            onClick={() => {
              setFormData({
                accountId: '',
                transactionType: 'DEPOSIT',
                amount: 0,
                description: ''
              })
              setError(null)
              setSuccess(null)
            }}
            className={styles.cancelButton}
          >
            [CANCEL]
          </button>
          <button
            type="submit"
            disabled={loading || !formData.accountId || !formData.amount}
            className={styles.submitButton}
          >
            {loading ? 'CREATING...' : '[CREATE TRANSACTION]'}
          </button>
        </div>
      </form>
    </div>
  )
}