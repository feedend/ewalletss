'use client';

import React, { useState, useEffect, useRef } from 'react';

export default function CassaLido() {
  const [tab, setTab] = useState('reg');
  const [toast, setToast] = useState({ show: false, message: '', isSuccess: true });
  const [logs, setLogs] = useState([]);
  
  // Stati di controllo tessere esistenti
  const [scannedCard, setScannedCard] = useState(null); 
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [settlementMethod, setSettlementMethod] = useState('');

  // Form Reg
  const [regUid, setRegUid] = useState('');
  const [regName, setRegName] = useState('');
  const [regBalance, setRegBalance] = useState('0.00');
  
  // Form Topup
  const [topupUid, setTopupUid] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupSuccessData, setTopupSuccessData] = useState(null); 

  const regInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const topupInputRef = useRef(null);

  useEffect(() => {
    setScannedCard(null);
    setTopupSuccessData(null);
    setRegUid(''); setRegName(''); setTopupUid(''); setTopupAmount('');
    
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

  // 🔍 VERIFICA UID (Tab Registrazione)
  const handleUidKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const uidTarget = regUid.trim();
      if (!uidTarget) return;

      addLog(`🔍 Verifica integrità Tag [${uidTarget}]...`);
      try {
        const res = await fetch('/api/get-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: uidTarget })
        });
        const data = await res.json();

        if (data.success && data.exists) {
          const cardInfo = {
            uid: uidTarget,
            name: data.customer?.name || 'Ospite Sconosciuto',
            balance: data.customer?.balance || 0,
            id: data.customer?.id
          };
          setScannedCard(cardInfo);
          addLog(`⚠️ BLOCCO: Il Tag [${uidTarget}] è già assegnato a ${cardInfo.name} con €${parseFloat(cardInfo.balance).toFixed(2)}!`);
          showToast("Tessera già occupata! Richiesta disassociazione.", false);
        } else {
          setScannedCard(null);
          addLog(`🟢 Tag [${uidTarget}] vergine. Pronto per l'assegnazione.`);
          nameInputRef.current?.focus(); 
        }
      } catch (err) {
        addLog("❌ Errore durante il controllo del Tag.");
      }
    }
  };

  // 🔍 LETTURA SALDO (Tab Ricarica)
  const handleTopupUidKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const uidTarget = topupUid.trim();
      if (!uidTarget) return;

      setTopupSuccessData(null);
      addLog(`🔍 Lettura Saldo per il Tag [${uidTarget}]...`);
      try {
        const res = await fetch('/api/get-tag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: uidTarget })
        });
        const data = await res.json();

        if (data.success && data.exists) {
          const cardInfo = {
            uid: uidTarget,
            name: data.customer?.name || 'Ospite Sconosciuto',
            balance: data.customer?.balance || 0,
            id: data.customer?.id
          };
          setScannedCard(cardInfo);
          addLog(`👤 Cliente trovato: ${cardInfo.name} | Saldo Attuale: €${parseFloat(cardInfo.balance).toFixed(2)}`);
        } else {
          setScannedCard(null);
          addLog(`❌ ERRORE: Nessun cliente associato al Tag [${uidTarget}].`);
          showToast("Tessera inesistente! Registrala prima.", false);
        }
      } catch (err) {
        addLog("❌ Errore lettura dati ricarica.");
      }
    }
  };

  // 🚀 ATTIVAZIONE REALE TESSERA
  const handleRegister = async (e) => {
    e.preventDefault();
    if (scannedCard) {
      showToast("Azione bloccata. Devi prima liberare la tessera!", false);
      return;
    }

    const uidTarget = regUid.trim();
    const nameTarget = regName.trim();
    const initialBalance = parseFloat(regBalance) || 0;

    if (!uidTarget) {
      showToast("Passa la tessera sul lettore!", false);
      return;
    }
    if (!nameTarget) {
      showToast("Inserisci il nome prima di registrare!", false);
      return;
    }

    addLog(`⏳ Invio dati di registrazione a Vercel per [${nameTarget}]...`);

    try {
      const res = await fetch('/api/register-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: uidTarget,
          name: nameTarget,
          balance: initialBalance 
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        addLog(`✅ COMPLETATO: ${nameTarget} associato al Tag [${uidTarget}] con credito iniziale €${initialBalance.toFixed(2)}`);
        showToast("Tessera attivata con successo!");
        
        setRegUid(''); setRegName(''); setRegBalance('0.00');
        regInputRef.current?.focus();
      } else {
        addLog(`❌ REGISTRAZIONE FALLITA: ${data.error || 'Errore sconosciuto'}`);
        showToast(data.error || "Errore durante il salvataggio", false);
      }
    } catch (err) {
      addLog("❌ Errore di rete: impossibile raggiungere l'API.");
      showToast("Errore di connessione server", false);
    }
  };

  // 🗑️ DISASSOCIAZIONE & CANCELLAZIONE REALE (CON CONTROLLO ERRORI)
  const confirmDisassociation = async () => {
    if (parseFloat(scannedCard.balance) > 0 && !settlementMethod) {
      showToast("Seleziona il metodo di rimborso obbligatorio!", false);
      return;
    }

    addLog(`⏳ Invio richiesta di eliminazione per UID [${scannedCard.uid}]...`);
    try {
      const res = await fetch('/api/delete-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: scannedCard.uid, method: settlementMethod })
      });
      
      const data = await res.json();

      if (res.ok && data.success) {
        showToast("Tessera disassociata e tornata vergine!");
        addLog(`🗑️ ELIMINATA: Liberato UID [${scannedCard.uid}]. Rimborso: ${settlementMethod || 'Nessuno (Saldo 0)'}`);
        
        // Reset stati completato con successo
        setScannedCard(null);
        setShowDeleteModal(false);
        setSettlementMethod('');
        setRegUid('');
        regInputRef.current?.focus();
      } else {
        // Se il backend risponde con un errore (es. riga bloccata o vincolo DB)
        addLog(`❌ ERRORE ELIMINAZIONE BACKEND: ${data.error || 'Impossibile eliminare'}`);
        showToast(data.error || "Il server ha rifiutato l'eliminazione", false);
      }
    } catch (err) {
      addLog("❌ Errore di rete durante la disassociation.");
      showToast("Errore di connessione al server", false);
    }
  };

  // 💰 RICARICA SALDO
  const handleTopup = async (e) => {
    e.preventDefault();
    if (!scannedCard) {
      showToast("Passa prima una tessera valida!", false);
      return;
    }

    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: topupUid.trim(), amount: topupAmount })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTopupSuccessData({
          name: scannedCard.name,
          oldBalance: parseFloat(scannedCard.balance),
          added: parseFloat(topupAmount),
          newBalance: parseFloat(data.new_balance)
        });

        showToast(`Ricarica eseguita con successo!`);
        addLog(`💰 AGGIORNATO: ${scannedCard.name} -> Nuovo Saldo: €${parseFloat(data.new_balance).toFixed(2)}`);
        
        setTopupUid(''); setTopupAmount(''); setScannedCard(null);
        topupInputRef.current?.focus();
      } else {
        addLog(`❌ ERRORE RICARICA: ${data.error || 'Errore sconosciuto'}`);
        showToast(data.error || "Ricarica fallita", false);
      }
    } catch (err) {
      showToast("Errore serverless", false);
    }
  };

  return (
    <div className="bg-slate-50 font-sans min-h-screen text-slate-800 antialiased relative">
      <nav className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white p-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-black tracking-wider uppercase">Lido eWallet <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full lowercase">v3.6-stable</span></h1>
        </div>
      </nav>

      {/* 📦 NUOVO LAYOUT GRIGLIA AFFIANCATA */}
      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* COLONNA SINISTRA: PANNELLI OPERATIVI */}
        <div className="space-y-6">
          <div className="bg-slate-200/70 p-1.5 rounded-2xl flex space-x-1 shadow-inner">
            <button type="button" onClick={() => setTab('reg')} className={`flex-1 py-3 text-sm font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'reg' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>➕ Nuova Scheda</button>
            <button type="button" onClick={() => setTab('topup')} className={`flex-1 py-3 text-sm font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'topup' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'}`}>⚡ Ricarica</button>
          </div>

          {/* 📋 TAB REGISTRAZIONE */}
          {tab === 'reg' && (
            <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">1. UID Carta (Passa sul lettore)</label>
                <input ref={regInputRef} type="text" value={regUid} onChange={(e) => setRegUid(e.target.value)} onKeyDown={handleUidKeyDown} placeholder="In attesa della lettura..." className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-blue-500"/>
              </div>

              {scannedCard ? (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-center space-y-3">
                  <span className="text-3xl">🛑</span>
                  <h3 className="text-sm font-black text-rose-900 uppercase">Tessera Già Assegnata!</h3>
                  <p className="text-xs text-rose-700">Questa tessera è legata a: <b>{scannedCard.name}</b> con un saldo attivo di <b>€{parseFloat(scannedCard.balance).toFixed(2)}</b>.</p>
                  <button type="button" onClick={() => setShowDeleteModal(true)} className="w-full bg-rose-600 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider shadow-md hover:bg-rose-700 transition-colors">🗑️ Disassocia ed Elimina Cliente</button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">2. Nome Ospite / Ombrellone</label>
                    <input ref={nameInputRef} type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Es. Ombrellone 12" className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500"/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">3. Carico Denaro Iniziale (€)</label>
                    <input type="number" step="0.01" value={regBalance} onChange={(e) => setRegBalance(e.target.value)} className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-blue-600 text-lg text-center outline-none focus:border-blue-500"/>
                  </div>
                  <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold p-4 rounded-xl text-sm uppercase tracking-wider shadow-md">🚀 Attiva Nuova Tessera</button>
                </form>
              )}
            </section>
          )}

          {/* 💰 TAB RICARICA */}
          {tab === 'topup' && (
            <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">UID Carta (Passa sul lettore)</label>
                <input ref={topupInputRef} type="text" value={topupUid} onChange={(e) => setTopupUid(e.target.value)} onKeyDown={handleTopupUidKeyDown} placeholder="In attesa della lettura..." className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-emerald-500"/>
              </div>

              {scannedCard && (
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase block">Intestatario</span>
                    <span className="font-black text-slate-800 text-base">{scannedCard.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-400 font-bold uppercase block">Saldo Corrente</span>
                    <span className="font-black text-amber-500 text-xl">€{parseFloat(scannedCard.balance).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <form onSubmit={handleTopup} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Importo Cash da Aggiungere (€)</label>
                  <input type="number" step="0.01" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} placeholder="0.00" className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-emerald-600 text-lg text-center outline-none focus:border-emerald-500"/>
                </div>
                
                <button 
                  type="submit" 
                  disabled={!scannedCard} 
                  style={{ 
                    backgroundColor: scannedCard ? '#10b981' : '#e2e8f0', 
                    color: scannedCard ? '#ffffff' : '#94a3b8',
                    cursor: scannedCard ? 'pointer' : 'not-allowed'
                  }} 
                  className="w-full font-bold p-4 rounded-xl text-sm uppercase tracking-wider shadow-md transition-all"
                >
                  💰 Conferma ed Incassa
                </button>
              </form>

              {topupSuccessData && (
                <div className="mt-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-3">
                  <h4 className="text-center font-black text-emerald-900 uppercase text-xs tracking-wider">🎉 Transazione Riuscita con Successo!</h4>
                  <div className="grid grid-cols-3 gap-2 text-center border-t border-emerald-200/60 pt-3">
                    <div>
                      <span className="block text-[10px] font-bold text-emerald-700 uppercase">Saldo Vecchio</span>
                      <span className="font-mono text-sm text-slate-600">€{topupSuccessData.oldBalance.toFixed(2)}</span>
                    </div>
                    <div className="bg-emerald-200/50 rounded-lg py-1">
                      <span className="block text-[10px] font-bold text-emerald-800 uppercase">Caricato</span>
                      <span className="font-black text-sm text-emerald-700">+€{topupSuccessData.added.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-emerald-700 uppercase">Nuovo Saldo</span>
                      <span className="font-mono text-base font-black text-slate-900">€{topupSuccessData.newBalance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* COLONNA DESTRA: TERMINALE DEI LOG AFFIANCATO */}
        <div 
          style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }} 
          className="w-full p-5 rounded-3xl font-mono text-xs h-[460px] overflow-y-auto border border-slate-800 shadow-xl md:sticky md:top-8"
        >
          <h3 className="text-emerald-400 font-bold border-b border-slate-800 pb-2 mb-3 tracking-wide uppercase text-[11px]">💾 Registro Operazioni Cassa (Log Live)</h3>
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">In attesa di operazioni...</div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log, i) => (
                <div key={i} className="py-0.5 truncate border-b border-slate-900 last:border-0 text-slate-300">
                  {log}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* FINESTRA MODALE DI CONFERMA ELIMINAZIONE */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="text-center">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-lg font-black text-slate-900 mt-2">Conferma Disassociazione</h3>
              <p className="text-xs text-slate-500 mt-1">Stai per azzerare la tessera di <b>{scannedCard?.name}</b>.</p>
            </div>

            {scannedCard && parseFloat(scannedCard.balance) > 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
                <p className="text-[11px] text-amber-800 font-bold text-center">Il cliente ha un credito residuo di €{parseFloat(scannedCard.balance).toFixed(2)}! Come lo stai rimborsando?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSettlementMethod('CONTANTI')} className={`p-2 rounded-lg font-bold text-xs uppercase border-2 transition-all ${settlementMethod === 'CONTANTI' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}>💵 Contanti</button>
                  <button type="button" onClick={() => setSettlementMethod('POS')} className={`p-2 rounded-lg font-bold text-xs uppercase border-2 transition-all ${settlementMethod === 'POS' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}>💳 POS / Carta</button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 p-2 rounded-lg text-center">La tessera ha saldo €0.00, puoi procedere liberamente.</p>
            )}

            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => { setShowDeleteModal(false); setSettlementMethod(''); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-3 rounded-xl text-xs uppercase tracking-wider transition-colors">Annulla</button>
              <button type="button" onClick={confirmDisassociation} disabled={parseFloat(scannedCard?.balance || 0) > 0 && !settlementMethod} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors disabled:opacity-40">Sì, Cancella</button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ TOAST SYSTEM CORRETTO CON INLINE STYLES FORZATI CONTRO SFONDO BIANCO */}
      {toast.show && (
        <div 
          style={{ 
            backgroundColor: toast.isSuccess ? '#10b981' : '#ef4444', 
            borderColor: toast.isSuccess ? '#059669' : '#dc2626',
            color: '#ffffff'
          }}
          className="fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center space-x-3 z-50 max-w-sm border"
        >
          <span className="text-xl">{toast.isSuccess ? '🎉' : '⚠️'}</span>
          <span className="text-sm font-bold tracking-wide text-white">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
