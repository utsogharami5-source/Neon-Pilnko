import React, { useState, useCallback } from 'react';
import { RiskLevel } from '../types';
import { Zap, AlertCircle, PlayCircle, StopCircle, Infinity as InfinityIcon } from 'lucide-react';
import { translations } from '../translations';

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
  isAutoBetting: boolean;
  onAutoStart: (count: number) => void;
  onAutoStop: () => void;
  t: typeof translations.en;
}

const Controls: React.FC<ControlsProps> = ({
  balance,
  betAmount,
  setBetAmount,
  risk,
  setRisk,
  onPlay,
  canPlay,
  isAutoBetting,
  onAutoStart,
  onAutoStop,
  t
}) => {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [numberOfBets, setNumberOfBets] = useState<string>('0');
  const isInsufficientBalance = betAmount > balance;

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

  const handleBetsCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '') {
          setNumberOfBets('');
          return;
      }
      const num = parseInt(val);
      if (!isNaN(num) && num >= 0) {
          setNumberOfBets(num.toString());
      }
  };

  const adjustBet = useCallback((multiplier: number) => {
      const newAmount = Math.floor(betAmount * multiplier);
      setBetAmount(Math.max(1, newAmount));
  }, [betAmount, setBetAmount]);

  const handleMainAction = () => {
      if (mode === 'manual') {
          onPlay();
      } else {
          if (isAutoBetting) {
              onAutoStop();
          } else {
              const count = parseInt(numberOfBets || '0');
              onAutoStart(count);
          }
      }
  };

  const isButtonDisabled = (!canPlay && !isAutoBetting) || (betAmount > balance && !isAutoBetting) || betAmount <= 0;
  
  const getButtonContent = () => {
      if (mode === 'auto' && isAutoBetting) {
          return (
             <>
                <StopCircle className="w-6 h-6 animate-pulse" />
                <span className="text-lg sm:text-xl font-black tracking-widest leading-none mt-1">{t.stopAuto}</span>
             </>
          );
      }
      if (mode === 'auto') {
          return (
             <>
                <PlayCircle className="w-6 h-6" />
                <span className="text-lg sm:text-xl font-black tracking-widest leading-none mt-1">{t.startAuto}</span>
             </>
          );
      }
      return (
          <>
             <span className="text-lg sm:text-xl font-black tracking-widest text-[#1a2e05] drop-shadow-sm leading-none mt-1">{t.bet}</span>
             {betAmount > 0 && (
                 <span className="hidden sm:inline text-[9px] font-bold text-[#2d4f0d] opacity-80 leading-none">
                     ${betAmount}
                 </span>
             )}
          </>
      );
  };

  return (
    <div className="w-full bg-[#1e2535] p-2 sm:p-3 rounded-t-2xl sm:rounded-2xl border-t-2 sm:border-2 border-[#2c364c] shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:shadow-2xl relative">
      
      <div className="flex justify-center mb-2 sm:absolute sm:top-[-20px] sm:left-1/2 sm:-translate-x-1/2 sm:mb-0">
          <div className="flex bg-[#1a1d29] p-1 rounded-full border border-slate-700 shadow-xl">
              <button
                  onClick={() => { if(!isAutoBetting) setMode('manual'); }}
                  disabled={isAutoBetting}
                  className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all
                      ${mode === 'manual' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}
                      disabled:opacity-50
                  `}
              >
                  {t.manual}
              </button>
              <button
                  onClick={() => { if(!isAutoBetting) setMode('auto'); }}
                  disabled={isAutoBetting}
                  className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all
                      ${mode === 'auto' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}
                      disabled:opacity-50
                  `}
              >
                  {t.auto}
              </button>
          </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row sm:gap-3">
        
        <div className="bg-[#0f1522] rounded-xl p-1.5 border border-slate-700/50 flex flex-col sm:flex-row md:flex-row gap-1 items-stretch shrink-0 md:w-5/12 lg:w-1/3">
            <div className="flex flex-1 gap-1">
                <div className="flex-[2] flex bg-[#1a1d29] rounded-lg p-1 gap-1">
                    {(['low', 'medium', 'high'] as RiskLevel[]).map((r) => (
                        <button
                            key={r}
                            onClick={() => !isAutoBetting && setRisk(r)}
                            disabled={isAutoBetting}
                            className={`flex-1 rounded-md text-[10px] sm:text-[11px] font-black uppercase transition-all duration-200 flex items-center justify-center py-2 sm:py-0 disabled:opacity-50
                            ${risk === r 
                                ? 'bg-[#eab308] text-[#422006] shadow-sm' 
                                : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                            {t[r]}
                        </button>
                    ))}
                </div>
            </div>

            {mode === 'auto' && (
                <div className="relative flex-1 min-w-[80px]">
                    <div className="absolute left-2 top-0 bottom-0 flex items-center pointer-events-none">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">{t.bets}</span>
                    </div>
                    <input 
                        type="number"
                        disabled={isAutoBetting}
                        value={numberOfBets}
                        onChange={handleBetsCountChange}
                        placeholder="∞"
                        className="w-full h-full bg-[#1a1d29] border border-slate-700 rounded-lg text-white font-bold text-xs pl-10 pr-2 focus:border-purple-500 outline-none text-right disabled:opacity-50"
                    />
                    {(numberOfBets === '0' || numberOfBets === '') && (
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400">
                            <InfinityIcon className="w-3 h-3" />
                        </div>
                    )}
                </div>
            )}
        </div>

        <div className="flex-1 flex gap-2 h-14 md:h-auto">
            <div className="flex-[3] relative h-full">
                 <div className={`absolute left-3 top-1/2 -translate-y-[50%] font-bold text-sm transition-colors ${isInsufficientBalance ? 'text-red-500' : 'text-lime-500'}`}>$</div>
                 <input 
                    type="number"
                    inputMode="decimal"
                    disabled={isAutoBetting}
                    value={betAmount === 0 ? '' : betAmount}
                    onChange={handleAmountChange}
                    placeholder="0"
                    className={`w-full h-full bg-[#0f1522] border-2 text-white font-bold text-lg rounded-xl pl-8 pr-16 focus:outline-none transition-all placeholder:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed
                        ${isInsufficientBalance 
                            ? 'border-red-500/50 focus:border-red-500' 
                            : 'border-[#2c364c] focus:border-blue-500'
                        }
                    `}
                 />

                 <div className="absolute right-1 top-1 bottom-1 flex gap-1">
                    <button 
                        onClick={() => adjustBet(0.5)}
                        disabled={isAutoBetting}
                        className="px-2 bg-[#1e2535] hover:bg-[#2c364c] rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors border border-slate-700/50 active:scale-95 flex items-center justify-center disabled:opacity-50"
                    >
                        ½
                    </button>
                    <button 
                        onClick={() => adjustBet(2)}
                        disabled={isAutoBetting}
                        className="px-2 bg-[#1e2535] hover:bg-[#2c364c] rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors border border-slate-700/50 active:scale-95 flex items-center justify-center disabled:opacity-50"
                    >
                        2×
                    </button>
                 </div>
            </div>

            <div className="flex-[2] lg:flex-none lg:w-36 h-full">
                 <button
                    onClick={handleMainAction}
                    disabled={isButtonDisabled}
                    className={`
                        group relative w-full h-full rounded-xl flex items-center justify-center transition-all duration-100
                        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
                        btn-3d
                        ${mode === 'auto' && isAutoBetting 
                            ? 'bg-red-500 shadow-[0_4px_0_#991b1b] text-white active:shadow-none active:translate-y-[2px]' 
                            : mode === 'auto'
                                ? 'bg-purple-600 shadow-[0_4px_0_#581c87] text-white active:shadow-none active:translate-y-[2px]'
                                : 'btn-3d-green'
                        }
                    `}
                >
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
                    
                    <div className="flex flex-col items-center justify-center gap-0.5 relative z-10">
                        {canPlay || isAutoBetting ? (
                           getButtonContent()
                        ) : (
                           <Zap className="w-6 h-6 text-[#1a2e05] animate-pulse" />
                        )}
                    </div>
                </button>
            </div>
        </div>

      </div>
      
      {isInsufficientBalance && !isAutoBetting && (
         <div className="flex items-center justify-center gap-1.5 mt-2 text-red-400 text-[10px] font-bold animate-pulse">
            <AlertCircle className="w-3 h-3" />
            <span>{t.insufficientBalance}</span>
         </div>
      )}
    </div>
  );
};

export default Controls;