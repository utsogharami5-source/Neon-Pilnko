import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle, ShieldAlert, Timer, Globe } from 'lucide-react';
import { Language, translations } from '../translations';

interface LoginPageProps {
    currentUser?: any;
    lang: Language;
    setLang: (lang: Language) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ currentUser, lang, setLang }) => {
  const t = translations[lang];

  // Email State
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // General State
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

  const handleEmailAuth = async (e: React.FormEvent) => {
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
      setFailedAttempts(0); 
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (lockoutTime > 0) return;
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setSuccess("Logged in with Google!");
      setFailedAttempts(0);
    } catch (err: any) {
      handleAuthError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthError = (err: any) => {
      console.error(err); // Log full error for debugging
      setFailedAttempts(prev => {
          const newCount = prev + 1;
          if (newCount >= 3) {
              setLockoutTime(60); // Locked for 60 seconds after 3 failed attempts
          }
          return newCount;
      });

      let msg = "Authentication failed.";
      if (err.code === 'auth/invalid-credential') msg = "Invalid credentials.";
      else if (err.code === 'auth/user-not-found') msg = "No account found.";
      else if (err.code === 'auth/wrong-password') msg = "Incorrect password.";
      else if (err.code === 'auth/email-already-in-use') msg = "Email already registered.";
      else if (err.code === 'auth/weak-password') msg = "Password too weak.";
      else if (err.code === 'auth/popup-closed-by-user') msg = "Sign-in cancelled.";
      else if (err.code === 'auth/cancelled-popup-request') msg = "Popup cancelled.";
      else if (err.code === 'auth/operation-not-allowed') msg = "Login method not enabled in Firebase Console.";
      else if (err.code === 'auth/unauthorized-domain') {
          msg = `Domain (${window.location.hostname}) is not authorized. Add it to Firebase Console > Auth > Settings > Authorized Domains.`;
      }
      else if (err.code === 'auth/internal-error') {
          msg = "Internal Error. Please refresh the page and try again.";
      }
      else if (err.code === 'auth/too-many-requests') {
          msg = t.tooManyAttempts;
          setLockoutTime(60);
      }
      else if (err.message) msg = err.message;
      
      setError(msg);
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

  // --- RENDER ---
  return (
    <div className="min-h-[100dvh] w-full bg-[#0f172a] flex items-center justify-center p-4 relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-lime-500/10 rounded-full blur-[120px]"></div>
      </div>

      {/* Language Toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button 
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1e2535]/80 border border-slate-700/50 text-xs font-bold uppercase text-slate-400 hover:text-white transition-colors backdrop-blur-sm shadow-lg hover:border-slate-500"
        >
            <Globe className="w-3 h-3" />
            {lang === 'en' ? 'English' : 'বাংলা'}
        </button>
      </div>

      <div className="w-full max-w-sm sm:max-w-md relative z-10">
        <div className="bg-[#1e2535]/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          
          {/* Lockout Overlay */}
          {lockoutTime > 0 && (
              <div className="absolute inset-0 z-50 bg-[#0f172a]/95 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 animate-in fade-in">
                  <ShieldAlert className="w-12 h-12 text-red-500 mb-4 animate-pulse" />
                  <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">{t.systemLocked}</h3>
                  <p className="text-slate-400 text-sm font-bold mb-4">{t.tooManyAttempts}</p>
                  <div className="flex items-center gap-2 text-2xl font-mono text-red-400 font-bold bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
                      <Timer className="w-6 h-6" />
                      {lockoutTime}s
                  </div>
              </div>
          )}

          {/* Logo Section */}
          <div className="text-center mb-6">
            <h1 className="text-3xl sm:text-4xl font-black italic tracking-tighter text-white mb-2">
               <span className="text-lime-400 drop-shadow-[0_0_15px_rgba(132,204,22,0.5)]">PLINKO</span>
               <span className="text-white">NEON</span>
            </h1>
            <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">
              {t.subtitle}
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2 text-red-400 text-xs font-bold animate-in fade-in slide-in-from-top-1 mb-4">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          )}
          {success && (
            <div className="bg-lime-500/10 border border-lime-500/20 rounded-xl p-3 flex items-start gap-2 text-lime-400 text-xs font-bold animate-in fade-in slide-in-from-top-1 mb-4">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-tight">{success}</span>
            </div>
          )}

          {/* --- EMAIL FORM --- */}
          <form onSubmit={handleEmailAuth} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider ml-1">{t.email}</label>
              <div className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
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
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider ml-1">{t.password}</label>
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

            {isLogin && (
              <div className="flex justify-end">
                <button 
                  type="button" 
                  onClick={handleForgotPassword}
                  className="text-[11px] font-bold text-slate-400 hover:text-blue-400 transition-colors py-1"
                >
                  {t.forgotPassword}
                </button>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading || lockoutTime > 0}
              className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_0_#1e3a8a] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? t.login : t.createAccount}
                  {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </>
              )}
            </button>

             <div className="mt-4 text-center">
                <button 
                  type="button"
                  onClick={() => { setIsLogin(!isLogin); setError(''); setSuccess(''); }}
                  disabled={lockoutTime > 0}
                  className="text-slate-400 hover:text-white text-sm sm:text-base font-bold transition-colors py-2 disabled:opacity-50"
                >
                  {isLogin ? t.noAccount : t.haveAccount}
                  <span className="text-lime-400 underline decoration-2 underline-offset-4 decoration-lime-500/50 hover:decoration-lime-400 ml-1">
                    {isLogin ? t.signUp : t.login}
                  </span>
                </button>
              </div>
          </form>

          {/* --- SOCIAL LOGIN --- */}
          <div className="mt-6">
              <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-700"></div>
                  <span className="flex-shrink-0 mx-4 text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t.orContinue}</span>
                  <div className="flex-grow border-t border-slate-700"></div>
              </div>

              <button
                  onClick={handleGoogleLogin}
                  disabled={loading || lockoutTime > 0}
                  className="w-full mt-2 h-12 bg-white hover:bg-slate-200 text-slate-900 font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_0_#94a3b8] active:translate-y-[4px] active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
              </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;