export type RiskLevel = 'low' | 'medium' | 'high';
export type GameMode = 'demo' | 'real';

export interface GameState {
  balance: number;
  betAmount: number;
  rows: number; // 8 to 16
  risk: RiskLevel;
  history: BetRecord[];
}

export interface BetRecord {
  id: string;
  amount: number;
  multiplier: number;
  payout: number;
  timestamp: number;
  profit: number; // calculated as payout - amount
}

export interface PlinkoConfig {
  rows: number;
  risk: RiskLevel;
}

export interface MultiplierValue {
  value: number;
  color: string; // Hex or Tailwind class mapping
}

// Wallet Types
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// Changed from union type to string to support dynamic admin-added methods
export type PaymentMethod = string; 

export type TransactionType = 'deposit' | 'withdraw';

export interface WalletTransaction {
    id: string;
    userId: string;
    email?: string; // Added for Admin UI
    type: TransactionType;
    method: PaymentMethod;
    amount: number;
    senderNumber?: string; // For deposits
    receiverNumber?: string; // For withdrawals
    trxId?: string; // For deposits
    status: TransactionStatus;
    timestamp: number;
}

export interface PaymentMethodConfig {
    id: string;
    name: string;      // Display Name (e.g. "Bkash")
    number: string;    // Admin Number for deposits
    isEnabled: boolean;
    type: 'mobile_banking' | 'bank' | 'crypto' | 'other';
}