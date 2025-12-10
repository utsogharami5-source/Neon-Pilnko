import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, User } from 'firebase/auth';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle, ShieldAlert, Timer } from 'lucide-react';

interface LoginPageProps {
    currentUser?: User | null;
}

const LoginPage: React.FC<LoginPageProps> = ({ currentUser }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Spam Protection State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  // Rate limit cooldown effect
  useEffect(() => {
    let interval: number;
    if (lockoutTime > 0) {
        interval = window.setInterval(() => {
            setLockoutTime(prev => {
                if (prev <= 1) {
                    setFailedAttempts(0); // Reset attempts after successful wait
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTime]);

  // Handle Authentication Logic
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
        setSuccess("Account created successfully!");
      }
      // Reset spam counters on success
      setFailedAttempts(0); 
    } catch (err: any) {
      // Spam Protection Logic
      setFailedAttempts(prev => {
          const newCount = prev + 1;
          if (newCount >= 3) {
              setLockoutTime(30); // 30 second Lockout
          }
          return newCount;
      });

      let msg = "Authentication failed. Please try again.";
      if (err.code === 'auth/invalid-credential' || err.message?.includes('auth/invalid-credential')) {
          msg = isLogin 
            ? "Account not found or incorrect password." 
            : "Could not create account.";
      } else if (err.code === 'auth/user-not-found') {
          msg = "No account found with this email.";
      } else if (err.code === 'auth/wrong-password') {
          msg = "Incorrect password.";
      } else if (err.code === 'auth/email-already-in-use') {
          msg = "This email is already registered.";
      } else if (err.code === 'auth/weak-password') {
          msg = "Password should be at least 6 characters.";
      } else if (err.code === 'auth/too-many-requests') {
          msg = "Too many attempts. Account temporarily protected.";
          setLockoutTime(60); // Firebase forced cooldown
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (lockoutTime > 0) return;
    if (!email) {
      setError("Please enter your email address above to reset your password.");
      return;
    }
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess("Password reset email sent! Please check your inbox.");
    } catch (err: any) {
      setError("Failed to send reset email. " + err.code);
    } finally {
      setLoading(false);
    }
  };

  // --- RENDER: LOGIN / SIGNUP FORM ---
  return (
    <div className="min-h-[100dvh] w-full bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-lime-500/10 rounded-full blur-[120px]"></div>
      </div>

      <div className="w-full max-w-sm sm:max-w-md relative z-10">
        <div className="bg-[#1e2535]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Lockout Overlay */}
          {lockoutTime > 0 && (
              <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 animate-in fade-in">
                  <ShieldAlert className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
                  <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">System Locked</h3>
                  <p className="text-slate-400 text-sm font-bold mb-4">Too many failed attempts.</p>
                  <div className="flex items-center gap-2 text-2xl font-mono text-red-400 font-bold bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
                      <Timer className="w-6 h-6" />
                      {lockoutTime}s
                  </div>
              </div>
          )}

          {/* Logo Section */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white mb-2">
               <span className="text-lime-400 drop-shadow-[0_0_15px_rgba(132,204,22,0.5)]">PLINKO</span>
               <span className="text-white">NEON</span>
            </h1>
            <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
              Provably Fair Crypto Arcade
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 text-red-400 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-3 flex items-start gap-2 text-lime-400 text-xs font-bold animate-in fade-in slide-in-from-top-1">
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-tight">{success}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider ml-1">Email</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                {/* Text 16px to prevent zoom on mobile */}
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0f1522] border-2 border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white font-bold text-base outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
                  placeholder="enter@email.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider ml-1">Password</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
                  <Lock className="w-4 h-4" />
                </div>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0f1522] border-2 border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white font-bold text-base outline-none focus:border-blue-500 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Forgot Password Link */}
            {isLogin && (
              <div className="flex justify-end">
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-[11px] font-bold text-slate-400 hover:text-blue-400 transition-colors py-1"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || lockoutTime > 0}
              className="w-full mt-4 h-14 sm:h-12 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_0_#1e3a8a] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Log In' : 'Create Account'}
                  {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </>
              )}
            </button>

          </form>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
              disabled={lockoutTime > 0}
              className="text-slate-400 hover:text-white text-xs font-bold transition-colors py-2 disabled:opacity-50"
            >
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <span className="text-lime-400 underline decoration-2 underline-offset-4 decoration-lime-500/50 hover:decoration-lime-400">
                {isLogin ? "Sign Up" : "Log In"}
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;