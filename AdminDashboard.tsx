import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, updateDoc, doc, increment, orderBy, query, setDoc, deleteDoc, runTransaction, addDoc } from 'firebase/firestore';
import { WalletTransaction, TransactionStatus, PaymentMethodConfig } from '../types';
import { CheckCircle, XCircle, Clock, Users, Wallet, Trash2, Archive, List, ArrowUpDown, ArrowUp, ArrowDown, Edit2, ChevronDown, PlusCircle, MinusCircle, Save, Lock, Unlock, Settings, ToggleLeft, ToggleRight, Smartphone, Banknote, AlertTriangle } from 'lucide-react';

interface UserData {
  uid: string;
  email: string;
  demoBalance: number;
  realBalance: number;
  createdAt: number;
  isBlocked?: boolean;
}

type SortKey = keyof Pick<WalletTransaction, 'timestamp' | 'amount' | 'type'>;

// --- Helper Component for Payment Methods ---
interface PaymentMethodCardProps {
    method: PaymentMethodConfig;
    onToggle: (m: PaymentMethodConfig) => void;
    onDelete: (id: string) => void;
    onUpdateNumber: (id: string, num: string) => void;
    loadingId: string | null;
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ method, onToggle, onDelete, onUpdateNumber, loadingId }) => {
    const [numberVal, setNumberVal] = useState(method.number);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        setNumberVal(method.number);
        setIsDirty(false);
    }, [method.number]);

    return (
        <div className="bg-[#0f1522] p-4 rounded-xl border border-slate-700 flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                        {method.name.charAt(0)}
                    </div>
                    <div>
                        <div className="font-bold text-white">{method.name}</div>
                        <div className="text-[10px] text-slate-500 uppercase">{method.type}</div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                        <button 
                            onClick={() => onToggle(method)}
                            disabled={loadingId === method.id}
                            className={`p-2 rounded-lg transition-colors ${method.isEnabled ? 'text-lime-400 bg-lime-500/10' : 'text-slate-600 bg-slate-800'}`}
                            title={method.isEnabled ? "Disable Method" : "Enable Method"}
                        >
                            {method.isEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                        <button 
                            onClick={() => onDelete(method.id)}
                            disabled={loadingId === method.id}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                </div>
            </div>

            <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Deposit Number</label>
                <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 bg-[#1a1d29] p-2 rounded-lg border border-slate-700 focus-within:border-blue-500 transition-colors">
                        <Smartphone className="w-4 h-4 text-slate-500" />
                        <input 
                            type="text"
                            value={numberVal}
                            onChange={(e) => {
                                setNumberVal(e.target.value);
                                setIsDirty(e.target.value !== method.number);
                            }}
                            className="bg-transparent border-none outline-none text-sm font-mono text-white flex-1 placeholder-slate-600"
                            placeholder="Enter Number"
                        />
                    </div>
                    {isDirty && (
                        <button 
                            onClick={() => onUpdateNumber(method.id, numberVal)}
                            disabled={loadingId === method.id}
                            className="bg-lime-500 hover:bg-lime-400 text-[#0f1522] px-3 py-2 rounded-lg font-bold transition-all shadow-lg flex items-center gap-1 text-xs animate-in fade-in zoom-in"
                        >
                            <Save className="w-3 h-3" /> Save
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
// ---------------------------------------------


const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'users' | 'settings' | 'all'>('pending');
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'all'>('all');
  
  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: SortKey, direction: 'asc' | 'desc' }>({
      key: 'timestamp',
      direction: 'desc'
  });
  
  // Data States
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodConfig[]>([]);
  const [permissionError, setPermissionError] = useState(false);
  
  // Action States
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Adjustment Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [selectedUserForAdjustment, setSelectedUserForAdjustment] = useState<UserData | null>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'add' | 'deduct'>('add');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');

  // New Method State
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodNumber, setNewMethodNumber] = useState('');

  // Fetch Transactions
  useEffect(() => {
    // Initial fetch is sorted by time, but client-side sort will override for UI
    const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs: WalletTransaction[] = [];
      snapshot.forEach((doc) => {
        txs.push({ id: doc.id, ...doc.data() } as WalletTransaction);
      });
      setTransactions(txs);
      setPermissionError(false);
    }, (error) => {
        console.error("Error fetching transactions:", error);
        if (error.code === 'permission-denied') setPermissionError(true);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Users
  useEffect(() => {
      const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
          const u: UserData[] = [];
          snapshot.forEach((doc) => {
              u.push({ uid: doc.id, ...doc.data() } as UserData);
          });
          // Sort by newest
          u.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setUsers(u);
      }, (error) => {
          console.error("Error fetching users:", error);
           if (error.code === 'permission-denied') setPermissionError(true);
      });
      return () => unsubscribe();
  }, []);

  // Fetch Payment Methods
  useEffect(() => {
      const unsubscribe = onSnapshot(collection(db, "payment_methods"), (snapshot) => {
          const methods: PaymentMethodConfig[] = [];
          snapshot.forEach((doc) => {
              methods.push({ id: doc.id, ...doc.data() } as PaymentMethodConfig);
          });
          setPaymentMethods(methods);
      }, (error) => {
          console.error("Error fetching payment methods:", error);
           if (error.code === 'permission-denied') setPermissionError(true);
      });
      return () => unsubscribe();
  }, []);

  const handleSort = (key: SortKey) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
      }));
  };

  const getSortedTransactions = (txs: WalletTransaction[]) => {
      return [...txs].sort((a, b) => {
          const aVal = a[sortConfig.key];
          const bVal = b[sortConfig.key];
          
          if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
      });
  };

  // General Status Update Handler
  const handleStatusChange = async (newStatus: TransactionStatus, tx: WalletTransaction) => {
    if (newStatus === tx.status) return;
    
    // Only ask for confirmation if it's a destructive action or significant change
    if (newStatus === 'rejected' || newStatus === 'cancelled') {
        const confirmMsg = `Change status from ${tx.status.toUpperCase()} to ${newStatus.toUpperCase()}?`;
        if (!window.confirm(confirmMsg)) return;
    }

    setLoadingId(tx.id);

    try {
        // Immediate Optimistic Update for UI Responsiveness
        setTransactions(prev => prev.map(t => 
            t.id === tx.id ? { ...t, status: newStatus } : t
        ));

        await runTransaction(db, async (transaction) => {
            const txRef = doc(db, 'transactions', tx.id);
            const txDoc = await transaction.get(txRef);
            
            if (!txDoc.exists()) throw new Error("Transaction document does not exist!");
            
            const currentTx = txDoc.data() as WalletTransaction;
            const currentStatus = currentTx.status;
            // Use ID from doc, fallback to prop
            const targetUserId = currentTx.userId || tx.userId; 
            const amount = Number(currentTx.amount);

            let balanceChange = 0;

            if (currentTx.type === 'deposit') {
                 // Deposit Logic: Money is added only when APPROVED
                 const wasActive = currentStatus === 'approved';
                 const isActive = newStatus === 'approved';
                 
                 if (!wasActive && isActive) balanceChange = amount;
                 if (wasActive && !isActive) balanceChange = -amount;
                 
            } else if (currentTx.type === 'withdraw') {
                 // Withdrawal Logic: Money is deducted when PENDING or APPROVED
                 // Money is returned if REJECTED or CANCELLED
                 const wasDeducted = currentStatus === 'pending' || currentStatus === 'approved';
                 const isDeducted = newStatus === 'pending' || newStatus === 'approved';
                 
                 if (wasDeducted && !isDeducted) balanceChange = amount; // Refund
                 if (!wasDeducted && isDeducted) balanceChange = -amount; // Re-deduct
            }

            // Perform Writes
            // 1. Balance Update (if user exists)
            if (balanceChange !== 0 && targetUserId) {
                const userRef = doc(db, 'users', targetUserId);
                const userDoc = await transaction.get(userRef);
                if (userDoc.exists()) {
                    transaction.update(userRef, { realBalance: increment(balanceChange) });
                } else {
                    console.warn(`User ${targetUserId} not found. Balance not updated.`);
                }
            }
            
            // 2. Status Update
            transaction.update(txRef, { status: newStatus });
        });
        
    } catch (error: any) {
        console.error("Error updating status:", error);
        alert(`Failed to update status: ${error.message}`);
        // Revert optimistic update on failure (fetched by snapshot usually, but safe to force revert)
        // We can just wait for the snapshot to correct it, but alerting is key.
    } finally {
        setLoadingId(null);
    }
  };

  // Shortcut Handlers
  const handleApprove = (e: React.MouseEvent, tx: WalletTransaction) => {
    e.stopPropagation(); e.preventDefault();
    handleStatusChange('approved', tx);
  };

  const handleCancel = (e: React.MouseEvent, tx: WalletTransaction) => {
    e.stopPropagation(); e.preventDefault();
    handleStatusChange('cancelled', tx);
  };

  const handleDelete = async (e: React.MouseEvent, txId: string) => {
      e.stopPropagation();
      e.preventDefault();
      if(!window.confirm("Are you sure you want to PERMANENTLY DELETE this record? This cannot be undone.")) return;

      setLoadingId(txId);
      try {
          await deleteDoc(doc(db, "transactions", txId));
          // Optimistic remove
          setTransactions(prev => prev.filter(t => t.id !== txId));
      } catch (error: any) {
          console.error("Error deleting:", error);
          alert("Failed to delete record.");
      } finally {
          setLoadingId(null);
      }
  };

  // User Adjustment Handlers
  const openAdjustmentModal = (user: UserData) => {
      setSelectedUserForAdjustment(user);
      setAdjustmentAmount('');
      setAdjustmentReason('');
      setAdjustmentType('add');
      setIsAdjustmentModalOpen(true);
  };

  const submitAdjustment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedUserForAdjustment || !adjustmentAmount) return;

      const amt = parseFloat(adjustmentAmount);
      if (isNaN(amt) || amt <= 0) {
          alert("Please enter a valid positive amount.");
          return;
      }

      setLoadingId('adjustment');
      try {
          const userRef = doc(db, 'users', selectedUserForAdjustment.uid);
          const adjustmentValue = adjustmentType === 'add' ? amt : -amt;

          await runTransaction(db, async (transaction) => {
              // Update Balance
              transaction.update(userRef, { realBalance: increment(adjustmentValue) });

              // Create Transaction Record
              const newTxRef = doc(collection(db, "transactions"));
              const newTx: any = {
                  userId: selectedUserForAdjustment.uid,
                  email: selectedUserForAdjustment.email,
                  type: adjustmentType === 'add' ? 'deposit' : 'withdraw',
                  method: 'admin',
                  amount: amt,
                  status: 'approved',
                  timestamp: Date.now(),
                  reason: adjustmentReason || (adjustmentType === 'add' ? 'Admin Bonus' : 'Admin Correction')
              };
              
              transaction.set(newTxRef, newTx);
          });

          setIsAdjustmentModalOpen(false);
          alert("Balance adjusted successfully.");
      } catch (e: any) {
          console.error("Adjustment failed:", e);
          alert("Failed to adjust balance: " + e.message);
      } finally {
          setLoadingId(null);
      }
  };

  const handleToggleBlock = async (user: UserData) => {
    const newStatus = !user.isBlocked;
    const confirmMsg = newStatus 
      ? `Are you sure you want to BLOCK ${user.email}? They will be logged out immediately.` 
      : `Unblock ${user.email}?`;
    
    if(!window.confirm(confirmMsg)) return;

    setLoadingId(user.uid);
    try {
        await updateDoc(doc(db, "users", user.uid), {
            isBlocked: newStatus
        });
    } catch (e: any) {
        console.error("Block toggle failed:", e);
        alert("Error: " + e.message);
    } finally {
        setLoadingId(null);
    }
  };

  // --- Payment Method Handlers ---
  const handleToggleMethod = async (method: PaymentMethodConfig) => {
      setLoadingId(method.id);
      try {
          await updateDoc(doc(db, "payment_methods", method.id), {
              isEnabled: !method.isEnabled
          });
      } catch(e: any) {
          alert("Error: " + e.message);
      } finally {
          setLoadingId(null);
      }
  };

  const handleUpdateNumber = async (methodId: string, newNumber: string) => {
      setLoadingId(methodId);
      try {
          await updateDoc(doc(db, "payment_methods", methodId), {
              number: newNumber
          });
          alert("Number updated!");
      } catch(e: any) {
          alert("Error: " + e.message);
      } finally {
          setLoadingId(null);
      }
  };

  const handleAddMethod = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMethodName || !newMethodNumber) return;
      
      setLoadingId('new-method');
      try {
          const newMethod: Omit<PaymentMethodConfig, 'id'> = {
              name: newMethodName,
              number: newMethodNumber,
              isEnabled: true,
              type: 'mobile_banking'
          };
          await addDoc(collection(db, "payment_methods"), newMethod);
          setNewMethodName('');
          setNewMethodNumber('');
      } catch (e: any) {
          alert("Failed to add: " + e.message);
      } finally {
          setLoadingId(null);
      }
  };

  const handleDeleteMethod = async (id: string) => {
      if(!window.confirm("Delete this payment method?")) return;
      setLoadingId(id);
      try {
          await deleteDoc(doc(db, "payment_methods", id));
      } catch(e: any) {
          alert("Error: " + e.message);
      } finally {
          setLoadingId(null);
      }
  };

  // Derived State with Sorting
  const pendingTransactions = getSortedTransactions(transactions.filter(tx => tx.status === 'pending'));
  const historyTransactions = getSortedTransactions(transactions.filter(tx => tx.status !== 'pending'));
  const allFilteredTransactions = getSortedTransactions(transactions.filter(tx => {
      if (statusFilter === 'all') return true;
      return tx.status === statusFilter;
  }));

  const stats = {
    pendingDeposits: pendingTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0),
    pendingWithdrawals: pendingTransactions.filter(t => t.type === 'withdraw').reduce((sum, t) => sum + t.amount, 0),
    totalUsers: users.length,
    totalSystemBalance: users.reduce((sum, u) => sum + (u.realBalance || 0), 0)
  };

  const StatusBadge = ({ status }: { status: TransactionStatus }) => {
      if (status === 'approved') return (
          <span className="inline-flex items-center gap-1 text-[9px] font-black text-lime-500 bg-lime-500/10 px-2 py-0.5 rounded border border-lime-500/20 uppercase tracking-wider">
              <CheckCircle className="w-3 h-3" /> Approved
          </span>
      );
      if (status === 'pending') return (
          <span className="inline-flex items-center gap-1 text-[9px] font-black text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20 uppercase tracking-wider">
              <Clock className="w-3 h-3" /> Pending
          </span>
      );
      // Cancelled or Rejected
      return (
          <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-wider">
              <XCircle className="w-3 h-3" /> {status}
          </span>
      );
  };

  // Helper for Sortable Headers
  const SortableHeader = ({ label, column, align = 'left' }: { label: string, column: SortKey, align?: 'left' | 'center' | 'right' }) => (
    <th 
        className={`p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:text-white transition-colors select-none group/th text-${align}`}
        onClick={() => handleSort(column)}
    >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
            {label}
            {sortConfig.key === column ? (
                sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />
            ) : (
                <ArrowUpDown className="w-3 h-3 opacity-20 group-hover/th:opacity-50 transition-opacity" />
            )}
        </div>
    </th>
  );

  return (
    <div className="h-full w-full flex flex-col bg-[#0f172a] text-white overflow-hidden relative">
      
      {/* Rules/Permissions Error Banner */}
      {permissionError && (
          <div className="bg-red-500/10 border-b border-red-500/20 p-4 shrink-0 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-red-400">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <div>
                      <h3 className="text-sm font-black uppercase tracking-wider">Missing Permissions</h3>
                      <p className="text-xs opacity-90">
                          Database access was denied. Please copy the code from <code className="bg-red-900/50 px-1 rounded text-white">firestore.rules</code> and paste it into your Firebase Console {'>'} Firestore {'>'} Rules.
                      </p>
                  </div>
              </div>
          </div>
      )}

      {/* Top Bar Stats - Scrollable on mobile */}
      <div className="flex overflow-x-auto gap-4 p-4 md:p-6 shrink-0 bg-[#161922] border-b border-slate-700 no-scrollbar">
        <div className="min-w-[160px] bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Clock className="w-12 h-12 text-lime-400" />
            </div>
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Pending Deposits</div>
            <div className="text-2xl font-mono text-lime-400 font-bold">${stats.pendingDeposits.toLocaleString()}</div>
        </div>
        <div className="min-w-[160px] bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Clock className="w-12 h-12 text-red-400" />
            </div>
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Pending Withdrawals</div>
            <div className="text-2xl font-mono text-red-400 font-bold">${stats.pendingWithdrawals.toLocaleString()}</div>
        </div>
        <div className="min-w-[160px] bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users className="w-12 h-12 text-blue-400" />
            </div>
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total Users</div>
            <div className="text-2xl font-mono text-blue-400 font-bold">{stats.totalUsers}</div>
        </div>
        <div className="min-w-[160px] bg-[#1e293b] p-4 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden group">
            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                <Wallet className="w-12 h-12 text-white" />
            </div>
            <div className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Total System Funds</div>
            <div className="text-2xl font-mono text-white font-bold">${stats.totalSystemBalance.toLocaleString()}</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4 md:p-6 min-h-0">
        
        {/* View Tabs */}
        <div className="flex gap-4 mb-4 shrink-0 overflow-x-auto pb-2 no-scrollbar">
            <button
                onClick={() => setActiveTab('pending')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
                    ${activeTab === 'pending' 
                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                        : 'bg-[#1e293b] text-slate-400 hover:bg-[#2c364c]'
                    }
                `}
            >
                <Clock className="w-4 h-4" />
                Pending ({pendingTransactions.length})
            </button>
            <button
                onClick={() => setActiveTab('all')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
                    ${activeTab === 'all' 
                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                        : 'bg-[#1e293b] text-slate-400 hover:bg-[#2c364c]'
                    }
                `}
            >
                <List className="w-4 h-4" />
                All Transactions
            </button>
            <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
                    ${activeTab === 'history' 
                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                        : 'bg-[#1e293b] text-slate-400 hover:bg-[#2c364c]'
                    }
                `}
            >
                <Archive className="w-4 h-4" />
                History
            </button>
            <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
                    ${activeTab === 'users' 
                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                        : 'bg-[#1e293b] text-slate-400 hover:bg-[#2c364c]'
                    }
                `}
            >
                <Users className="w-4 h-4" />
                Users
            </button>
            <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap
                    ${activeTab === 'settings' 
                        ? 'bg-blue-600 text-white shadow-lg scale-105' 
                        : 'bg-[#1e293b] text-slate-400 hover:bg-[#2c364c]'
                    }
                `}
            >
                <Settings className="w-4 h-4" />
                Settings
            </button>
        </div>

        {activeTab === 'settings' && (
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Active Methods List */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 shadow-xl">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Banknote className="w-5 h-5 text-lime-400" />
                            Active Payment Methods
                        </h3>
                        
                        <div className="space-y-4">
                            {paymentMethods.length === 0 && (
                                <p className="text-slate-500 text-sm">No payment methods configured. Add one below.</p>
                            )}
                            
                            {paymentMethods.map(method => (
                                <PaymentMethodCard 
                                    key={method.id} 
                                    method={method} 
                                    onToggle={handleToggleMethod}
                                    onDelete={handleDeleteMethod}
                                    onUpdateNumber={handleUpdateNumber}
                                    loadingId={loadingId}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Add New Method */}
                    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 shadow-xl h-fit">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <PlusCircle className="w-5 h-5 text-blue-400" />
                            Add New Method
                        </h3>
                        
                        <form onSubmit={handleAddMethod} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Method Name</label>
                                <input 
                                    type="text" 
                                    value={newMethodName}
                                    onChange={(e) => setNewMethodName(e.target.value)}
                                    placeholder="e.g. Rocket, Upay, Bank Asia"
                                    required
                                    className="w-full bg-[#0f1522] border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Deposit Number / Account Info</label>
                                <input 
                                    type="text" 
                                    value={newMethodNumber}
                                    onChange={(e) => setNewMethodNumber(e.target.value)}
                                    placeholder="e.g. 01700000000"
                                    required
                                    className="w-full bg-[#0f1522] border border-slate-700 rounded-xl p-3 text-white font-mono focus:border-blue-500 outline-none"
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={loadingId === 'new-method'}
                                className="w-full py-3 mt-2 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                <PlusCircle className="w-4 h-4" /> Add Method
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'pending' && (
            <div className="flex-1 flex flex-col bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                 <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                       <thead className="bg-[#1a1d29] sticky top-0 z-20 shadow-md">
                          <tr>
                             <SortableHeader label="Time" column="timestamp" />
                             <SortableHeader label="Type" column="type" />
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                             <SortableHeader label="Amount" column="amount" align="right" />
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Details</th>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-700/50">
                          {pendingTransactions.length === 0 ? (
                              <tr>
                                  <td colSpan={6} className="p-12 text-center text-slate-500 font-bold uppercase text-xs">No pending requests</td>
                              </tr>
                          ) : (
                              pendingTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-[#252f45] transition-colors group">
                                   <td className="p-4 text-xs font-medium text-slate-400 whitespace-nowrap font-mono">
                                      {new Date(tx.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                   </td>
                                   <td className="p-4">
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border
                                         ${tx.type === 'deposit' ? 'bg-lime-500/10 text-lime-400 border-lime-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}
                                      `}>
                                         {tx.type === 'deposit' ? <Clock className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                                         {tx.type}
                                      </span>
                                   </td>
                                   <td className="p-4 text-xs text-slate-300">
                                      <div className="font-bold text-white">{tx.email || 'Unknown'}</div>
                                      <div className="font-mono text-[9px] text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity">{tx.userId}</div>
                                   </td>
                                   <td className="p-4 text-right font-mono text-sm font-bold text-white">
                                      ${tx.amount.toLocaleString()}
                                   </td>
                                   <td className="p-4 text-xs text-slate-400">
                                      <div className="flex flex-col gap-0.5">
                                         <span className="uppercase font-bold text-slate-500 text-[9px]">{tx.method}</span>
                                         {tx.trxId && <span className="font-mono text-blue-300 select-all bg-blue-500/10 px-1 rounded w-fit">TRX: {tx.trxId}</span>}
                                         {tx.senderNumber && <span className="font-mono text-slate-400 select-all">From: {tx.senderNumber}</span>}
                                         {tx.receiverNumber && <span className="font-mono text-slate-400 select-all">To: {tx.receiverNumber}</span>}
                                      </div>
                                   </td>
                                   <td className="p-4 text-right">
                                       <div className="flex justify-end gap-2 relative z-10">
                                          <button 
                                             onClick={(e) => handleApprove(e, tx)}
                                             disabled={loadingId === tx.id}
                                             className="flex items-center gap-1 px-3 py-1.5 rounded bg-lime-500/20 hover:bg-lime-500/40 text-lime-400 transition-colors border border-lime-500/30 disabled:opacity-50 cursor-pointer active:scale-95 text-[10px] font-bold uppercase"
                                             title="Approve"
                                          >
                                             <CheckCircle className="w-3 h-3" /> Approve
                                          </button>
                                          <button 
                                             onClick={(e) => handleCancel(e, tx)}
                                             disabled={loadingId === tx.id}
                                             className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors border border-red-500/30 disabled:opacity-50 cursor-pointer active:scale-95 text-[10px] font-bold uppercase"
                                             title="Cancel"
                                          >
                                             <XCircle className="w-3 h-3" /> Cancel
                                          </button>
                                       </div>
                                   </td>
                                </tr>
                              ))
                          )}
                       </tbody>
                    </table>
                 </div>
            </div>
        )}

        {activeTab === 'all' && (
            <div className="flex-1 flex flex-col bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                 {/* Filter Bar */}
                 <div className="p-2 bg-[#1a1d29] border-b border-slate-700 flex flex-wrap gap-2">
                    {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map(status => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all
                                ${statusFilter === status 
                                    ? 'bg-blue-500 text-white shadow' 
                                    : 'bg-[#0f1522] text-slate-400 hover:text-white hover:bg-[#1e2535]'
                                }
                            `}
                        >
                            {status}
                        </button>
                    ))}
                 </div>

                 <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                       <thead className="bg-[#1a1d29] sticky top-0 z-20 shadow-md">
                          <tr>
                             <SortableHeader label="Time" column="timestamp" />
                             <SortableHeader label="Type" column="type" />
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                             <SortableHeader label="Amount" column="amount" align="right" />
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-700/50">
                          {allFilteredTransactions.length === 0 ? (
                              <tr>
                                  <td colSpan={6} className="p-12 text-center text-slate-500 font-bold uppercase text-xs">No transactions match filter</td>
                              </tr>
                          ) : (
                            allFilteredTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-[#252f45] transition-colors group">
                                   <td className="p-4 text-xs font-medium text-slate-400 whitespace-nowrap font-mono">
                                      {new Date(tx.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                   </td>
                                   <td className="p-4">
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border
                                         ${tx.type === 'deposit' ? 'bg-lime-500/10 text-lime-400 border-lime-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}
                                      `}>
                                         {tx.type === 'deposit' ? <Clock className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                                         {tx.type}
                                      </span>
                                   </td>
                                   <td className="p-4 text-xs text-slate-300">
                                      <div className="font-bold text-white">{tx.email || 'Unknown'}</div>
                                      <div className="font-mono text-[9px] text-slate-500 opacity-50 group-hover:opacity-100 transition-opacity">{tx.userId}</div>
                                   </td>
                                   <td className="p-4 text-right font-mono text-sm font-bold text-white">
                                      ${tx.amount.toLocaleString()}
                                   </td>
                                   <td className="p-4 text-center">
                                      {/* Editable Status Dropdown */}
                                      <div className="relative inline-block w-28 group/select">
                                          <select 
                                              value={tx.status}
                                              onChange={(e) => handleStatusChange(e.target.value as TransactionStatus, tx)}
                                              disabled={loadingId === tx.id}
                                              className={`
                                                  w-full appearance-none text-[9px] font-black uppercase tracking-wider py-1.5 pl-2 pr-6 rounded border cursor-pointer outline-none focus:ring-1 focus:ring-blue-500/50 transition-all
                                                  ${tx.status === 'approved' ? 'bg-lime-500/10 text-lime-400 border-lime-500/30 hover:bg-lime-500/20' :
                                                    tx.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30 hover:bg-yellow-500/20' :
                                                    'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'}
                                                  disabled:opacity-50 disabled:cursor-not-allowed
                                              `}
                                          >
                                              <option className="bg-[#1e293b] text-yellow-500" value="pending">Pending</option>
                                              <option className="bg-[#1e293b] text-lime-400" value="approved">Approved</option>
                                              <option className="bg-[#1e293b] text-red-400" value="cancelled">Cancelled</option>
                                              <option className="bg-[#1e293b] text-red-400" value="rejected">Rejected</option>
                                          </select>
                                          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover/select:opacity-100 transition-opacity">
                                              <ChevronDown className={`w-3 h-3 ${tx.status === 'approved' ? 'text-lime-400' : tx.status === 'pending' ? 'text-yellow-500' : 'text-red-400'}`} />
                                          </div>
                                      </div>
                                   </td>
                                   <td className="p-4 text-right">
                                       <div className="flex justify-end gap-2 relative z-10">
                                            <button 
                                                onClick={(e) => handleDelete(e, tx.id)}
                                                disabled={loadingId === tx.id}
                                                className="p-2 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                                title="Delete Record"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                       </div>
                                   </td>
                                </tr>
                              ))
                          )}
                       </tbody>
                    </table>
                 </div>
            </div>
        )}

        {activeTab === 'history' && (
            <div className="flex-1 flex flex-col bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                 <div className="flex-1 overflow-auto custom-scrollbar relative">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                       <thead className="bg-[#1a1d29] sticky top-0 z-20 shadow-md">
                          <tr>
                             <SortableHeader label="Time" column="timestamp" />
                             <SortableHeader label="Type" column="type" />
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                             <SortableHeader label="Amount" column="amount" align="right" />
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-700/50">
                          {historyTransactions.length === 0 ? (
                              <tr>
                                  <td colSpan={6} className="p-12 text-center text-slate-500 font-bold uppercase text-xs">No history found</td>
                              </tr>
                          ) : (
                              historyTransactions.map(tx => (
                                <tr key={tx.id} className="hover:bg-[#252f45] transition-colors group">
                                   <td className="p-4 text-xs font-medium text-slate-400 whitespace-nowrap font-mono">
                                      {new Date(tx.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                   </td>
                                   <td className="p-4">
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-black uppercase tracking-wider border
                                         ${tx.type === 'deposit' ? 'bg-lime-500/10 text-lime-400 border-lime-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}
                                      `}>
                                         {tx.type === 'deposit' ? <Clock className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
                                         {tx.type}
                                      </span>
                                   </td>
                                   <td className="p-4 text-xs text-slate-300">
                                      <div className="font-bold text-white">{tx.email || 'Unknown'}</div>
                                   </td>
                                   <td className="p-4 text-right font-mono text-sm font-bold text-white">
                                      ${tx.amount.toLocaleString()}
                                   </td>
                                   <td className="p-4 text-center">
                                      <StatusBadge status={tx.status} />
                                   </td>
                                   <td className="p-4 text-right">
                                       <button 
                                          onClick={(e) => handleDelete(e, tx.id)}
                                          disabled={loadingId === tx.id}
                                          className="p-2 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"
                                          title="Delete Record"
                                       >
                                          <Trash2 className="w-4 h-4" />
                                       </button>
                                   </td>
                                </tr>
                              ))
                          )}
                       </tbody>
                    </table>
                 </div>
            </div>
        )}

        {activeTab === 'users' && (
            <div className="flex-1 flex flex-col bg-[#1e293b] rounded-2xl border border-slate-700 overflow-hidden shadow-2xl">
                 <div className="flex-1 overflow-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead className="bg-[#1a1d29] sticky top-0 z-20 shadow-md">
                          <tr>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">User</th>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Real Balance</th>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Demo Balance</th>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Joined</th>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status</th>
                             <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                            {users.map(u => (
                                <tr key={u.uid} className={`hover:bg-[#252f45] transition-colors ${u.isBlocked ? 'bg-red-500/5' : ''}`}>
                                    <td className="p-4">
                                        <div className="flex flex-col">
                                            <span className={`font-bold text-sm ${u.isBlocked ? 'text-red-300 decoration-red-500 line-through' : 'text-white'}`}>{u.email}</span>
                                            <span className="font-mono text-[10px] text-slate-500 select-all">{u.uid}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className={`font-mono font-bold ${(u.realBalance || 0) > 0 ? 'text-lime-400' : 'text-slate-500'}`}>
                                            ${(u.realBalance || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="font-mono font-bold text-blue-400">
                                            ${(u.demoBalance || 0).toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right text-xs text-slate-400 font-mono">
                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className="p-4 text-center">
                                        {u.isBlocked ? (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30 uppercase tracking-wider">
                                                <Lock className="w-3 h-3" /> Blocked
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-lime-400 bg-lime-500/20 px-2 py-0.5 rounded border border-lime-500/30 uppercase tracking-wider">
                                                <CheckCircle className="w-3 h-3" /> Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button 
                                                onClick={() => handleToggleBlock(u)}
                                                disabled={loadingId === u.uid}
                                                className={`px-3 py-1.5 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors
                                                    ${u.isBlocked 
                                                        ? 'bg-lime-500/20 hover:bg-lime-500/40 text-lime-400 border-lime-500/30' 
                                                        : 'bg-red-500/20 hover:bg-red-500/40 text-red-400 border-red-500/30'
                                                    }
                                                `}
                                            >
                                                {u.isBlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                {u.isBlocked ? 'Unblock' : 'Block'}
                                            </button>
                                            <button 
                                                onClick={() => openAdjustmentModal(u)}
                                                className="px-3 py-1.5 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                                            >
                                                <Edit2 className="w-3 h-3" /> Adjust
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </div>
        )}

        {/* Balance Adjustment Modal */}
        {isAdjustmentModalOpen && selectedUserForAdjustment && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                <div className="bg-[#1e2535] border border-slate-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-slate-700 bg-[#1a1d29] flex justify-between items-center">
                        <div className="flex items-center gap-2">
                             <Wallet className="w-4 h-4 text-lime-400" />
                             <span className="font-bold text-white text-sm">Adjust Balance</span>
                        </div>
                        <button onClick={() => setIsAdjustmentModalOpen(false)} className="text-slate-500 hover:text-white">
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <form onSubmit={submitAdjustment} className="p-4 flex flex-col gap-4">
                        <div className="text-xs text-slate-400">
                            Adjusting real balance for <span className="text-white font-bold">{selectedUserForAdjustment.email}</span>
                        </div>

                        {/* Toggle Type */}
                        <div className="grid grid-cols-2 gap-2 bg-[#0f1522] p-1 rounded-xl border border-slate-700">
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('add')}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all
                                    ${adjustmentType === 'add' 
                                        ? 'bg-lime-500 text-[#0f1522] shadow-lg' 
                                        : 'text-slate-500 hover:text-white'
                                    }
                                `}
                            >
                                <PlusCircle className="w-3 h-3" /> Add
                            </button>
                            <button
                                type="button"
                                onClick={() => setAdjustmentType('deduct')}
                                className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all
                                    ${adjustmentType === 'deduct' 
                                        ? 'bg-red-500 text-white shadow-lg' 
                                        : 'text-slate-500 hover:text-white'
                                    }
                                `}
                            >
                                <MinusCircle className="w-3 h-3" /> Deduct
                            </button>
                        </div>

                        {/* Amount */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Amount</label>
                            <input 
                                type="number" 
                                value={adjustmentAmount}
                                onChange={(e) => setAdjustmentAmount(e.target.value)}
                                placeholder="0.00"
                                min="1"
                                required
                                className="w-full bg-[#0f1522] border border-slate-700 rounded-xl p-3 text-white font-mono font-bold focus:border-blue-500 outline-none"
                            />
                        </div>

                         {/* Reason */}
                         <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Reason (Optional)</label>
                            <input 
                                type="text" 
                                value={adjustmentReason}
                                onChange={(e) => setAdjustmentReason(e.target.value)}
                                placeholder={adjustmentType === 'add' ? "e.g. Bonus, Refund" : "e.g. Correction, Penalty"}
                                className="w-full bg-[#0f1522] border border-slate-700 rounded-xl p-3 text-white font-medium text-xs focus:border-blue-500 outline-none"
                            />
                        </div>

                        <button 
                            type="submit"
                            disabled={loadingId === 'adjustment'}
                            className="mt-2 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loadingId === 'adjustment' ? 'Processing...' : (
                                <>
                                    <Save className="w-4 h-4" /> Confirm
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;