import React, { useEffect, useState } from 'react';
import { X, Bell, AlertTriangle, Info } from 'lucide-react';
import { SystemAlert } from '../types';

interface SystemAlertOverlayProps {
  alert: SystemAlert;
  onClose: () => void;
}

const SystemAlertOverlay: React.FC<SystemAlertOverlayProps> = ({ alert, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay for entrance animation
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
      setVisible(false);
      setTimeout(onClose, 300); // Wait for exit animation
  };

  const isUrgent = alert.type === 'urgent';
  const glowColor = isUrgent ? 'rgba(239, 68, 68, 0.6)' : 'rgba(59, 130, 246, 0.6)';
  const iconColor = isUrgent ? 'text-red-500' : 'text-blue-500';
  const borderColor = isUrgent ? 'border-red-500' : 'border-blue-500';

  return (
    <div 
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Background Animated Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-1/4 left-1/4 w-96 h-96 ${isUrgent ? 'bg-red-600/20' : 'bg-blue-600/20'} rounded-full blur-[100px] animate-pulse`}></div>
          <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 ${isUrgent ? 'bg-orange-600/20' : 'bg-purple-600/20'} rounded-full blur-[100px] animate-pulse`} style={{ animationDelay: '1s' }}></div>
      </div>

      <div 
        className={`
            relative w-full max-w-3xl flex flex-col items-center text-center p-8 md:p-12 rounded-3xl border-2 ${borderColor} bg-[#0f172a]/80 shadow-2xl transition-all duration-500 transform
            ${visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-10'}
        `}
        style={{
            boxShadow: `0 0 50px ${glowColor}, inset 0 0 20px ${glowColor}`
        }}
      >
          {/* Header Icon */}
          <div className={`mb-6 p-4 rounded-full border-2 ${borderColor} ${isUrgent ? 'bg-red-900/30' : 'bg-blue-900/30'} shadow-[0_0_30px_${glowColor}] animate-bounce`}>
              {isUrgent ? <AlertTriangle className={`w-12 h-12 md:w-16 md:h-16 ${iconColor}`} /> : <Bell className={`w-12 h-12 md:w-16 md:h-16 ${iconColor}`} />}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-5xl font-black italic text-white tracking-tighter mb-6 drop-shadow-md">
            {alert.title}
          </h1>
          
          {/* Message Area with custom scrollbar */}
          <div className="relative w-full mb-8">
             <div className={`w-32 h-1 bg-gradient-to-r from-transparent via-${isUrgent ? 'red' : 'blue'}-500 to-transparent mx-auto mb-6 opacity-50`}></div>
             
             <div className="max-h-[50vh] overflow-y-auto custom-scrollbar px-2">
                <p className="text-lg md:text-2xl font-medium text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {alert.message}
                </p>
             </div>

             <div className={`w-32 h-1 bg-gradient-to-r from-transparent via-${isUrgent ? 'red' : 'blue'}-500 to-transparent mx-auto mt-6 opacity-50`}></div>
          </div>

          {/* Action Button */}
          <button 
            onClick={handleClose}
            className={`
                group relative inline-flex items-center gap-3 px-10 py-4 
                ${isUrgent ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'} 
                text-white font-black uppercase tracking-widest text-sm md:text-base rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-lg
            `}
          >
             <span className="relative z-10 flex items-center gap-2">
                Close Alert <X className="w-5 h-5" />
             </span>
             {/* Button Glow */}
             <div className={`absolute inset-0 rounded-2xl blur-md ${isUrgent ? 'bg-red-600' : 'bg-blue-600'} opacity-50 group-hover:opacity-100 transition-opacity`}></div>
          </button>
      </div>
    </div>
  );
};

export default SystemAlertOverlay;