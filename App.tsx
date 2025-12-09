
import React, { useState, useEffect, useCallback } from 'react';
import HistoryPanel from './components/HistoryPanel';
import Controls from './components/Controls';
import PlinkoBoard from './components/PlinkoBoard';
import AnimatedBackground from './components/AnimatedBackground';
import WalletModal from './components/WalletModal';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import { RiskLevel, BetRecord, GameMode } from './types';
import { getMultipliers } from './constants';
import { User, ShieldCheck, LogOut, Wallet, RotateCcw, Shield } from 'lucide-react';
import { soundManager } from './utils/SoundManager';
import { auth, db } from './firebase'; 
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore'; 

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App View Mode
  const [viewMode, setViewMode] = useState<'game' | 'admin'>('game');

  // Game Settings
  const [gameMode, setGameMode] = useState<GameMode>('demo');
  const [betAmount, setBetAmount] = useState<number>(100);
  const [rows, setRows] = useState<number>(16);
  const [risk, setRisk] = useState<RiskLevel>('medium');
  
  // Balances
  const [demoBalance, setDemoBalance] = useState<number>(0);
  const [realBalance, setRealBalance] = useState<number>(0);
  
  // Game State
  const [history, setHistory] = useState<BetRecord[]>([]);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [lastDropTime, setLastDropTime] = useState<number>(0);
  const [lastWin, setLastWin] = useState<{ multiplier: number; timestamp: number } | null>(null);
  const [ballDropData, setBallDropData] = useState<{ id: string; amount: number } | null>(null);
  const [currentMultipliers, setCurrentMultipliers] = useState(getMultipliers(rows, risk));

  // Computed Balance based on active mode
  const currentBalance = gameMode === 'demo' ? demoBalance : realBalance;

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Real-time Balance Subscription (Dual Balance)
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    
    // This listener handles ALL real-time updates (game wins, wallet deposits, etc.)
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDemoBalance(data.demoBalance ?? 1000);
        setRealBalance(data.realBalance ?? 0);
      } else {
        // Create user document with separate balances if it doesn't exist
        setDoc(userRef, { 
            email: user.email,
            demoBalance: 1000,
            realBalance: 0,
            createdAt: Date.now()
        }, { merge: true });
        setDemoBalance(1000);
        setRealBalance(0);
      }
    }, (error) => {
        console.error("Error listening to balance:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync multipliers on config change
  useEffect(() => {
    setCurrentMultipliers(getMultipliers(rows, risk));
  }, [rows, risk]);

  // Handle Play Logic
  const handlePlay = useCallback(async () => {
    if (currentBalance >= betAmount && user) {
        await soundManager.ensureContext();
        
        // Optimistic update locally
        if (gameMode === 'demo') {
            setDemoBalance(prev => prev - betAmount);
        } else {
            setRealBalance(prev => prev - betAmount);
        }

        // Firestore update
        const userRef = doc(db, 'users', user.uid);
        const fieldToUpdate = gameMode === 'demo' ? 'demoBalance' : 'realBalance';
        
        try {
            await updateDoc(userRef, { [fieldToUpdate]: increment(-betAmount) });
            
            // Trigger visuals
            const now = Date.now();
            setLastDropTime(now);
            setBallDropData({ id: crypto.randomUUID(), amount: betAmount });
            soundManager.playDrop();
        } catch (e) {
            console.error("Failed to place bet:", e);
        }
    }
  }, [currentBalance, betAmount, user, gameMode]);

  // Handle Land Logic
  const handleLand = useCallback(async (index: number, multiplier: number, amountBet: number) => {
    const payout = amountBet * multiplier;
    // const profit = payout - amountBet; // unused
    const now = Date.now();

    const newRecord: BetRecord = {
        id: crypto.randomUUID(),
        amount: amountBet,
        multiplier,
        payout,
        timestamp: now,
        profit: payout - amountBet
    };

    setHistory(prev => [newRecord, ...prev].slice(0, 50)); 
    setLastWin({ multiplier, timestamp: now });
    
    if (user && payout > 0) {
        const userRef = doc(db, 'users', user.uid);
        const fieldToUpdate = gameMode === 'demo' ? 'demoBalance' : 'realBalance';
        
        try {
            await updateDoc(userRef, { [fieldToUpdate]: increment(payout) });
        } catch (e) {
            console.error("Failed to update payout:", e);
        }
    }
    
    soundManager.playWin(multiplier);
  }, [user, gameMode]);

  const handleResetDemoBalance = async () => {
      if (!user || gameMode !== 'demo') return;
      const userRef = doc(db, 'users', user.uid);
      try {
          // Reset to default 1000
          await updateDoc(userRef, { demoBalance: 1000 });
          // Optimistic local update
          setDemoBalance(1000);
      } catch (e) {
          console.error("Failed to reset demo balance:", e);
      }
  };

  const handleLogout = async () => {
      await signOut(auth);
  };

  if (authLoading) {
      return (
          <div className="h-screen w-screen bg-[#0f172a] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
      );
  }

  if (!user) {
      return <LoginPage />;
  }

  // Admin Check with specific UID
  const ADMIN_UID = "6nANvmBRHZQV07CkbGc8lCo44jJ2";
  const isAdmin = user.uid === ADMIN_UID;

  // If in Admin Mode, Render Admin Dashboard
  if (viewMode === 'admin' && isAdmin) {
      return (
          <div className="h-screen w-screen bg-[#0f172a] flex flex-col">
              <nav className="h-14 bg-[#1a1d29] flex items-center justify-between px-6 border-b border-slate-700 shrink-0">
                  <div className="flex items-center gap-3">
                      <span className="text-xl font-black italic text-white tracking-tighter">
                          <span className="text-lime-400">PLINKO</span> ADMIN
                      </span>
                  </div>
                  <button 
                    onClick={() => setViewMode('game')}
                    className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors bg-[#1e2535] px-3 py-1.5 rounded-lg border border-slate-700"
                  >
                      Back to Game
                  </button>
              </nav>
              <AdminDashboard />
          </div>
      );
  }

  return (
    <div className="h-screen w-screen bg-[#1a1d29] text-white flex flex-col font-sans overflow-hidden relative selection:bg-lime-500/30">
      
      {/* Wallet Modal - Always passes Real Balance for display */}
      <WalletModal 
        isOpen={isWalletOpen} 
        onClose={() => setIsWalletOpen(false)} 
        userId={user.uid}
        userEmail={user.email}
        balance={realBalance}
        gameMode={gameMode}
        isAdmin={isAdmin}
      />

      <AnimatedBackground lastDropTime={lastDropTime} lastWin={lastWin} />

      {/* Navbar */}
      <nav className="h-14 bg-[#1a1d29]/90 backdrop-blur-md flex items-center justify-between px-4 md:px-6 border-b border-slate-700/50 shadow-lg relative z-50 shrink-0">
         <div className="flex items-center gap-4">
             <div className="text-xl font-black italic tracking-tighter text-white select-none cursor-pointer hidden md:block">
                 <span className="text-lime-400 drop-shadow-[0_0_8px_rgba(132,204,22,0.5)]">PLINKO</span>
             </div>
             
             {/* Game Mode Toggle */}
             <div className="flex bg-[#0f1522] rounded-lg p-1 border border-slate-700/50">
                 <button
                    onClick={() => setGameMode('real')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all
                        ${gameMode === 'real' ? 'bg-lime-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}
                    `}
                 >
                    Real
                 </button>
                 <button
                    onClick={() => setGameMode('demo')}
                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all
                        ${gameMode === 'demo' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}
                    `}
                 >
                    Demo
                 </button>
             </div>
         </div>

         <div className="flex items-center gap-3">
             {/* Admin Toggle Button */}
             {isAdmin && (
                <button 
                    onClick={() => setViewMode('admin')}
                    className="flex items-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all mr-2"
                >
                    <Shield className="w-3 h-3" />
                    Admin
                </button>
             )}

             {/* Balance Display */}
             <div className={`flex items-center gap-3 px-3 py-1 rounded-full border shadow-inner transition-colors duration-300
                ${gameMode === 'demo' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-[#0f1522] border-lime-500/20'}
             `}>
                <span className={`text-[10px] font-bold uppercase tracking-wider
                    ${gameMode === 'demo' ? 'text-blue-400' : 'text-slate-400'}
                `}>
                    {gameMode === 'demo' ? 'Demo' : 'Balance'}
                </span>
                <span className={`font-mono font-bold text-sm md:text-base tracking-tight
                    ${gameMode === 'demo' ? 'text-blue-400' : 'text-lime-400'}
                `}>
                    ${currentBalance.toFixed(2)}
                </span>
                
                {/* Reset Demo Balance Button */}
                {gameMode === 'demo' && (
                    <button 
                        onClick={handleResetDemoBalance}
                        className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
                        title="Reset Demo Balance"
                    >
                        <RotateCcw className="w-3 h-3" />
                    </button>
                )}
                
                {/* Wallet Button */}
                <button 
                    onClick={() => setIsWalletOpen(true)}
                    className="bg-[#3b82f6] hover:bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg transition-colors ml-1 flex items-center gap-1"
                >
                    <Wallet className="w-3 h-3" />
                    <span className="hidden sm:inline">Wallet</span>
                </button>
             </div>
             
             <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
                <div className="hidden md:flex flex-col items-end mr-1">
                    <span className="text-[10px] font-bold text-slate-300 leading-tight">{user.email?.split('@')[0]}</span>
                    <span className="text-[8px] font-bold text-slate-500 uppercase leading-tight">Player</span>
                </div>
                <button onClick={handleLogout} className="w-8 h-8 rounded-lg bg-[#2c364c] hover:bg-red-500/20 hover:text-red-400 text-slate-400 flex items-center justify-center transition-all group">
                    <LogOut className="w-4 h-4" />
                </button>
             </div>
         </div>
      </nav>

      {/* Main Layout */}
      <div className="relative z-10 flex-1 flex w-full h-[calc(100vh-56px)] overflow-hidden">
        
        {/* Left Sidebar */}
        <div className="hidden xl:flex w-64 shrink-0 flex-col p-3 gap-3 border-r border-slate-800/50 bg-[#161922]/50 backdrop-blur-sm">
             <HistoryPanel history={history} />
        </div>

        {/* Center Game */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f1522]/30">
            <div className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-4">
                 <div className={`absolute inset-0 bg-radial-gradient to-transparent opacity-50 pointer-events-none transition-colors duration-500
                    ${gameMode === 'demo' ? 'from-blue-900/10' : 'from-lime-900/10'}
                 `}></div>
                 
                 <div className="relative w-full h-full max-w-4xl mx-auto flex flex-col">
                    <div className="flex-1 relative min-h-0">
                         <PlinkoBoard 
                            rows={rows} 
                            multipliers={currentMultipliers} 
                            onLand={handleLand}
                            ballDropData={ballDropData}
                        />
                    </div>
                 </div>
            </div>

            <div className="shrink-0 p-3 sm:p-4 border-t border-slate-800/50 bg-[#161922]/80 backdrop-blur-md">
                <div className="max-w-4xl mx-auto">
                    <Controls 
                        balance={currentBalance}
                        betAmount={betAmount}
                        setBetAmount={setBetAmount}
                        risk={risk}
                        setRisk={setRisk}
                        rows={rows}
                        setRows={setRows}
                        onPlay={handlePlay}
                        canPlay={true} 
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;
