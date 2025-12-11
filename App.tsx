import React, { useState, useEffect, useCallback, useRef } from 'react';
import HistoryPanel from './components/HistoryPanel';
import Controls from './components/Controls';
import PlinkoBoard from './components/PlinkoBoard';
import AnimatedBackground from './components/AnimatedBackground';
import WalletModal from './components/WalletModal';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import SystemAlertOverlay from './components/SystemAlertOverlay';
import SecurityGatekeeper from './components/SecurityGatekeeper';
import NetworkMonitor from './components/NetworkMonitor';
import { RiskLevel, BetRecord, GameMode, SystemAlert } from './types';
import { getMultipliers } from './constants';
import { translations, Language } from './translations';
import { User, ShieldCheck, LogOut, Wallet, RotateCcw, Shield, History as HistoryIcon, X, Menu, CreditCard, Copy, MessageCircle, Globe } from 'lucide-react';
import { soundManager } from './utils/SoundManager';
import { auth, db } from './firebase'; 
// @ts-ignore
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, increment, query, collection, where, orderBy, limit } from 'firebase/firestore'; 

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App View Mode
  const [viewMode, setViewMode] = useState<'game' | 'admin'>('game');

  // Language State with Persistence
  const [lang, setLang] = useState<Language>(() => {
      try {
          const saved = localStorage.getItem('app_lang');
          return (saved === 'en' || saved === 'bn') ? (saved as Language) : 'en';
      } catch {
          return 'en';
      }
  });

  useEffect(() => {
      localStorage.setItem('app_lang', lang);
  }, [lang]);

  const t = translations[lang];

  // Game Settings
  const [gameMode, setGameMode] = useState<GameMode>('demo');
  const [betAmount, setBetAmount] = useState<number>(100);
  const [rows, setRows] = useState<number>(10); // Locked default to 10 rows
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

  // Alert State
  const [activeAlert, setActiveAlert] = useState<SystemAlert | null>(null);

  // Computed Balance based on active mode
  const currentBalance = gameMode === 'demo' ? demoBalance : realBalance;

  // Balance Animation Logic
  const [isBalanceAnimating, setIsBalanceAnimating] = useState(false);
  const prevBalanceRef = useRef(currentBalance);

  useEffect(() => {
      if (prevBalanceRef.current !== currentBalance) {
          setIsBalanceAnimating(true);
          const timer = setTimeout(() => setIsBalanceAnimating(false), 200);
          prevBalanceRef.current = currentBalance;
          return () => clearTimeout(timer);
      }
  }, [currentBalance]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      let resolvedUser = currentUser;
      if (currentUser) {
         try {
             await currentUser.reload();
         } catch (e: any) {
             console.log("Auto-reload error", e.code || e.message);
             // Handle invalid sessions by signing out
             if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/user-disabled') {
                 await signOut(auth);
                 resolvedUser = null;
             }
         }
      }
      setUser(resolvedUser);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Alert Listener
  useEffect(() => {
    // Only listen for alerts if user is logged in
    if (!user) return;
    
    // Listen for active alerts.
    // Removed orderBy and limit to avoid requiring a composite index.
    // Sorting is done client-side since active alerts are few.
    const q = query(
        collection(db, "system_alerts"), 
        where("active", "==", true)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            // Map and sort client-side
            const alerts = snapshot.docs.map(doc => ({ 
                ...(doc.data() as Omit<SystemAlert, 'id'>), 
                id: doc.id 
            }));
            
            // Sort by timestamp descending (newest first)
            alerts.sort((a, b) => b.timestamp - a.timestamp);
            
            const latestAlert = alerts[0];
            
            // Check if dismissed locally
            const dismissed = localStorage.getItem('dismissed_alerts');
            const dismissedIds = dismissed ? JSON.parse(dismissed) : [];
            
            if (!dismissedIds.includes(latestAlert.id)) {
                setActiveAlert(latestAlert);
                // Play notification sound
                soundManager.ensureContext().then(() => {
                    soundManager.playPegHit(); 
                });
            } else {
                // If latest active is dismissed, show nothing
                setActiveAlert(null);
            }
        } else {
            setActiveAlert(null);
        }
    }, (error) => {
        console.error("Error fetching alerts:", error.message);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleCloseAlert = () => {
    if (activeAlert) {
        const dismissed = localStorage.getItem('dismissed_alerts');
        const dismissedIds = dismissed ? JSON.parse(dismissed) : [];
        dismissedIds.push(activeAlert.id);
        localStorage.setItem('dismissed_alerts', JSON.stringify(dismissedIds));
        setActiveAlert(null);
    }
  };

  // Real-time Balance Subscription (Dual Balance)
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.isBlocked) {
            alert("Your account has been suspended by the administrator.");
            signOut(auth);
            return;
        }
        setDemoBalance(data.demoBalance ?? 1000);
        setRealBalance(data.realBalance ?? 0);
      } else {
        setDoc(userRef, { 
            email: user.email,
            demoBalance: 1000,
            realBalance: 0,
            createdAt: Date.now(),
            isBlocked: false
        }, { merge: true }).catch(err => console.error("Error creating user doc:", err.message));
        setDemoBalance(1000);
        setRealBalance(0);
      }
    }, (error) => {
        console.error("Error listening to balance:", error.message);
    });

    return () => unsubscribe();
  }, [user]);

  // Sync multipliers on config change
  useEffect(() => {
    setCurrentMultipliers(getMultipliers(rows, risk));
  }, [rows, risk]);

  // Handle Play Logic
  const handlePlay = useCallback(async (): Promise<boolean> => {
    if (currentBalance < betAmount || currentBalance <= 0) {
        return false; // Insufficient funds
    }

    if (user) {
        await soundManager.ensureContext();
        
        // Optimistic update
        if (gameMode === 'demo') {
            setDemoBalance(prev => prev - betAmount);
        } else {
            setRealBalance(prev => prev - betAmount);
        }

        const userRef = doc(db, 'users', user.uid);
        const fieldToUpdate = gameMode === 'demo' ? 'demoBalance' : 'realBalance';
        
        try {
            await updateDoc(userRef, { [fieldToUpdate]: increment(-betAmount) });
            const now = Date.now();
            setLastDropTime(now);
            setBallDropData({ id: crypto.randomUUID(), amount: betAmount });
            soundManager.playDrop();
            return true;
        } catch (e: any) {
            console.error("Failed to place bet:", e.message);
            // Revert optimistic update? For now, we rely on snapshot to sync back
            return false;
        }
    }
    return false;
  }, [currentBalance, betAmount, user, gameMode]);


  // Handle Land Logic
  const handleLand = useCallback(async (index: number, multiplier: number, amountBet: number) => {
    const payout = amountBet * multiplier;
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
        } catch (e: any) {
            console.error("Failed to update payout:", e.message);
        }
    }
    soundManager.playWin(multiplier);
  }, [user, gameMode]);

  const handleResetDemoBalance = async () => {
      if (!user || gameMode !== 'demo') return;
      const userRef = doc(db, 'users', user.uid);
      try {
          await updateDoc(userRef, { demoBalance: 1000 });
          setDemoBalance(1000);
      } catch (e: any) {
          console.error("Failed to reset demo balance:", e.message);
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
      return (
        <>
            <NetworkMonitor />
            <LoginPage currentUser={user} lang={lang} setLang={setLang} />
        </>
      );
  }

  const ADMIN_UID = "6nANvmBRHZQV07CkbGc8lCo44jJ2";
  const isAdmin = user.uid === ADMIN_UID;

  if (viewMode === 'admin' && isAdmin) {
      return (
          <div className="h-[100dvh] w-screen bg-[#0f172a] flex flex-col pt-safe">
              <NetworkMonitor />
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
      
      {/* Network Connectivity & Speed Monitor */}
      <NetworkMonitor />

      {/* Security System - Monitors for tampering */}
      <SecurityGatekeeper userId={user.uid} isAdmin={isAdmin} />
      
      {/* Alert Overlay */}
      {activeAlert && <SystemAlertOverlay alert={activeAlert} onClose={handleCloseAlert} />}
      
      {/* Wallet Modal */}
      <WalletModal 
        isOpen={isWalletOpen} 
        onClose={() => setIsWalletOpen(false)} 
        userId={user.uid}
        userEmail={user.email}
        balance={realBalance}
        gameMode={gameMode}
        isAdmin={isAdmin}
        t={t}
      />

      {/* WhatsApp Support Button - Moved to Left */}
      <a 
        href="https://api.whatsapp.com/send?phone=8801965551368&text="
        target="_blank"
        rel="noopener noreferrer"
        className="fixed z-[90] bottom-24 left-4 sm:bottom-6 sm:left-6 bg-green-500 hover:bg-green-400 text-white p-3 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.5)] transition-all hover:scale-110 active:scale-95 group flex items-center gap-2"
      >
        <MessageCircle className="w-6 h-6 animate-[pulse_3s_infinite]" />
        <span className="hidden group-hover:block text-sm font-bold pr-1 animate-in fade-in slide-in-from-right-2">{t.support}</span>
      </a>

      {/* Mobile History Drawer */}
      <div 
        className={`fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${showMobileHistory ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setShowMobileHistory(false)}
      >
        <div 
            className={`absolute right-0 top-0 bottom-0 w-[280px] bg-[#161922] border-l border-slate-700 shadow-2xl transition-transform duration-300 transform pt-safe ${showMobileHistory ? 'translate-x-0' : 'translate-x-full'}`}
            onClick={e => e.stopPropagation()}
        >
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-700/50 bg-[#1a1d29]">
                <span className="font-black text-slate-300 uppercase tracking-widest text-sm">{t.history}</span>
                <button 
                    onClick={() => setShowMobileHistory(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f1522] text-slate-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            <div className="h-[calc(100%-56px)] p-2">
                <HistoryPanel history={history} t={t} />
            </div>
        </div>
      </div>

      <AnimatedBackground lastDropTime={lastDropTime} lastWin={lastWin} />

      {/* Navbar */}
      <nav className="h-14 sm:h-16 bg-[#1a1d29]/90 backdrop-blur-md flex items-center justify-between px-3 md:px-6 border-b border-slate-700/50 shadow-lg relative z-50 shrink-0">
         <div className="flex items-center gap-2 md:gap-4">
             {/* Logo */}
             <div className="text-base sm:text-xl font-black italic tracking-tighter text-white select-none flex items-center gap-1">
                 <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-lime-500 flex items-center justify-center shadow-[0_0_10px_#84cc16]">
                    <span className="text-[10px] sm:text-xs text-black">P</span>
                 </div>
                 <span className="hidden sm:inline text-lime-400 drop-shadow-[0_0_8px_rgba(132,204,22,0.5)]">PLINKO</span>
             </div>
             
             {/* Mobile History Toggle */}
             <button 
                onClick={() => setShowMobileHistory(true)}
                className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-[#0f1522] border border-slate-700/50 text-slate-400 hover:text-white hover:bg-[#1e2535] transition-colors"
             >
                 <HistoryIcon className="w-4 h-4" />
             </button>

             {/* Language Toggle (Desktop) */}
             <button 
                onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-[#0f1522] border border-slate-700/50 text-[10px] font-bold uppercase text-slate-400 hover:text-white transition-colors"
             >
                <Globe className="w-3 h-3" />
                {lang.toUpperCase()}
             </button>

             {/* Game Mode Toggle */}
             <div className="flex bg-[#0f1522] rounded-lg p-0.5 border border-slate-700/50">
                 <button
                    onClick={() => setGameMode('real')}
                    className={`px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all
                        ${gameMode === 'real' ? 'bg-lime-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}
                    `}
                 >
                    {t.real}
                 </button>
                 <button
                    onClick={() => setGameMode('demo')}
                    className={`px-2 py-1 rounded-md text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all
                        ${gameMode === 'demo' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}
                    `}
                 >
                    {t.demo}
                 </button>
             </div>
         </div>

         <div className="flex items-center gap-2 md:gap-3">
             {isAdmin && (
                <button 
                    onClick={() => setViewMode('admin')}
                    className="flex items-center justify-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1 rounded-lg sm:rounded-md transition-all group"
                    title="Admin Dashboard"
                >
                    <Shield className="w-4 h-4 sm:w-3 sm:h-3" />
                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-wider">{t.admin}</span>
                </button>
             )}

             {/* Balance Display */}
             <div className={`flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3 py-1 rounded-lg border shadow-inner transition-all duration-200 ease-out transform
                ${gameMode === 'demo' ? 'bg-blue-900/20 border-blue-500/30' : 'bg-[#0f1522] border-lime-500/20'}
                ${isBalanceAnimating ? 'scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)] border-white/50 brightness-125' : ''}
             `}>
                <span className={`hidden sm:inline text-[10px] font-bold uppercase tracking-wider
                    ${gameMode === 'demo' ? 'text-blue-400' : 'text-slate-400'}
                `}>
                    {gameMode === 'demo' ? t.demo : t.balance}:
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
                    <span className="hidden sm:inline text-[10px] font-bold">{t.wallet}</span>
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
        
        {/* Left Sidebar (Desktop only - LG+) */}
        <div className="hidden lg:flex w-72 shrink-0 flex-col p-4 gap-4 border-r border-slate-800/50 bg-[#161922]/50 backdrop-blur-sm">
             <div className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <HistoryIcon className="w-3 h-3" /> {t.recentBets}
             </div>
             <HistoryPanel history={history} t={t} />
        </div>

        {/* Center Game */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0f1522]/30 relative">
            {/* Game Board Area */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center p-0 sm:p-4 pb-0">
                 <div className={`absolute inset-0 bg-radial-gradient to-transparent opacity-50 pointer-events-none transition-colors duration-500
                    ${gameMode === 'demo' ? 'from-blue-900/10' : 'from-lime-900/10'}
                 `}></div>
                 
                 <div className="relative w-full h-full max-w-[1600px] mx-auto flex flex-col">
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

            {/* Controls Area */}
            <div className="shrink-0 z-20 w-full bg-[#161922] border-t border-[#2c364c] pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.2)]">
                <div className="max-w-7xl mx-auto w-full">
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
                        t={t}
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;