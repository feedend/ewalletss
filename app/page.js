'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function CassaLido() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');

  const [tab, setTab] = useState('reg');
  const [toast, setToast] = useState({ show: false, message: '', isSuccess: true });
  const [logs, setLogs] = useState([]);
  
  // Stati di controllo tessere esistenti
  const [scannedCard, setScannedCard] = useState(null); 
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [settlementMethod, setSettlementMethod] = useState('');
  const [depositReturned, setDepositReturned] = useState(false);

  // Form Stati
  const [regUid, setRegUid] = useState('');
  const [regName, setRegName] = useState('');
  const [regBalance, setRegBalance] = useState('0.00');
  const [topupUid, setTopupUid] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [topupSuccessData, setTopupSuccessData] = useState(null); 
  const [payUid, setPayUid] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payDescription, setPayDescription] = useState('Consumazione Bar');
  const [paySuccessData, setPaySuccessData] = useState(null);

  const regInputRef = useRef(null);
  const nameInputRef = useRef(null);
  const topupInputRef = useRef(null);
  const payInputRef = useRef(null);

  // 🛡️ CONTROLLO AUTENTICAZIONE E RUOLO
  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    const savedName = localStorage.getItem('user_name');

    if (!savedRole) {
      router.push('/login'); 
    } else {
      setRole(savedRole);
      setUsername(savedName || savedRole);
      
      if (savedRole === 'bar') {
        setTab('pay'); 
      } else {
        setTab('reg');
      }
    }
  }, [router]);

  // Gestione focus dei tab
  useEffect(() => {
    setScannedCard(null);
    setTopupSuccessData(null);
    setPaySuccessData(null);
    setRegUid(''); setRegName(''); setTopupUid(''); setTopupAmount(''); setPayUid(''); setPayAmount(''); 
    setPayDescription('Consumazione Bar');

    if (tab === 'reg') regInputRef.current?.focus();
    if (tab === 'topup') topupInputRef.current?.focus();
    if (tab === 'pay') payInputRef.current?.focus();
  }, [tab, role]);

  const handleLogout = () => {
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_name');
    router.push('/login');
  };

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
          showToast("Tessera già occupata!", false);
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
          showToast("Tessera inesistente!", false);
        }
      } catch (err) {
        addLog("❌ Errore lettura dati ricarica.");
      }
    }
  };

  // 🔍 LETTURA SALDO (Tab Pagamento)
  const handlePayUidKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const uidTarget = payUid.trim();
      if (!uidTarget) return;

      setPaySuccessData(null);
      addLog(`🔍 Lettura Saldo per Pagamento Tag [${uidTarget}]...`);
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
          addLog(`🛒 Pronto al pagamento: ${cardInfo.name} | Credito: €${parseFloat(cardInfo.balance).toFixed(2)}`);
        } else {
          setScannedCard(null);
          addLog(`❌ ERRORE: Impossibile pagare. Tag [${uidTarget}] non registrato.`);
          showToast("Tessera non registrata!", false);
        }
      } catch (err) {
        addLog("❌ Errore lettura dati pagamento.");
      }
    }
  };

  // 🚀 ATTIVAZIONE REALE TESSERA
  const handleRegister = async (e) => {
    e.preventDefault();
    if (scannedCard) return;

    const uidTarget = regUid.trim();
    const nameTarget = regName.trim();
    const initialBalance = parseFloat(regBalance) || 0;

    try {
      const res = await fetch('/api/register-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uidTarget, name: nameTarget, balance: initialBalance })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        addLog(`✅ COMPLETATO: ${nameTarget} associato con €${initialBalance.toFixed(2)}`);
        showToast("Tessera attivata con successo!");
        setRegUid(''); setRegName(''); setRegBalance('0.00');
        regInputRef.current?.focus();
      } else {
        showToast(data.error || "Errore salvataggio", false);
      }
    } catch (err) {
      showToast("Errore di connessione server", false);
    }
  };

  // 🗑️ DISASSOCIAZIONE
  const confirmDisassociation = async () => {
    if (role === 'operatore') {
      showToast("Azione non consentita agli operatori standard!", false);
      return;
    }
    try {
      const res = await fetch('/api/delete-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: scannedCard.uid, method: settlementMethod })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast("Tessera disassociata!");
        addLog(`🗑️ ELIMINATA: Liberato UID [${scannedCard.uid}].`);
        setScannedCard(null); setShowDeleteModal(false); setSettlementMethod(''); setDepositReturned(false);
        setRegUid(''); regInputRef.current?.focus();
      }
    } catch (err) {
      showToast("Errore eliminazione", false);
    }
  };

  // 💰 RICARICA SALDO
  const handleTopup = async (e) => {
    e.preventDefault();
    if (!scannedCard) return;

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
        showToast(`Ricarica eseguita!`);
        setTopupUid(''); setTopupAmount(''); setScannedCard(null);
        topupInputRef.current?.focus();
      }
    } catch (err) {
      showToast("Errore ricarica", false);
    }
  };

  // 🛒 PAGAMENTO
  const handlePayment = async (e) => {
    e.preventDefault();
    if (!scannedCard) return;

    const currentBalance = parseFloat(scannedCard.balance);
    const chargeAmount = parseFloat(payAmount) || 0;

    if (chargeAmount > currentBalance) {
      showToast("Credito Insufficiente!", false);
      return;
    }

    try {
      const res = await fetch('/api/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: payUid.trim(), amount: chargeAmount, description: payDescription })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPaySuccessData({
          name: scannedCard.name,
          oldBalance: currentBalance,
          charged: chargeAmount,
          newBalance: parseFloat(data.new_balance)
        });
        showToast(`Pagamento elaborato!`);
        setPayUid(''); setPayAmount(''); setScannedCard(null);
        payInputRef.current?.focus();
      }
    } catch (err) {
      showToast("Errore di invio pagamento", false);
    }
  };

  if (!role) {
    return <div className="bg-slate-950 min-h-screen text-slate-400 flex items-center justify-center font-mono text-xs">Caricamento sessione protetta...</div>;
  }

  return (
    <div className="bg-slate-50 font-sans min-h-screen text-slate-800 antialiased relative">
      <nav className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white p-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-black tracking-wider uppercase">Lido eWallet <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full lowercase">v3.6</span></h1>
          
          <div className="flex items-center space-x-4">
            <span className="text-xs font-bold bg-black/20 px-3 py-1.5 rounded-xl border border-white/10">
              👤 {username.toUpperCase()} (<span className="text-amber-300 font-black">{role}</span>)
            </span>
            <button onClick={handleLogout} className="text-xs font-black bg-rose-600/80 hover:bg-rose-600 px-3 py-1.5 rounded-xl transition-all uppercase tracking-wider">Esci</button>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8 grid grid-cols-1 gap-6 items-start">
        <div className="space-y-6">
          
          <div className="bg-slate-200/70 p-1.5 rounded-2xl flex space-x-1 shadow-inner">
            {(role === 'gestore' || role === 'operatore') && (
              <>
                <button type="button" onClick={() => setTab('reg')} className={`flex-1 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'reg' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>➕ Nuova Scheda</button>
                <button type="button" onClick={() => setTab('topup')} className={`flex-1 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'topup' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'}`}>⚡ Ricarica</button>
              </>
            )}
            {(role === 'gestore' || role === 'bar') && (
              <button type="button" onClick={() => setTab('pay')} className={`flex-1 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'pay' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600'}`}>🛒 Pagamento Bar</button>
            )}
          </div>

          {/* 📋 TAB REGISTRAZIONE */}
          {tab === 'reg' && (role === 'gestore' || role === 'operatore') && (
            <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">1. UID Carta (Passa sul lettore)</label>
                {/* 🔒 Aggiunto maxLength={10} */}
                <input ref={regInputRef} type="text" maxLength={10} value={regUid} onChange={(e) => setRegUid(e.target.value)} onKeyDown={handleUidKeyDown} placeholder="In attesa della lettura..." className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-blue-500"/>
              </div>

              {scannedCard ? (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-center space-y-3">
                  <span className="text-3xl">🛑</span>
                  <h3 className="text-sm font-black text-rose-900 uppercase">Tessera Già Occupata!</h3>
                  <p className="text-xs text-rose-700">Legata a: <b>{scannedCard.name}</b> Saldo: <b>€{parseFloat(scannedCard.balance).toFixed(2)}</b>.</p>
                  
                  {role === 'gestore' ? (
                    <button type="button" onClick={() => setShowDeleteModal(true)} className="w-full bg-rose-600 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider shadow-md hover:bg-rose-700 transition-colors">🗑️ Disassocia ed Elimina Cliente</button>
                  ) : (
                    <div className="bg-amber-100 text-amber-950 text-[11px] font-bold p-2.5 rounded-lg border border-amber-200">Solo l'amministratore/gestore può svuotare e liberare le tessere.</div>
                  )}
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
          {tab === 'topup' && (role === 'gestore' || role === 'operatore') && (
            <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">UID Carta (Passa sul lettore)</label>
                {/* 🔒 Aggiunto maxLength={10} */}
                <input ref={topupInputRef} type="text" maxLength={10} value={topupUid} onChange={(e) => setTopupUid(e.target.value)} onKeyDown={handleTopupUidKeyDown} placeholder="In attesa della lettura..." className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-emerald-500"/>
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
                <button type="submit" disabled={!scannedCard} style={{ backgroundColor: scannedCard ? '#10b981' : '#e2e8f0', color: scannedCard ? '#ffffff' : '#94a3b8', cursor: scannedCard ? 'pointer' : 'not-allowed' }} className="w-full font-bold p-4 rounded-xl text-sm uppercase tracking-wider shadow-md transition-all">💰 Conferma ed Incassa</button>
              </form>

              {topupSuccessData && (
                <div className="mt-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 space-y-3">
                  <h4 className="text-center font-black text-emerald-900 uppercase text-xs tracking-wider">🎉 Transazione Riuscita!</h4>
                  <div className="grid grid-cols-3 gap-2 text-center pt-2">
                    <div><span className="block text-[10px] text-slate-400 uppercase">Vecchio</span><span className="text-sm">€{topupSuccessData.oldBalance.toFixed(2)}</span></div>
                    <div><span className="block text-[10px] text-emerald-600 uppercase">Caricato</span><span className="text-sm font-black text-emerald-600">+€{topupSuccessData.added.toFixed(2)}</span></div>
                    <div><span className="block text-[10px] text-slate-900 uppercase">Nuovo</span><span className="text-base font-black text-slate-900">€{topupSuccessData.newBalance.toFixed(2)}</span></div>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 🛒 TAB PAGAMENTO */}
          {tab === 'pay' && (role === 'gestore' || role === 'bar') && (
            <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">UID Carta da Addebitare (Passa sul lettore)</label>
                {/* 🔒 Aggiunto maxLength={10} */}
                <input ref={payInputRef} type="text" maxLength={10} value={payUid} onChange={(e) => setPayUid(e.target.value)} onKeyDown={handlePayUidKeyDown} placeholder="In attesa della lettura..." className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-purple-500"/>
              </div>

              {scannedCard && (
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex justify-between items-center">
                  <div><span className="text-xs text-slate-400 font-bold uppercase block">Ospite</span><span className="font-black text-slate-800 text-base">{scannedCard.name}</span></div>
                  <div className="text-right"> <span className="text-xs text-slate-400 font-bold uppercase block">Disponibilità</span><span className="font-black text-purple-600 text-xl">€{parseFloat(scannedCard.balance).toFixed(2)}</span></div>
                </div>
              )}

              <form onSubmit={handlePayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Costo Consumazione (€)</label>
                  <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-purple-600 text-lg text-center outline-none focus:border-purple-500"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Causale Spesa</label>
                  <input type="text" disabled={role === 'bar'} value={payDescription} onChange={(e) => setPayDescription(e.target.value)} className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-semibold outline-none focus:border-purple-500 disabled:opacity-60"/>
                </div>
                <button type="submit" disabled={!scannedCard} style={{ backgroundColor: scannedCard ? '#9333ea' : '#e2e8f0', color: scannedCard ? '#ffffff' : '#94a3b8', cursor: scannedCard ? 'pointer' : 'not-allowed' }} className="w-full font-bold p-4 rounded-xl text-sm uppercase tracking-wider shadow-md transition-all">🛒 Conferma Addebito</button>
              </form>

              {paySuccessData && (
                <div className="mt-4 bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 space-y-3">
                  <h4 className="text-center font-black text-purple-900 uppercase text-xs tracking-wider">💳 Addebito Completato!</h4>
                  <div className="grid grid-cols-3 gap-2 text-center pt-2">
                    <div><span className="block text-[10px] text-slate-400 uppercase">Prima</span><span className="text-sm">€{paySuccessData.oldBalance.toFixed(2)}</span></div>
                    <div><span className="block text-[10px] text-purple-600 uppercase">Scalato</span><span className="text-sm font-black text-purple-600">-€{paySuccessData.charged.toFixed(2)}</span></div>
                    <div><span className="block text-[10px] text-slate-900 uppercase">Restante</span><span className="text-base font-black text-slate-900">€{paySuccessData.newBalance.toFixed(2)}</span></div>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* 📋 MONITOR LIVE LOGS COMMENTATO TEMPORANEAMENTE
        <div style={{ backgroundColor: '#0f172a', color: '#e2e8f0' }} className="w-full p-5 rounded-3xl font-mono text-xs h-[460px] overflow-y-auto border border-slate-800 shadow-xl md:sticky md:top-8">
          <h3 className="text-emerald-400 font-bold border-b border-slate-800 pb-2 mb-3 tracking-wide uppercase text-[11px]">💾 Registro Operazioni (Log Live)</h3>
          {logs.length === 0 ? (
            <div className="text-slate-500 italic">In attesa di operazioni...</div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log, i) => (
                <div key={i} className="py-0.5 truncate border-b border-slate-900 last:border-0 text-slate-300">{log}</div>
              ))}
            </div>
          )}
        </div>
        */ }

      </main>

      {/* 🔒 WINDOW MODALE CHIUSURA TESSERA (Solo Gestore) */}
      {showDeleteModal && role === 'gestore' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="text-center">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-lg font-black text-slate-900 mt-2">Chiusura e Riconsegna</h3>
              <p className="text-xs text-slate-500 mt-1">Stai per disassociare la tessera di <b>{scannedCard?.name}</b>.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-600"><span>Contante Residuo:</span><span className="font-bold">€{parseFloat(scannedCard?.balance || 0).toFixed(2)}</span></div>
              <div className="flex justify-between text-xs text-slate-600 border-b border-slate-200 pb-2"><span>Caparra da restituire:</span><span className="font-bold text-blue-600">+ €5.00</span></div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-1"><span>TOTALE DA RENDERE:</span><span className="text-emerald-600 text-base">€{(parseFloat(scannedCard?.balance || 0) + 5.00).toFixed(2)}</span></div>
            </div>

            {scannedCard && parseFloat(scannedCard.balance) > 0 && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase">Metodo Rimborso Saldo</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSettlementMethod('CONTANTI')} className={`p-2 rounded-lg font-bold text-xs uppercase border-2 transition-all ${settlementMethod === 'CONTANTI' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}>💵 Contanti</button>
                  <button type="button" onClick={() => setSettlementMethod('POS')} className={`p-2 rounded-lg font-bold text-xs uppercase border-2 transition-all ${settlementMethod === 'POS' ? 'bg-amber-600 border-amber-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}>💳 POS / Carta</button>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start space-x-3">
              <input type="checkbox" id="checkCaparra" checked={depositReturned} onChange={(e) => setDepositReturned(e.target.checked)} className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"/>
              <label htmlFor="checkCaparra" className="text-[11px] text-blue-950 font-medium leading-tight cursor-pointer select-none"><b>Ho ritirato la tessera fisica</b> e confermo di aver restituito i <b>€5.00</b> di caparra al cliente.</label>
            </div>

            <div className="flex space-x-2 pt-2">
              <button type="button" onClick={() => { setShowDeleteModal(false); setSettlementMethod(''); setDepositReturned(false); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold p-3 rounded-xl text-xs uppercase tracking-wider transition-colors">Annulla</button>
              <button type="button" onClick={confirmDisassociation} disabled={(parseFloat(scannedCard?.balance || 0) > 0 && !settlementMethod) || !depositReturned} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed">Sì, Cancella</button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ TOAST SYSTEM */}
      {toast.show && (
        <div style={{ backgroundColor: toast.isSuccess ? '#10b981' : '#ef4444', borderColor: toast.isSuccess ? '#059669' : '#dc2626', color: '#ffffff' }} className="fixed bottom-6 right-6 px-6 py-4 rounded-2xl shadow-2xl font-bold flex items-center space-x-3 z-50 max-w-sm border">
          <span className="text-xl">{toast.isSuccess ? '🎉' : '⚠️'}</span><span className="text-sm font-bold tracking-wide text-white">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
