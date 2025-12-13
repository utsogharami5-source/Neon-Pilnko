import React, { useState, useEffect } from 'react';
import { WifiOff, SignalLow, AlertTriangle, RefreshCw } from 'lucide-react';

const NetworkMonitor: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSlow, setIsSlow] = useState(false);

  useEffect(() => {
    // 1. Handle Online/Offline Status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 2. Handle Slow Connection Detection
    // We use the Network Information API (navigator.connection)
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    const updateConnectionStatus = () => {
      if (connection) {
        // Criteria for "Slow":
        // 1. effectiveType is 'slow-2g' or '2g'
        // 2. RTT (Round Trip Time) > 600ms
        // 3. Downlink < 1 Mbps
        const isPoor = 
          connection.effectiveType === 'slow-2g' || 
          connection.effectiveType === '2g' || 
          (connection.rtt && connection.rtt > 600) ||
          (connection.downlink && connection.downlink < 1);
        
        setIsSlow(isPoor);
      }
    };

    if (connection) {
      updateConnectionStatus(); // Check immediately
      connection.addEventListener('change', updateConnectionStatus); // Check on change
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', updateConnectionStatus);
      }
    };
  }, []);

  // --- UI RENDER ---

  // Condition 1: No Internet (Full Screen Alert)
  if (!isOnline) {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#0f172a] flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full animate-pulse"></div>
          <WifiOff className="w-24 h-24 text-red-500 relative z-10" />
        </div>
        
        <h1 className="text-3xl md:text-4xl font-black text-white mb-4 uppercase tracking-tighter">
          No Internet Connection
        </h1>
        <p className="text-slate-400 font-bold text-lg max-w-md mb-8">
          We cannot connect to the game server. Please check your WiFi or mobile data settings.
        </p>

        <button 
          onClick={() => window.location.reload()}
          className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95"
        >
          <RefreshCw className="w-5 h-5" /> Try Again
        </button>
      </div>
    );
  }

  // Condition 2: Slow Internet (Small Corner Alert)
  if (isSlow) {
    return (
      <div className="fixed top-20 right-4 z-[90] animate-in slide-in-from-right-10 fade-in duration-500 pointer-events-none">
        <div className="bg-yellow-500/10 backdrop-blur-md border border-yellow-500/30 p-3 rounded-xl shadow-2xl flex items-center gap-3 max-w-[280px]">
           <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0 animate-pulse">
              <SignalLow className="w-6 h-6 text-yellow-500" />
           </div>
           <div>
              <h4 className="text-yellow-400 font-black text-xs uppercase tracking-wider flex items-center gap-1">
                 <AlertTriangle className="w-3 h-3" /> Unstable Connection
              </h4>
              <p className="text-yellow-200/80 text-[10px] font-bold leading-tight mt-0.5">
                 Game data may load slowly. Please ensure a stable network.
              </p>
           </div>
        </div>
      </div>
    );
  }

  return null;
};

export default NetworkMonitor;
