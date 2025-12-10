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
import { User, ShieldCheck, LogOut, Wallet, RotateCcw, Shield, History as HistoryIcon, X, Menu, CreditCard, Copy } from 'lucide-react';
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
  const [rows, setRows] = useState<number>(10);
  const [risk, setRisk] = useState<RiskLevel>('medium');
  
  // Balances
  const [demoBalance, setDemoBalance] = useState<number>(0);
  const [realBalance, setRealBalance] = useState<number>(0);
  
  // Game State
  const [history, setHistory] = useState<BetRecord[]>([]);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [lastDropTime, setLastDropTime] = useState<number>(0);
  const [lastWin, setLastWin] = useState<{ multiplier: number; timestamp: number } | null>(null);
  const [ballDropData, setBallDropData] = useState<{ id: string; amount: number } | null>(null);
  const [currentMultipliers, setCurrentMultipliers] = useState(getMultipliers(rows, risk));

  // Computed Balance based on active mode
  const currentBalance = gameMode === 'demo' ? demoBalance : realBalance;

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // If user exists, reload to get the latest user data
      if (currentUser) {
         try {
             await currentUser.reload();
         } catch (e) {
             console.log("Auto-reload error", e);
         }
      }
      setUser(currentUser ? { ...currentUser } as FirebaseUser : null);
      setAuthLoading(false);
      
      if (currentUser) {
          console.log("--------------------------------------------------");
          console.log("Logged in as:", currentUser.email);
          console.log("YOUR CURRENT UID:", currentUser.uid);
          console.log("Copy this UID to the ADMIN_UID constant in App.tsx to enable Admin Dashboard.");
          console.log("--------------------------------------------------");
      }
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
        
        // Block Logic Enforcement
        if (data.isBlocked) {
            alert("Your account has been suspended by the administrator.");
            signOut(auth);
            return;
        }

        setDemoBalance(data.demoBalance ?? 1000);
        setRealBalance(data.realBalance ?? 0);
      } else {
        // Create user document with separate balances if it doesn't exist
        setDoc(userRef, { 
            email: user.email,
            demoBalance: 1000,
            realBalance: 0,
            createdAt: Date.now(),
            isBlocked: false
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
          <div className="h-[100dvh] w-screen bg-[#0f172a] flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
      );
  }

  // Check if User is Logged In
  if (!user) {
      return <LoginPage currentUser={user} />;
  }

  // Admin Check with specific UID
  // IMPORTANT: Update this UID with your own (Check browser console after login)
  // ALSO IMPORTANT: Update the 'isAdmin' function in firestore.rules with this same UID!
  const ADMIN_UID = "6nANvmBRHZQV07CkbGc8lCo44jJ2";
  const isAdmin = user.uid === ADMIN_UID;

  // If in Admin Mode, Render Admin Dashboard
  if (viewMode === 'admin' && isAdmin) {
      return (
          <div className="h-[100dvh] w-screen bg-[#0f172a] flex flex-col pt-safe">
              <nav className="h-14 bg-[#1a1d29] flex items-center justify-between px-4 md:px-6 border-b border-slate-700 shrink-0 z-50">
                  <div className="flex items-center gap-3">
                      <span className="text-lg md:text-xl font-black italic text-white tracking-tighter">
                          <span className="text-lime-400">PLINKO</span> ADMIN
                      </span>
                  </div>
                  <button 
                    onClick={() => setViewMode('game')}
                    className="flex items-center gap-2 text-xs md:text-sm font-bold text-slate-400 hover:text-white transition-colors bg-[#1e2535] px-3 py-1.5 rounded-lg border border-slate-700"
                  >
                      Back to Game
                  </button>
              </nav>
              <AdminDashboard />
          </div>
      );
  }

  return (
    <div className="h-[100dvh] w-screen bg-[#1a1d29] text-white flex flex-col font-sans overflow-hidden relative selection:bg-lime-500/30 pt-safe">
      
      {/* Wallet Modal */}
      <WalletModal 
        isOpen={isWalletOpen} 
        onClose={() => setIsWalletOpen(false)} 
        userId={user.uid}
        userEmail={user.email}
        balance={realBalance}
        gameMode={gameMode}
        isAdmin={isAdmin}
      />

      {/* Mobile History Drawer */}
      <div 
        className={`fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm transition-opacity duration-300 xl:hidden ${showMobileHistory ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setShowMobileHistory(false)}
      >
        <div 
            className={`absolute right-0 top-0 bottom-0 w-[280px] bg-[#161922] border-l border-slate-700 shadow-2xl transition-transform duration-300 transform pt-safe ${showMobileHistory ? 'translate-x-0' : 'translate-x-full'}`}
            onClick={e => e.stopPropagation()}
        >
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700/50 bg-[#1a1d29]">
                <span className="font-black text-slate-300 uppercase tracking-widest text-sm">Bet History</span>
                <button 
                    onClick={() => setShowMobileHistory(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f1522] text-slate-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="h-[calc(100%-56px)] p-2">
                <HistoryPanel history={history} />
            </div>
        </div>
      </div>

      <AnimatedBackground lastDropTime={lastDropTime} lastWin={lastWin} />

      {/* Navbar */}
      <nav className="h-14 sm:h-16 bg-[#1a1d29]/90 backdrop-blur-md flex items-center justify-between px-3 md:px-6 border-b border-slate-700/50 shadow-lg relative z-50 shrink-0">
         <div className="flex items-center gap-2 md:gap-4">
             {/* Logo - Compact on mobile */}
             <div className="text-base sm:text-xl font-black italic tracking-tighter text-white select-none flex items-center gap-1">
                 <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-lime-500 flex items-center justify-center shadow-[0_0_10px_#84cc16]">
                    <span className="text-[10px] sm:text-xs text-black">P</span>
                 </div>
                 <span className="hidden sm:inline text-lime-400 drop-shadow-[0_0_8px_rgba(132,204,22,0.5)]">PLINKO</span>
             </div>
             
             {/* Mobile: History Toggle */}
             <button 
                onClick={() => setShowMobileHistory(true)}
                className="xl:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f1522] border border-slate-700/50 text-slate-400 hover:text-white hover:bg-[#1e2535] transition-colors"
             >
                 <HistoryIcon className="w-4 h-4" />
             </button>

             {/* Game Mode Toggle */}
             <div className="flex bg-[#0f1522] rounded-lg p-0.5 border border-slate-700/50">
                 <button
                    onClick={() => setGameMode('real')}
                    className={`px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all
                        ${gameMode === 'real' ? 'bg-lime-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}
                    `}
                 >
                    Real
                 </button>
                 <button
                    onClick={() => setGameMode('demo')}
                    className={`px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all
                        ${gameMode === 'demo' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}
                    `}
                 >
                    Demo
                 </button>
             </div>
         </div>

         <div className="flex items-center gap-2 md:gap-3">
             {/* Admin Toggle Button - Visible on Mobile now as Icon */}
             {isAdmin && (
                <button 
                    onClick={() => setViewMode('admin')}
                    className="flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-lg sm:rounded-md transition-all group"
                    title="Admin Dashboard"
                >
                    <Shield className="w-4 h-4 sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">Admin</span>
                </button>
             )}

             {/* Balance Display */}
             <div className={`flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3 py-1 rounded-lg border shadow-inner transition-colors duration-300
                ${gameMode === 'demo' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-[#0f1522] border-lime-500/20'}
             `}>
                <span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-wider
                    ${gameMode === 'demo' ? 'text-blue-400' : 'text-slate-400'}
                `}>
                    {gameMode === 'demo' ? 'Demo' : 'Bal:'}
                </span>
                <span className={`font-mono font-bold text-xs sm:text-base tracking-tight
                    ${gameMode === 'demo' ? 'text-blue-400' : 'text-lime-400'}
                `}>
                    ${currentBalance.toFixed(2)}
                </span>
                
                {/* Reset Demo Balance */}
                {gameMode === 'demo' && (
                    <button 
                        onClick={handleResetDemoBalance}
                        className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 transition-colors"
                    >
                        <RotateCcw className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                )}
                
                {/* Wallet Button */}
                <button 
                    onClick={() => setIsWalletOpen(true)}
                    className="bg-[#3b82f6] hover:bg-blue-600 text-white w-6 h-6 sm:w-auto sm:px-2 sm:py-1 rounded flex items-center justify-center gap-1 shadow-lg transition-colors ml-1"
                >
                    <Wallet className="w-3 h-3" />
                    <span className="hidden sm:inline text-[10px] font-bold">Wallet</span>
                </button>
             </div>
             
             {/* Logout */}
             <button onClick={handleLogout} className="w-8 h-8 rounded-lg bg-[#2c364c] hover:bg-red-500/20 hover:text-red-400 text-slate-400 flex items-center justify-center transition-all">
                <LogOut className="w-4 h-4" />
             </button>
         </div>
      </nav>

      {/* Main Layout */}
      <div className="relative z-10 flex-1 flex w-full h-[calc(100dvh-56px)] overflow-hidden">
        
        {/* Left Sidebar (Desktop only) */}
        <div className="hidden xl:flex w-72 shrink-0 flex-col p-4 gap-4 border-r border-slate-800/50 bg-[#161922]/50 backdrop-blur-sm">
             <div className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <HistoryIcon className="w-3 h-3" /> Recent Bets
             </div>
             <HistoryPanel history={history} />
        </div>

        {/* Center Game */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f1522]/30 relative">
            {/* Game Board Area - Reduced padding for Mobile */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center p-0 sm:p-4 pb-0">
                 {/* Radial Gradient for visual depth */}
                 <div className={`absolute inset-0 bg-radial-gradient to-transparent opacity-50 pointer-events-none transition-colors duration-500
                    ${gameMode === 'demo' ? 'from-blue-900/10' : 'from-lime-900/10'}
                 `}></div>
                 
                 <div className="relative w-full h-full max-w-4xl mx-auto flex flex-col">
                    <div className="relative w-full h-full flex items-center justify-center">
                         <PlinkoBoard 
                            rows={rows} 
                            multipliers={currentMultipliers} 
                            onLand={handleLand}
                            ballDropData={ballDropData}
                        />
                    </div>
                 </div>
            </div>

            {/* Controls Area - Stays at bottom */}
            <div className="shrink-0 z-20 w-full bg-[#161922] border-t border-[#2c364c] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
                <div className="max-w-5xl mx-auto w-full">
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