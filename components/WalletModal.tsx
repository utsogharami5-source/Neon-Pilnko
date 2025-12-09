import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, History, ArrowDownCircle, ArrowUpCircle, CheckCircle, Clock, XCircle, AlertCircle, Lock, Shield } from 'lucide-react';
import { PaymentMethod, WalletTransaction, TransactionStatus, GameMode } from '../types';
import { db } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail?: string | null;
  balance: number; // This should always be REAL balance
  gameMode: GameMode;
  isAdmin?: boolean; 
}

const WalletModal: React.FC<WalletModalProps> = ({ isOpen, onClose, userId, userEmail, balance, gameMode, isAdmin = false }) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>('deposit');
  const [method, setMethod] = useState<PaymentMethod>('bkash');
  const [highlightBalance, setHighlightBalance] = useState(false);
  const prevBalance = useRef(balance);
  
  // Form States
  const [amount, setAmount] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [trxId, setTrxId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // History State
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  // Admin Numbers
  const ADMIN_NUMBERS = {
    bkash: "01965551368",
    nagad: "01965551368"
  };

  // Trigger highlight animation when balance changes
  useEffect(() => {
      if (prevBalance.current !== balance) {
          setHighlightBalance(true);
          const timer = setTimeout(() => setHighlightBalance(false), 1000);
          prevBalance.current = balance;
          return () => clearTimeout(timer);
      }
  }, [balance]);

  useEffect(() => {
    if (userId && isOpen) {
        const q = query(
            collection(db, "transactions"),
            where("userId", "==", userId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const txs: WalletTransaction[] = [];
            snapshot.forEach((doc) => {
                txs.push({ id: doc.id, ...doc.data() } as WalletTransaction);
            });
            // Client-side sort to avoid Firestore index requirement
            txs.sort((a, b) => b.timestamp - a.timestamp);
            setTransactions(txs);
        }, (err) => {
            console.error("Firebase error:", err);
        });

        return () => unsubscribe();
    }
  }, [userId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
        // --- Amount Validation ---
        if (!amount) throw new Error("Please enter an amount.");
        const numAmount = parseFloat(amount);
        
        if (isNaN(numAmount) || numAmount <= 0) {
            throw new Error("Amount must be a valid positive number.");
        }
        if (numAmount < 100) {
            throw new Error("Minimum transaction amount is 100 BDT.");
        }
        if (numAmount > 25000) {
            throw new Error("Maximum transaction amount is 25,000 BDT.");
        }

        if (activeTab === 'withdraw' && numAmount > balance) {
            throw new Error(`Insufficient Real Funds. Available: $${balance.toFixed(2)}`);
        }

        // --- Phone Number Validation ---
        if (!phoneNumber) throw new Error("Phone number is required.");
        
        // Strict regex for BD Phone Numbers: Starts with 01, followed by 9 digits
        const phoneRegex = /^01\d{9}$/;
        if (!phoneRegex.test(phoneNumber)) {
            throw new Error("Invalid phone number. Must be exactly 11 digits starting with '01'.");
        }
        
        // --- Transaction ID Validation (Deposit Only) ---
        if (activeTab === 'deposit') {
            if (!trxId) throw new Error("Transaction ID is required.");
            
            const cleanTrx = trxId.trim();
            if (cleanTrx.length < 8) {
                throw new Error("Invalid Transaction ID. It seems too short (min 8 chars).");
            }
            if (cleanTrx.length > 30) {
                throw new Error("Invalid Transaction ID. It seems too long.");
            }
            
            // Check for alphanumeric characters only
            const trxRegex = /^[a-zA-Z0-9]+$/;
            if (!trxRegex.test(cleanTrx)) {
                throw new Error("Transaction ID should contain letters and numbers only.");
            }
        }

        const txData: Omit<WalletTransaction, 'id'> = {
            userId,
            email: userEmail || 'Unknown',
            type: activeTab as 'deposit' | 'withdraw',
            method,
            amount: numAmount,
            status: 'pending',
            timestamp: Date.now(),
        };

        if (activeTab === 'deposit') {
            txData.senderNumber = phoneNumber;
            txData.trxId = trxId.trim();
        } else {
            txData.receiverNumber = phoneNumber;
        }

        // Add transaction record
        await addDoc(collection(db, "transactions"), txData);

        // IMMEDIATE ACTION: If withdrawal, deduct balance immediately to "lock" funds
        if (activeTab === 'withdraw') {
            const userRef = doc(db, 'users', userId);
            await updateDoc(userRef, {
                realBalance: increment(-numAmount)
            });
        }

        setSuccessMsg(activeTab === 'deposit' 
            ? "Deposit submitted! Please wait for admin approval." 
            : "Withdrawal submitted! Funds locked pending approval.");
        
        // Clear form
        setAmount('');
        setPhoneNumber('');
        setTrxId('');

    } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to submit request.");
    } finally {
        setLoading(false);
    }
  };

  if (!isOpen) return null;

  const StatusBadge = ({ status }: { status: TransactionStatus }) => {
      const styles = {
          pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
          approved: "bg-green-500/20 text-lime-400 border-green-500/50",
          rejected: "bg-red-500/20 text-red-400 border-red-500/50",
          cancelled: "bg-red-500/20 text-red-400 border-red-500/50"
      };
      const icons = {
          pending: <Clock className="w-3 h-3" />,
          approved: <CheckCircle className="w-3 h-3" />,
          rejected: <XCircle className="w-3 h-3" />,
          cancelled: <XCircle className="w-3 h-3" />
      };
      
      const label = status === 'rejected' ? 'Cancelled' : status;

      return (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${styles[status]} uppercase tracking-wider`}>
              {icons[status]} {label}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#161922] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-[#1a1d29]">
            <div className="flex items-center gap-2">
                <h2 className="text-xl font-black italic text-white flex items-center gap-2">
                    <span className="text-blue-500">WALLET</span>
                </h2>
                {isAdmin && (
                    <div className="flex items-center gap-1 bg-red-500/20 text-red-400 px-2 py-1 rounded text-[10px] font-bold border border-red-500/30">
                        <Shield className="w-3 h-3" />
                        Admin
                    </div>
                )}
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-[#0f1522] px-3 py-1 rounded-full border border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Real:</span>
                    <span className={`font-mono font-bold transition-colors duration-300 ${highlightBalance ? 'text-white' : 'text-lime-400'}`}>
                        ${balance.toFixed(2)}
                    </span>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                </button>
            </div>
        </div>

        {/* Warning for Demo Mode */}
        {gameMode === 'demo' && (
            <div className="bg-blue-600/10 border-b border-blue-500/20 p-2 text-center text-[10px] text-blue-300 font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-3 h-3" />
                <span>You are in Demo Mode. Switch to Real Mode to play with cash.</span>
            </div>
        )}

        {/* Tabs */}
        <div className="flex p-2 gap-2 bg-[#0f1522]">
            <button
                onClick={() => { setActiveTab('deposit'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${activeTab === 'deposit' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'bg-[#1e2535] text-slate-400 hover:bg-[#2c364c]'
                    }`}
            >
                Deposit
            </button>
            
            <button
                onClick={() => { 
                    if (gameMode === 'real') {
                        setActiveTab('withdraw'); 
                        setError(''); 
                        setSuccessMsg('');
                    }
                }}
                disabled={gameMode === 'demo'}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2
                    ${activeTab === 'withdraw' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : gameMode === 'demo' 
                            ? 'bg-[#1e2535] text-slate-600 cursor-not-allowed opacity-50'
                            : 'bg-[#1e2535] text-slate-400 hover:bg-[#2c364c]'
                    }`}
            >
                {gameMode === 'demo' && <Lock className="w-3 h-3" />}
                Withdraw
            </button>

            <button
                onClick={() => { setActiveTab('history'); setError(''); setSuccessMsg(''); }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all
                    ${activeTab === 'history' 
                        ? 'bg-blue-600 text-white shadow-lg' 
                        : 'bg-[#1e2535] text-slate-400 hover:bg-[#2c364c]'
                    }`}
            >
                History
            </button>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
            {activeTab === 'history' ? (
                <div className="space-y-2">
                    {transactions.length === 0 ? (
                        <div className="text-center text-slate-500 py-10 text-xs font-bold uppercase">No transactions found</div>
                    ) : (
                        transactions.map(tx => (
                            <div key={tx.id} className="bg-[#1e2535] p-3 rounded-xl border border-slate-700/50 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        {tx.type === 'deposit' ? <ArrowDownCircle className="text-lime-400 w-4 h-4" /> : <ArrowUpCircle className="text-red-400 w-4 h-4" />}
                                        <span className="font-bold text-sm capitalize text-white">{tx.type}</span>
                                    </div>
                                    <StatusBadge status={tx.status} />
                                </div>
                                <div className="flex justify-between items-end">
                                    <div className="text-[10px] text-slate-400 flex flex-col">
                                        <span>{new Date(tx.timestamp).toLocaleString()}</span>
                                        <span className="uppercase">{tx.method}</span>
                                        {tx.trxId && <span className="font-mono text-xs text-slate-500">TRX: {tx.trxId}</span>}
                                    </div>
                                    <span className="font-mono font-bold text-lg text-white">
                                        {tx.type === 'deposit' ? '+' : '-'}${tx.amount}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    
                    {/* Method Selection */}
                    <div className="grid grid-cols-2 gap-3">
                        {(['bkash', 'nagad'] as const).map(m => (
                            <div 
                                key={m}
                                onClick={() => setMethod(m)}
                                className={`cursor-pointer border-2 rounded-xl p-3 flex flex-col items-center gap-2 transition-all
                                    ${method === m ? 'border-pink-500 bg-pink-500/10' : 'border-slate-700 bg-[#0f1522] opacity-50 hover:opacity-100'}
                                `}
                            >
                                <span className="font-black uppercase tracking-widest text-sm">{m}</span>
                            </div>
                        ))}
                    </div>

                    {/* Admin Number Display (Deposit Only) */}
                    {activeTab === 'deposit' && (
                        <div className="bg-[#0f1522] p-4 rounded-xl border border-slate-700 text-center">
                            <p className="text-[10px] uppercase text-slate-400 font-bold mb-1">Send Money to this {method} Number</p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="font-mono text-xl font-bold text-pink-500 select-all">{ADMIN_NUMBERS[method]}</span>
                                <button type="button" onClick={() => navigator.clipboard.writeText(ADMIN_NUMBERS[method])} className="text-slate-400 hover:text-white">
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2">Use "Send Money" option in your app.</p>
                        </div>
                    )}

                    {/* Amount */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">Amount (BDT)</label>
                        <input 
                            type="number" 
                            required
                            min="100"
                            placeholder="Min: 100"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full bg-[#0f1522] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-bold"
                        />
                    </div>

                    {/* Sender/Receiver Number */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">
                            {activeTab === 'deposit' ? 'Sender Number' : 'Receiver Number'}
                        </label>
                        <input 
                            type="text" 
                            required
                            placeholder="01XXXXXXXXX"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full bg-[#0f1522] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono"
                        />
                    </div>

                    {/* Transaction ID (Deposit Only) */}
                    {activeTab === 'deposit' && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase">Transaction ID</label>
                            <input 
                                type="text" 
                                required
                                placeholder="e.g. 9H7S..."
                                value={trxId}
                                onChange={(e) => setTrxId(e.target.value)}
                                className="w-full bg-[#0f1522] border border-slate-700 rounded-lg p-3 text-white focus:border-blue-500 outline-none font-mono"
                            />
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 text-red-400 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="leading-tight">{error}</span>
                        </div>
                    )}
                    
                    {successMsg && (
                        <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-3 flex items-start gap-2 text-lime-400 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="leading-tight">{successMsg}</span>
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-4 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Processing...' : 'Confirm'}
                    </button>
                </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default WalletModal;