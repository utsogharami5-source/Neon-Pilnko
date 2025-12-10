import React from 'react';
import { BetRecord } from '../types';
import { translations } from '../translations';

interface HistoryPanelProps {
  history: BetRecord[];
  t: typeof translations.en;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ history, t }) => {
  return (
    <div className="flex flex-col h-full bg-[#1e2535] rounded-xl overflow-hidden border border-[#2c364c] w-full">
      <div className="grid grid-cols-4 p-2.5 bg-[#1a1d29] text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-700/50 shrink-0">
        <div>{t.time}</div>
        <div className="text-center">{t.bet}</div>
        <div className="text-center">{t.mult}</div>
        <div className="text-right">{t.win}</div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
        {history.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
            <div className="w-10 h-10 rounded-full bg-slate-800/50 flex items-center justify-center">
                <span className="text-xl opacity-20">🎲</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wide">{t.noBets}</p>
          </div>
        ) : (
          history.map((record) => (
            <div 
              key={record.id} 
              className="grid grid-cols-4 items-center p-2 rounded-lg bg-[#0f1522] border border-transparent hover:border-slate-700 transition-colors"
            >
              <div className="text-slate-500 text-[9px] font-medium font-mono">
                {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-center font-mono text-[10px] text-slate-300">
                ${record.amount}
              </div>
              <div className={`text-center text-[10px] font-bold ${record.multiplier >= 1 ? 'text-white' : 'text-slate-500'}`}>
                <span className={`px-1.5 py-0.5 rounded ${record.multiplier >= 1 ? 'bg-lime-500/20 text-lime-400' : ''}`}>
                    {record.multiplier}x
                </span>
              </div>
              <div className={`text-right font-mono text-[10px] ${record.profit > 0 ? 'text-lime-400' : 'text-slate-500'}`}>
                {record.payout > 0 ? `+${record.payout.toFixed(1)}` : '0.00'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;