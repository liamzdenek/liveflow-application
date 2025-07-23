import {
  Account,
  Transaction,
  Anomaly,
  CreateTransactionRequest,
  HealthResponse,
  AccountsResponse,
  TransactionsResponse,
  AnomaliesResponse,
  AnomalyStatsResponse
} from '@liveflow/shared';

const API_BASE_URL = 'https://916imlqdrl.execute-api.us-west-2.amazonaws.com/prod';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new APIError(response.status, `API Error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

export const api = {
  // Health check
  health: (): Promise<HealthResponse> =>
    apiRequest('/health'),

  // Account operations
  accounts: {
    getAll: (): Promise<AccountsResponse> =>
      apiRequest('/accounts'),
  },

  // Transaction operations
  transactions: {
    getAll: (params?: { accountId?: string; limit?: number; lastKey?: string }): Promise<TransactionsResponse> => {
      const searchParams = new URLSearchParams();
      if (params?.accountId) searchParams.append('accountId', params.accountId);
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.lastKey) searchParams.append('lastKey', params.lastKey);
      
      const query = searchParams.toString();
      return apiRequest(`/transactions${query ? `?${query}` : ''}`);
    },

    create: (transaction: CreateTransactionRequest): Promise<Transaction> =>
      apiRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify(transaction),
      }),
  },

  // Anomaly operations
  anomalies: {
    getAll: (params?: { limit?: number }): Promise<AnomaliesResponse> => {
      const searchParams = new URLSearchParams();
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      
      const query = searchParams.toString();
      return apiRequest(`/anomalies${query ? `?${query}` : ''}`);
    },

    getStats: (): Promise<AnomalyStatsResponse> =>
      apiRequest('/anomalies/stats'),
  },
};

export { APIError };