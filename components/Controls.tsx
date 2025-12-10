import React from 'react';
import { RiskLevel } from '../types';
import { Zap, ChevronDown, AlertCircle, Plus, Minus } from 'lucide-react';

interface ControlsProps {
  balance: number;
  betAmount: number;
  setBetAmount: (val: number) => void;
  risk: RiskLevel;
  setRisk: (val: RiskLevel) => void;
  rows: number;
  setRows: (val: number) => void;
  onPlay: () => void;
  canPlay: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  balance,
  betAmount,
  setBetAmount,
  risk,
  setRisk,
  rows,
  setRows,
  onPlay,
  canPlay
}) => {
  const isInsufficientBalance = betAmount > balance;

  // Handler for manual input to prevent negative numbers
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '') {
          setBetAmount(0);
          return;
      }
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
          setBetAmount(num);
      }
  };

  const adjustBet = (multiplier: number) => {
      const newAmount = Math.floor(betAmount * multiplier);
      setBetAmount(Math.max(1, newAmount));
  };

  return (
    <div className="w-full bg-[#1e2535] p-2 sm:p-3 rounded-t-2xl sm:rounded-2xl border-t-2 sm:border-2 border-[#2c364c] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:shadow-2xl">
      
      {/* Grid Layout - Optimized for Mobile */}
      <div className="flex flex-col gap-2 lg:flex-row sm:gap-3">
        
        {/* Row 1 on Mobile: Settings (Risk & Rows) */}
        <div className="bg-[#0f1522] rounded-xl p-1.5 border border-slate-700/50 flex gap-1 items-stretch shrink-0 lg:w-1/3">
            {/* Risk Segmented Control */}
            <div className="flex-[2] flex bg-[#1a1d29] rounded-lg p-1 gap-1">
                {(['low', 'medium', 'high'] as RiskLevel[]).map((r) => (
                    <button
                        key={r}
                        onClick={() => setRisk(r)}
                        className={`flex-1 rounded-md text-[10px] sm:text-[11px] font-black uppercase transition-all duration-200 flex items-center justify-center py-2 sm:py-0
                        ${risk === r 
                            ? 'bg-[#eab308] text-[#422006] shadow-sm' 
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                    >
                        {r}
                    </button>
                ))}
            </div>

            {/* Vertical Divider */}
            <div className="w-px bg-slate-800 my-1"></div>

            {/* Rows Selector */}
            <div className="flex-1 relative">
                <select
                    value={rows}
                    onChange={(e) => setRows(Number(e.target.value))}
                    className="w-full h-full min-h-[36px] bg-[#1a1d29] rounded-lg text-white font-bold text-xs pl-3 pr-6 appearance-none outline-none focus:ring-1 focus:ring-blue-500/50"
                >
                    {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((r) => (
                        <option key={r} value={r} className="bg-[#0f1522]">
                            {r} Rows
                        </option>
                    ))}
                </select>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ChevronDown className="w-3 h-3" />
                </div>
            </div>
        </div>

        {/* Row 2 on Mobile: Bet Input + Play Button */}
        <div className="flex-1 flex gap-2 h-14 lg:h-auto">
            
            {/* Bet Input (Expands) */}
            <div className="flex-[3] relative h-full">
                 <div className={`absolute left-3 top-1/2 -translate-y-[50%] font-bold text-sm transition-colors ${isInsufficientBalance ? 'text-red-500' : 'text-lime-500'}`}>$</div>
                 
                 <input 
                    type="number"
                    inputMode="decimal"
                    value={betAmount === 0 ? '' : betAmount}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className={`w-full h-full bg-[#0f1522] border-2 text-white font-bold text-lg rounded-xl pl-8 pr-16 focus:outline-none transition-all placeholder:text-slate-700
                        ${isInsufficientBalance 
                            ? 'border-red-500/50 focus:border-red-500' 
                            : 'border-[#2c364c] focus:border-blue-500'
                        }
                    `}
                 />

                 {/* Half/Double Buttons - Stacked on Mobile or Side-by-side */}
                 <div className="absolute right-1 top-1 bottom-1 flex gap-1">
                    <button 
                        onClick={() => adjustBet(0.5)}
                        className="px-2 bg-[#1e2535] hover:bg-[#2c364c] rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors border border-slate-700/50 active:scale-95 flex items-center justify-center"
                    >
                        ½
                    </button>
                    <button 
                        onClick={() => adjustBet(2)}
                        className="px-2 bg-[#1e2535] hover:bg-[#2c364c] rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors border border-slate-700/50 active:scale-95 flex items-center justify-center"
                    >
                        2×
                    </button>
                 </div>
            </div>

            {/* Play Button (Fixed width relative to input to keep easy to tap) */}
            <div className="flex-[2] lg:flex-none lg:w-36 h-full">
                 <button
                    onClick={onPlay}
                    disabled={!canPlay || betAmount > balance || betAmount <= 0}
                    className={`
                        group relative w-full h-full rounded-xl flex items-center justify-center transition-all duration-100
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                        btn-3d btn-3d-green
                    `}
                >
                    {/* Inner Glow/Highlight */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                    
                    <div className="flex flex-col items-center justify-center gap-0.5 relative z-10">
                       {canPlay ? (
                           <>
                               <span className="text-lg sm:text-xl font-black tracking-widest text-[#1a2e05] drop-shadow-sm leading-none mt-1">BET</span>
                               {betAmount > 0 && (
                                   <span className="hidden sm:inline text-[9px] font-bold text-[#2d4f0d] opacity-80 leading-none">
                                       ${betAmount}
                                   </span>
                               )}
                           </>
                       ) : (
                           <Zap className="w-6 h-6 text-[#1a2e05] animate-pulse" />
                       )}
                    </div>
                </button>
            </div>
        </div>

      </div>
      
      {/* Insufficient Balance Message */}
      {isInsufficientBalance && (
         <div className="flex items-center justify-center gap-1.5 mt-2 text-red-400 text-[10px] font-bold animate-pulse">
            <AlertCircle className="w-3 h-3" />
            <span>Insufficient Balance</span>
         </div>
      )}
    </div>
  );
};

export default Controls;