import React, { useEffect, useRef } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
// @ts-ignore
import { signOut } from 'firebase/auth';

interface SecurityGatekeeperProps {
  userId: string;
  isAdmin: boolean;
}

const SecurityGatekeeper: React.FC<SecurityGatekeeperProps> = ({ userId, isAdmin }) => {
  const bannedRef = useRef(false);

  useEffect(() => {
    if (isAdmin) return;

    const banUser = async (reason: string) => {
      if (bannedRef.current) return;
      bannedRef.current = true;
      
      console.clear();
      console.error("SECURITY VIOLATION: " + reason);
      
      try {
        // Write to Firestore to permanently block the user
        await updateDoc(doc(db, 'users', userId), {
          isBlocked: true,
          blockReason: reason,
          blockedAt: Date.now()
        });
        
        alert(`SECURITY ALERT: ACCOUNT BANNED.\nReason: ${reason}\n\nTerminating Session.`);
        await signOut(auth);
        window.location.reload();
      } catch (e) {
        console.error("Ban execution failed", e);
        // Force logout locally even if DB fails
        await signOut(auth);
        window.location.reload();
      }
    };

    // 1. Prevent Context Menu (Right Click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // 2. Prevent DevTools Shortcuts & Source Viewing
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12
      if (e.key === 'F12') {
        e.preventDefault();
        banUser("Attempted to open DevTools (F12)");
      }
      
      // Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
        e.preventDefault();
        banUser("Attempted to open DevTools (Ctrl+Shift+I)");
      }
      
      // Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
        e.preventDefault();
        banUser("Attempted to open Console (Ctrl+Shift+J)");
      }
      
      // Ctrl+Shift+C (Inspect)
      if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        banUser("Attempted to Inspect Element (Ctrl+Shift+C)");
      }

      // Ctrl+U (View Source)
      if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
        e.preventDefault();
        banUser("Attempted to View Source (Ctrl+U)");
      }
      
      // Ctrl+S (Save Page)
      if (e.ctrlKey && (e.key === 'S' || e.key === 's')) {
        e.preventDefault();
        banUser("Attempted to Save Page Source");
      }
    };

    // 3. Honeypot Globals
    // Traps for users trying to modify values via Console
    const honeypots = ['balance', 'demoBalance', 'realBalance', 'credits', 'money', 'wallet'];
    
    honeypots.forEach(prop => {
        // Only define if not already existing to avoid breaking app
        if (!window.hasOwnProperty(prop)) {
            Object.defineProperty(window, prop, {
                get: () => 1337.00, // Fake temptation value
                set: (val) => {
                    banUser(`Attempted to modify global variable: ${prop}`);
                },
                configurable: false
            });
        }
    });

    // Honeypot Functions
    // Traps for users trying to call functions they think exist
    (window as any).setBalance = (amount: number) => banUser("Called honeypot function setBalance()");
    (window as any).addMoney = (amount: number) => banUser("Called honeypot function addMoney()");
    (window as any).triggerWin = () => banUser("Called honeypot function triggerWin()");
    (window as any).adminLogin = () => banUser("Called honeypot function adminLogin()");
    (window as any).bypassSecurity = () => banUser("Attempted to bypass security");

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [userId, isAdmin]);

  return null;
};

export default SecurityGatekeeper;