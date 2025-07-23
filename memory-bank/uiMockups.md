# UI Mockups and Design Specifications

## Design Principles

**Dropbox-Style Flat Design**
- No borders or 3D effects
- Flat design with bold, vibrant colors and pastels
- Buttons are transparent with thick black borders showing background color
- Clean, minimal aesthetic focused on functionality

## Page 1: All Transactions Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LIVEFLOW FINANCIAL DASHBOARD                                [HOME] [ANOMALIES] [CREATE] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ALL TRANSACTIONS                                                            │
│                                                                             │
│ Filters: [All Accounts ▼] [All Types ▼] [Last 30 Days ▼] [APPLY FILTERS]   │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Account      │ Date       │ Type       │ Amount    │ Balance   │ Risk    │ │
│ │─────────────────────────────────────────────────────────────────────────│ │
│ │ CHECKING-001 │ 2024-01-15 │ DEPOSIT    │ +$2,500   │ $15,240   │ ●LOW    │ │
│ │ SAVINGS-002  │ 2024-01-15 │ WITHDRAWAL │ -$800     │ $8,950    │ ●LOW    │ │
│ │ BUSINESS-003 │ 2024-01-14 │ TRANSFER   │ -$5,000   │ $45,200   │ ●HIGH   │ │
│ │ CHECKING-001 │ 2024-01-14 │ PURCHASE   │ -$1,250   │ $12,740   │ ●MED    │ │
│ │ SAVINGS-002  │ 2024-01-14 │ DEPOSIT    │ +$3,200   │ $9,750    │ ●LOW    │ │
│ │ ...          │ ...        │ ...        │ ...       │ ...       │ ...     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ Showing 50 of 1,247 transactions                        [◀] Page 1 of 25 [▶] │
│                                                                             │
│ ACCOUNT SUMMARIES                                                           │
│ ┌──────────────┬──────────────┬──────────────┬──────────────┐              │
│ │ CHECKING-001 │ SAVINGS-002  │ BUSINESS-003 │ CREDIT-004   │              │
│ │ $15,240      │ $8,950       │ $45,200      │ -$2,180      │              │
│ │ ●LOW RISK    │ ●LOW RISK    │ ●HIGH RISK   │ ●MED RISK    │              │
│ └──────────────┴──────────────┴──────────────┴──────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features:
- **Transaction Table**: Sortable columns with real-time balance updates
- **Risk Indicators**: Color-coded risk levels (●LOW=green, ●MED=yellow, ●HIGH=red)
- **Filtering**: Multi-select dropdowns for accounts, transaction types, date ranges
- **Pagination**: Handle large transaction volumes efficiently  
- **Account Summaries**: Quick overview cards showing current balances and risk status
- **Real-time Updates**: Automatic refresh when new transactions are generated

## Page 2: Anomaly Detection Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LIVEFLOW FINANCIAL DASHBOARD                        [HOME] [ANOMALIES] [CREATE] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ANOMALY DETECTION DASHBOARD                                                 │
│                                                                             │
│ Detection Status: ●ACTIVE (Last run: 2 minutes ago)  [RUN DETECTION NOW]   │
│                                                                             │
│ RISK LEVEL DISTRIBUTION                                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │     ▄▄▄                                                                 │ │
│ │ LOW ███▄▄▄                                                              │ │
│ │     ███████▄▄▄                                                         │ │
│ │ MED ███████████▄▄▄                                                     │ │
│ │     ███████████████▄▄▄                                                 │ │
│ │HIGH ███████████████████▄▄▄                                             │ │
│ │     ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░       │ │
│ │     Jan 01        Jan 15        Jan 30        Feb 15        Feb 28     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ HIGH RISK TRANSACTIONS (Last 24 Hours)                                     │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Account      │ Time       │ Amount    │ Risk Score │ Reason              │ │
│ │─────────────────────────────────────────────────────────────────────────│ │
│ │ BUSINESS-003 │ 14:23      │ -$15,000  │ 0.89       │ Unusual large amt   │ │
│ │ CHECKING-001 │ 13:45      │ -$2,500   │ 0.76       │ Off-hours transfer  │ │
│ │ SAVINGS-002  │ 12:30      │ +$8,900   │ 0.72       │ Irregular pattern   │ │
│ │ CREDIT-004   │ 11:15      │ -$500     │ 0.68       │ Velocity spike      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ACCOUNT RISK ANALYSIS                                                       │
│ ┌────────────────────────────────────────────────────────────────────────┐  │
│ │ CHECKING-001  Risk: ●MED (0.45)  Transactions: 23  Flagged: 2         │  │
│ │ SAVINGS-002   Risk: ●LOW (0.23)  Transactions: 15  Flagged: 1         │  │
│ │ BUSINESS-003  Risk: ●HIGH(0.78)  Transactions: 41  Flagged: 8         │  │
│ │ CREDIT-004    Risk: ●MED (0.52)  Transactions: 28  Flagged: 3         │  │
│ └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features:
- **Detection Status**: Real-time status of anomaly detection system
- **Risk Distribution Chart**: ASCII bar chart showing risk trends over time
- **High Risk Transactions**: Recent anomalies with risk scores and basic explanations
- **Account Risk Analysis**: Summary view of each account's risk profile
- **Manual Trigger**: Button to manually run anomaly detection
- **Risk Scoring**: Display normalized scores (0.0-1.0) from IsolationForest

