'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function CassaLido() {
  const [tab, setTab] = useState('reg');
  const [toast, setToast] = useState({ show: false, message: '', isSuccess: true });
  const [logs, setLogs] = useState([]);
  
  // Form Reg
  const [regUid, setRegUid] = useState('');
  const [regName, setRegName] = useState('');
  const [regBalance, setRegBalance] = useState('0.00');
  
  // Form Topup
  const [topupUid, setTopupUid] = useState('');
  const [topupAmount, setTopupAmount] = useState('');

  const regInputRef = useRef(null);
  const nameInputRef = useRef(null); // 🔥 Nuovo riferimento per il campo Nome
  const topupInputRef = useRef(null);

  useEffect(() => {
    if (tab === 'reg') regInputRef.current?.focus();
    if (tab === 'topup') topupInputRef.current?.focus();
  }, [tab]);

  const addLog = (text) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${time}] ${text}`, ...prev.slice(0, 19)]);
  };

  const showToast = (message, isSuccess = true) => {
    setToast({ show: true, message, isSuccess });
    setTimeout(() => setToast({ show: false, message: '', isSuccess: true }), 4500);
  };

  // 🔥 FUNZIONE DI INTERCETTAZIONE LETTORE NFC
  const handleUidKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // 🛡️ Blocca il lettore prima che invii il modulo incompleto!
      if (regUid.trim()) {
        addLog(`📟 Tag NFC rilevato: [${regUid.trim()}]. Inserisci il nome.`);
        nameInputRef.current?.focus(); // 🚀 Salta automaticamente al campo Nome!
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!regUid.trim()) {
      showToast("Passa prima una tessera sul lettore!", false);
      addLog("❌ Attivazione annullata: manca l'UID.");
      return;
    }
    if (!regName.trim()) {
      showToast("Inserisci il Nome dell'Ospite o dell'Ombrellone!", false);
      addLog(`❌ Attivazione bloccata su UID [${regUid.trim()}]: manca l'ombrellone.`);
      nameInputRef.current?.focus();
      return;
    }

    addLog(`⏳ Salvataggio in corso per: ${regName.trim()}...`);

    try {
      const res = await fetch('/api/register-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: regUid.trim(), name: regName.trim(), initialBalance: regBalance })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Tessera attivata con successo per: ${regName.trim()}`);
        addLog(`✅ COMPLETATO: ${regName.trim()} associato al Tag [${regUid.trim()}] con saldo €${parseFloat(regBalance).toFixed(2)}`);
        setRegUid(''); setRegName(''); setRegBalance('0.00');
        regInputRef.current?.focus();
      } else {
        showToast(`Errore: ${data.error || 'Errore sconosciuto'}`, false);
        addLog(`❌ ERRORE DATABASE: ${data.error || 'Errore sconosciuto'}`);
      }
    } catch (err) {
      showToast("Errore di connessione con le Serverless Vercel.", false);
      addLog("❌ ERRORE: Nessuna risposta dal server.");
    }
  };

  const handleTopup = async (e) => {
    e.preventDefault();

    if (!topupUid.trim() || !topupAmount || parseFloat(topupAmount) <= 0) {
      showToast("UID e Importo valido sono obbligatori!", false);
      addLog("❌ Ricarica fallita: dati parziali.");
      return;
    }

    addLog(`⏳ Elaborazione ricarica di €${parseFloat(topupAmount).toFixed(2)} su UID [${topupUid.trim()}]...`);

    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: topupUid.trim(), amount: topupAmount })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Ricarica eseguita! Nuovo Saldo: €${parseFloat(data.new_balance).toFixed(2)}`);
        addLog(`💰 RICARICA OK: Tag [${topupUid.trim()}] aggiornato. Nuovo saldo: €${parseFloat(data.new_balance).toFixed(2)}`);
        setTopupUid(''); setTopupAmount('');
        topupInputRef.current?.focus();
      } else {
        showToast(`Errore: ${data.error || 'Errore sconosciuto'}`, false);
        addLog(`❌ ERRORE RICARICA: ${data.error || 'Errore sconosciuto'}`);
      }
    } catch (err) {
      showToast("Errore di connessione con le Serverless Vercel.", false);
      addLog("❌ ERRORE: Nessuna risposta dal server.");
    }
  };

  return (
    <div className="bg-slate-50 font-sans min-h-screen text-slate-800 antialiased">
      <nav className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white p-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🏖️</span>
            <h1 className="text-lg font-black tracking-wider uppercase">Lido eWallet <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full lowercase">vercel-v3</span></h1>
          </div>
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-black uppercase">Serverless</span>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-slate-200/70 p-1.5 rounded-2xl flex space-x-1 shadow-inner">
          <button type="button" onClick={() => setTab('reg')} className={`flex-1 py-3 text-sm font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'reg' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>➕ Nuova Scheda</button>
          <button type="button" onClick={() => setTab('topup')} className={`flex-1 py-3 text-sm font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'topup' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'}`}>⚡ Ricarica</button>
        </div>

        {tab === 'reg' ? (
          <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
            <div className="mb-5">
              <h2 className="text-xl font-black text-slate-900">Inizializza Tessera</h2>
              <p className="text-xs text-slate-400 mt-0.5">Assegna un codice UID vergine a un nuovo ospite.</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">1. UID Carta (Passa sul lettore)</label>
                {/* 🔥 Aggiunto onKeyDown per intercettare l'invio del lettore */}
                <input ref={regInputRef} type="text" value={regUid} onChange={(e) => setRegUid(e.target.value)} onKeyDown={handleUidKeyDown} placeholder="In attesa della lettura..." className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">2. Nome Ospite / Ombrellone</label>
                {/* 🔥 Collegato nameInputRef qui */}
                <input ref={nameInputRef} type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Es. Ombrellone 12" className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">3. Carico Denaro Iniziale (€)</label>
                <input type="number" step="0.01" value={regBalance} onChange={(e) => setRegBalance(e.target.value)} className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-blue-600 text-lg text-center outline-none focus:border-blue-500"/>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold p-4 rounded-xl text-sm uppercase tracking-wider mt-2 shadow-md hover:opacity-90 transition-opacity">🚀 Attiva Tessera Vercel</button>
            </form>
          </section>
        ) : (
          <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100">
            <div className="mb-5">
              <h2 className="text-xl font-black text-slate-900">Ricarica Rapida Cassa</h2>
              <p className="text-xs text-slate-400 mt-0.5">Aggiungi credito digitale su una tessera esistente.</p>
            </div>
            <form onSubmit={handleTopup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">UID Carta (Passa sul lettore)</label>
                <input ref={topupInputRef} type="text" value={topupUid} onChange={(e) => setTopupUid(e.target.value)} placeholder="In attesa della lettura..." className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-emerald-500"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Importo Cash da Aggiungere (€)</label>
                <input type="number" step="0.01" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="0.00" className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-emerald-600 text-lg text-center outline-none focus:border-emerald-500"/>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold p-4 rounded-xl text-sm uppercase tracking-wider mt-2 shadow-md hover:opacity-90 transition-opacity">💰 Conferma ed Incassa</button>
            </form>
          </section>
        )}

        <div className="w-full bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-xs h-48 overflow-y-auto border border-slate-800 shadow-lg">
          <h3 className="text-emerald-400 font-bold border-b border-slate-800 pb-1.5 mb-2 flex items-center justify-between">
            <span>💾 Registro Operazioni Cassa (Log Live)</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          </h3>
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">In attesa di letture o ricariche...</div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="py-0.5 border-b border-slate-850 last:border-0 truncate">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {toast.show && (
        <div className={`fixed bottom-6 right-6 text-white px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center space-x-3 z-50 max-w-sm border ${
          toast.isSuccess ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'
        }`}>
          <span className="text-xl">{toast.isSuccess ? '🎉' : '⚠️'}</span>
          <span className="text-sm font-bold tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
