'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const router = useRouter();

  // Controllo sessione attiva all'avvio (Eseguito in modo sicuro solo sul client)
  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    if (savedRole) {
      router.push('/');
    } else {
      setIsCheckingSession(false);
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Salva i dati di sessione autorizzati dal backend
        localStorage.setItem('user_role', data.role);
        localStorage.setItem('user_name', data.username);
        
        // Vai alla pagina principale della cassa
        router.push('/');
      } else {
        setError(data.error || 'Impossibile effettuare il login.');
      }
    } catch (err) {
      setError('Errore di connessione con il server. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  // Evita il flash del form se l'utente è già loggato e sta venendo reindirizzato
  if (isCheckingSession) {
    return (
      <div className="bg-slate-900 min-h-screen flex justify-center items-center font-sans">
        <div className="text-white text-xs uppercase tracking-widest animate-pulse">
          Verifica postazione...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 min-h-screen flex flex-col justify-center items-center font-sans p-4 relative overflow-hidden">
      {/* Sfondo geometrico sfumato di design */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-3xl shadow-2xl space-y-6 z-10">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-black text-white tracking-wider uppercase">
            Lido eWallet <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full lowercase">v3.6</span>
          </h1>
          <p className="text-xs text-slate-400">Inserisci le credenziali della tua postazione</p>
        </div>

        {error && (
          <div className="bg-rose-500/20 border border-rose-500/40 text-rose-300 p-3.5 rounded-xl text-xs font-bold text-center">
            🛑 {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Username Postazione</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              autoComplete="username"
              placeholder="Es. admin, spiaggia, chiosco" 
              className="w-full p-3.5 bg-white/5 border-2 border-white/10 rounded-xl text-white outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password di Accesso</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••" 
              className="w-full p-3.5 bg-white/5 border-2 border-white/10 rounded-xl text-white outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600 text-sm"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold p-4 rounded-xl text-xs uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50"
          >
            {loading ? 'Verifica in corso...' : '🔑 Accedi al Sistema'}
          </button>
        </form>
      </div>
    </div>
  );
}
