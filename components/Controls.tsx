import React from 'react';
import { RiskLevel } from '../types';
import { Zap, ChevronDown } from 'lucide-react';

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
  const presets = [10, 50, 100, 1000];

  return (
    <div className="w-full bg-[#1e2535] p-4 rounded-3xl border-2 border-[#2c364c] shadow-2xl">
      <div className="flex flex-col lg:flex-row gap-4 items-center">
        
        {/* Configuration Group */}
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Risk & Rows */}
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between px-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Risk</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows</span>
                </div>
                
                <div className="flex gap-2">
                    {/* Risk Buttons */}
                    <div className="flex-[2] bg-[#0f1522] p-1 rounded-xl border border-slate-700/50 flex h-12">
                        {(['low', 'medium', 'high'] as RiskLevel[]).map((r) => (
                        <button
                            key={r}
                            onClick={() => setRisk(r)}
                            className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all duration-200 btn-3d
                            ${risk === r 
                                ? 'btn-3d-yellow text-[#422006]' 
                                : 'bg-transparent text-slate-400 hover:text-slate-200 shadow-none'
                            }`}
                        >
                            {r}
                        </button>
                        ))}
                    </div>

                    {/* Rows Select */}
                    <div className="flex-1 relative bg-[#0f1522] rounded-xl border border-slate-700/50 h-12">
                        <select
                            value={rows}
                            onChange={(e) => setRows(Number(e.target.value))}
                            className="w-full h-full bg-transparent text-white font-bold text-sm text-center appearance-none outline-none z-10 relative cursor-pointer"
                        >
                            {[8, 9, 10, 11, 12, 13, 14, 15, 16].map((r) => (
                                <option key={r} value={r} className="bg-[#0f1522] text-white">
                                    {r}
                                </option>
                            ))}
                        </select>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                             <ChevronDown className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bet Amount */}
            <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-end px-1">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bet</span>
                   {/* Presets inline */}
                   <div className="flex gap-1">
                      {presets.slice(0, 3).map(amt => (
                          <button key={amt} onClick={() => setBetAmount(amt)} className="text-[9px] font-bold bg-[#2c364c] hover:bg-[#374151] px-1.5 py-0.5 rounded text-slate-300 transition-colors">
                              {amt}
                          </button>
                      ))}
                   </div>
                </div>
                
                <div className="flex gap-2 h-12">
                     <div className="relative flex-1 h-full">
                        <div className="absolute left-3 top-1/2 -translate-y-[55%] text-lime-500 font-bold text-sm">$</div>
                        <input 
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(Math.max(0, Number(e.target.value)))}
                            className="w-full h-full bg-[#0f1522] border-2 border-[#2c364c] text-white font-bold text-sm rounded-xl pl-7 pr-2 focus:outline-none focus:border-lime-500 transition-all"
                        />
                     </div>
                     <button onClick={() => setBetAmount(betAmount / 2)} className="w-10 h-full btn-3d btn-3d-slate rounded-xl font-bold text-[10px] text-slate-300 flex items-center justify-center">½</button>
                     <button onClick={() => setBetAmount(betAmount * 2)} className="w-10 h-full btn-3d btn-3d-slate rounded-xl font-bold text-[10px] text-slate-300 flex items-center justify-center">2×</button>
                </div>
            </div>
        </div>

        {/* Play Button */}
        <div className="w-full lg:w-auto shrink-0">
             <button
                onClick={onPlay}
                disabled={!canPlay || betAmount > balance}
                className={`
                    group relative w-full lg:w-32 h-16 lg:h-[88px] rounded-2xl flex items-center justify-center transition-all duration-100
                    disabled:opacity-50 disabled:cursor-not-allowed
                    btn-3d btn-3d-green
                `}
            >
                <div className="flex flex-col items-center gap-1">
                   {canPlay ? (
                       <span className="text-xl font-black tracking-wider text-[#1a2e05] drop-shadow-sm">BET</span>
                   ) : (
                       <Zap className="w-8 h-8 text-[#1a2e05] animate-pulse" />
                   )}
                </div>
            </button>
            {betAmount > balance && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-max text-[10px] text-red-400 font-bold bg-[#0f1522] px-2 py-0.5 rounded border border-red-500/30">
                    Insufficient Balance
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Controls;