## Page 3: Create Transaction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ LIVEFLOW FINANCIAL DASHBOARD                        [HOME] [ANOMALIES] [CREATE] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ CREATE NEW TRANSACTION                                                      │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                                                                         │ │
│ │ Account ID: [CHECKING-001        ▼]                                     │ │
│ │                                                                         │ │
│ │ Transaction Type: [DEPOSIT ▼]                                           │ │
│ │                                                                         │ │
│ │ Amount: $ [________2500.00_______]                                      │ │
│ │                                                                         │ │
│ │ Description: [Monthly salary deposit                                  ] │ │
│ │                                                                         │ │
│ │ ┌─────────────────────────────────────────────────────────────────────┐ │ │
│ │ │ TRANSACTION PREVIEW                                                 │ │ │
│ │ │                                                                     │ │ │
│ │ │ Account: CHECKING-001                                               │ │ │
│ │ │ Current Balance: $12,740.00                                         │ │ │
│ │ │ Transaction: +$2,500.00 (DEPOSIT)                                   │ │ │
│ │ │ New Balance: $15,240.00                                             │ │ │
│ │ │                                                                     │ │ │
│ │ │ Timestamp: 2024-01-15 15:30:22 UTC                                  │ │ │
│ │ └─────────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │                    [CANCEL]           [CREATE TRANSACTION]             │ │
│ │                                                                         │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ RECENT TRANSACTIONS (Last 5)                                               │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ CHECKING-001 │ 2024-01-15 14:22 │ PURCHASE   │ -$1,250   │ $12,740      │ │
│ │ SAVINGS-002  │ 2024-01-15 13:15 │ DEPOSIT    │ +$3,200   │ $9,750       │ │
│ │ BUSINESS-003 │ 2024-01-15 12:45 │ TRANSFER   │ -$5,000   │ $45,200      │ │
│ │ CHECKING-001 │ 2024-01-15 11:30 │ WITHDRAWAL │ -$200     │ $13,990      │ │
│ │ CREDIT-004   │ 2024-01-15 10:15 │ PAYMENT    │ +$500     │ -$2,180      │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Features:
- **Form Validation**: Real-time validation of all input fields
- **Account Selection**: Dropdown populated from available accounts
- **Transaction Types**: DEPOSIT, WITHDRAWAL, TRANSFER, PURCHASE, PAYMENT
- **Amount Input**: Currency formatting with decimal precision
- **Transaction Preview**: Show calculated new balance before submission
- **Recent Transactions**: Context for the user's recent activity
- **Real-time Balance**: Current account balance updates immediately
- **Success Feedback**: Confirmation message after successful transaction creation

## Responsive Design Notes

- **Desktop First**: Optimized for 1920x1080 dashboard viewing
- **Minimum Width**: 1200px for proper table display
- **Color Scheme**: 
  - Primary: #2563eb (blue)
  - Success: #16a34a (green) 
  - Warning: #d97706 (yellow)
  - Danger: #dc2626 (red)
  - Background: #f8fafc (light gray)
  - Text: #1e293b (dark gray)

## Component Architecture

- **Layout Component**: Navigation header + main content area
- **TransactionTable**: Reusable table with sorting, filtering, pagination
- **RiskIndicator**: Color-coded risk level component
- **AccountSummary**: Account balance and status card
- **AnomalyChart**: ASCII-based risk distribution visualization
- **TransactionForm**: Form with validation and preview functionality
- **LoadingStates**: Loading indicators for data fetching
- **ErrorBoundary**: Error handling for failed API calls

## Navigation Flow

1. **Default Landing**: All Transactions page
2. **Navigation**: Three main tabs (HOME, ANOMALIES, CREATE)
3. **Real-time Updates**: All pages refresh data automatically every 30 seconds
4. **URL Routing**: TanStack Router with proper URL paths
   - `/` - All Transactions
   - `/anomalies` - Anomaly Dashboard  
   - `/create` - Create Transaction