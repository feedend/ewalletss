'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function CassaLido() {
  const router = useRouter();
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState('');

  const [tab, setTab] = useState('reg');
  const [toast, setToast] = useState({ show: false, message: '', isSuccess: true });
  
  const toastTimeoutRef = useRef(null);

  // Stati di controllo tessere
  const [scannedCard, setScannedCard] = useState(null); 
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [depositReturned, setDepositReturned] = useState(false);
  const [loadingTag, setLoadingTag] = useState(false);

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

  // 🛡️ AUTENTICAZIONE
  useEffect(() => {
    const savedRole = localStorage.getItem('user_role');
    const savedName = localStorage.getItem('user_name');

    if (!savedRole) {
      router.push('/login'); 
    } else {
      const normalizedRole = savedRole.toLowerCase();
      setRole(normalizedRole);
      setUsername(savedName || normalizedRole);
      
      if (normalizedRole === 'bar') {
        setTab('pay'); 
      } else {
        setTab('reg');
      }
    }

    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [router]);

  // Gestione reset al cambio TAB
  useEffect(() => {
    setScannedCard(null);
    setTopupSuccessData(null);
    setPaySuccessData(null);
    setRegUid(''); setRegName(''); setTopupUid(''); setTopupAmount(''); setPayUid(''); setPayAmount(''); 
    setRegBalance('0.00');
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

  const showToast = (message, isSuccess = true) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ show: true, message, isSuccess });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, message: '', isSuccess: true });
    }, 4500);
  };

  // 📱 TASTIERINO VIRTUALE
  const handleVirtualKeypad = (key, currentStr, setStr) => {
    let cleanStr = currentStr === '0.00' || currentStr === '0' ? '' : currentStr;
    
    if (key === '⌫') {
      const updated = currentStr.slice(0, -1);
      setStr(updated === '' ? '0.00' : updated);
      return;
    }
    if (key === '.') {
      if (cleanStr.includes('.')) return;
      if (!cleanStr) { setStr('0.'); return; }
    }
    if (cleanStr.includes('.')) {
      const [_, decimal] = cleanStr.split('.');
      if (decimal && decimal.length >= 2) return;
    }
    setStr(cleanStr + key);
  };

  // 🔄 LETTURA TAG CENTRALIZZATA
  const fetchTagData = async (uidTarget) => {
    if (!uidTarget) return null;
    setLoadingTag(true);
    try {
      const res = await fetch('/api/get-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uidTarget.trim() })
      });
      const data = await res.json();
      setLoadingTag(false);

      if (res.ok && data.success && data.exists) {
        return {
          uid: uidTarget.trim(),
          name: data.customer?.name || 'Ospite Sconosciuto',
          balance: data.customer?.balance || 0,
          id: data.customer?.id, 
          exists: true
        };
      }
      return { exists: false, error: data.error };
    } catch (err) {
      setLoadingTag(false);
      showToast("Errore di connessione al server", false);
      return null;
    }
  };

  // LISTENERS TASTO ENTER & RICERCA
  const handleUidSearch = async (uidTarget, targetTab) => {
    if (!uidTarget.trim()) return;
    const cardInfo = await fetchTagData(uidTarget);
    if (!cardInfo) return;

    if (targetTab === 'reg') {
      if (cardInfo.exists) {
        setScannedCard(cardInfo);
        showToast("Tessera già occupata!", false);
      } else {
        setScannedCard(null);
        nameInputRef.current?.focus(); 
      }
    } else {
      if (cardInfo.exists) {
        setScannedCard(cardInfo);
      } else {
        setScannedCard(null);
        showToast("Tessera non registrata!", false);
      }
    }
  };

  // 🚀 ATTIVAZIONE NUOVA TESSERA
  const handleRegister = async (e) => {
    if (e) e.preventDefault();
    if (scannedCard) return;

    const uidTarget = regUid.trim();
    const nameTarget = regName.trim();
    const initialBalance = parseFloat(regBalance) || 0;

    if (!uidTarget || !nameTarget) {
      showToast("Compila tutti i campi!", false);
      return;
    }

    try {
      const res = await fetch('/api/register-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: uidTarget, name: nameTarget, balance: initialBalance })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast("Tessera attivata con successo!");
        setRegUid(''); setRegName(''); setRegBalance('0.00');
        regInputRef.current?.focus();
      } else {
        showToast(data.error || "Errore salvataggio registrazione", false);
      }
    } catch (err) {
      showToast("Errore di connessione server", false);
    }
  };

  // 🗑️ DISASSOCIAZIONE / ELIMINAZIONE
  const confirmDisassociation = async (method) => {
    if (role === 'operatore') {
      showToast("AZIONE NON CONSENTITA PER L'OPERATORE", false);
      return;
    }
    if (!scannedCard?.uid) {
      showToast("Nessuna tessera selezionata!", false);
      return;
    }

    try {
      const res = await fetch('/api/delete-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: scannedCard.uid, method: method })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast("Tessera disassociata con successo!");
        setScannedCard(null); 
        setShowDeleteModal(false); 
        setDepositReturned(false);
        setRegUid(''); 
        regInputRef.current?.focus();
      } else {
        showToast(data.error || "Errore durante la disassociazione", false);
      }
    } catch (err) { 
      showToast("Errore di rete durante l'eliminazione", false); 
    }
  };

  // 💰 RICARICA
  const handleTopup = async (e) => {
    if (e) e.preventDefault(); 
    if (!scannedCard) {
      showToast("Nessuna tessera associata trovata", false);
      return;
    }

    const amountNum = parseFloat(topupAmount) || 0;
    if (amountNum <= 0) {
      showToast("Inserisci un importo valido", false);
      return;
    }

    try {
      const res = await fetch('/api/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: topupUid.trim() || scannedCard.uid, amount: amountNum })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setTopupSuccessData({ 
          name: scannedCard.name, 
          oldBalance: parseFloat(scannedCard.balance), 
          added: amountNum, 
          newBalance: parseFloat(data.new_balance) 
        });
        showToast(`Ricarica eseguita!`); 
        setTopupUid(''); setTopupAmount(''); setScannedCard(null); 
        topupInputRef.current?.focus();
      } else {
        showToast(data.error || "Errore durante la ricarica", false);
      }
    } catch (err) { 
      showToast("Errore di connessione al server", false); 
    }
  };

  // 🛒 PAGAMENTO
  const handlePayment = async (e) => {
    if (e) e.preventDefault(); 
    if (!scannedCard) {
      showToast("Nessuna tessera letta!", false);
      return;
    }

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
        body: JSON.stringify({ uid: payUid.trim() || scannedCard.uid, amount: chargeAmount, description: payDescription })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setPaySuccessData({ 
          name: scannedCard.name, 
          oldBalance: currentBalance, 
          charged: chargeAmount, 
          newBalance: parseFloat(data.new_balance) 
        });
        showToast(`Pagamento addebitato!`); 
        setPayUid(''); setPayAmount(''); setScannedCard(null); 
        payInputRef.current?.focus();
      } else {
        showToast(data.error || "Errore addebito pagamento", false);
      }
    } catch (err) { 
      showToast("Errore di invio pagamento", false); 
    }
  };

  if (!role) {
    return <div className="bg-slate-950 min-h-screen text-slate-400 flex items-center justify-center font-mono text-xs">Caricamento sessione protetta...</div>;
  }

  return (
    <div className="bg-slate-50 font-sans min-h-screen text-slate-800 antialiased relative pb-12">
      <nav className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 text-white p-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="text-lg font-black tracking-wider uppercase">Lido Cassa Cashless <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full lowercase">v4.1-pos</span></h1>
          <div className="flex items-center space-x-4">
            <span className="text-xs font-bold bg-black/20 px-3 py-1.5 rounded-xl border border-white/10">👤 {username.toUpperCase()} (<span className="text-amber-300 font-black">{role}</span>)</span>
            <button onClick={handleLogout} className="text-xs font-black bg-rose-600/80 hover:bg-rose-600 px-3 py-1.5 rounded-xl transition-all uppercase tracking-wider">Esci</button>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6 grid grid-cols-1 gap-6 items-start">
        <div className="space-y-6">
          <div className="bg-slate-200/70 p-1.5 rounded-2xl flex space-x-1 shadow-inner">
            {(role === 'gestore' || role === 'operatore') && (
              <>
                <button type="button" onClick={() => setTab('reg')} className={`flex-1 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'reg' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}>➕ Nuova Scheda</button>
                <button type="button" onClick={() => setTab('topup')} className={`flex-1 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'topup' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'}`}>⚡ Ricarica</button>
              </>
            )}
            {(role === 'gestore' || role === 'bar') && (
              <button type="button" onClick={() => setTab('pay')} className={`flex-1 py-3 text-xs font-black tracking-wide uppercase rounded-xl transition-all ${tab === 'pay' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-600'}`}>🛒 Pagamento</button>
            )}
          </div>

          {/* TAB REGISTRAZIONE */}
          {tab === 'reg' && (role === 'gestore' || role === 'operatore') && (
            <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">1. UID Carta (Passa sul lettore o digita)</label>
                <div className="flex gap-2">
                  <input 
                    ref={regInputRef} 
                    type="text" 
                    maxLength={15} 
                    value={regUid} 
                    onChange={(e) => setRegUid(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleUidSearch(regUid, 'reg')} 
                    placeholder="In attesa della lettura..." 
                    className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-blue-500"
                  />
                  <button type="button" onClick={() => handleUidSearch(regUid, 'reg')} className="bg-blue-600 text-white font-bold px-4 rounded-xl text-xs uppercase">Cerca</button>
                </div>
              </div>

              {scannedCard ? (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4 text-center space-y-3">
                  <span className="text-3xl">🛑</span>
                  <h3 className="text-sm font-black text-rose-900 uppercase">Tessera Già Occupata!</h3>
                  <p className="text-xs text-rose-700">Legata a: <b>{scannedCard.name}</b> - Saldo: <b>€{parseFloat(scannedCard.balance).toFixed(2)}</b>.</p>
                  {role === 'gestore' ? (
                    <button type="button" onClick={() => setShowDeleteModal(true)} className="w-full bg-rose-600 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider shadow-md hover:bg-rose-700 transition-colors">🗑️ Disassocia ed Elimina Cliente</button>
                  ) : (
                    <div className="bg-amber-100 text-amber-950 text-[11px] font-bold p-2.5 rounded-lg border border-amber-200">Solo l'amministratore/gestore può liberare le tessere.</div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">2. Nome Ospite / Ombrellone</label>
                      <input ref={nameInputRef} type="text" value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Es. Mario Rossi / Ombrellone 15" className="w-full p-3.5 bg-white border-2 border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold"/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">3. Carico Denaro Iniziale (€)</label>
                      <input type="text" value={regBalance} readOnly className="w-full p-3 bg-white border-2 border-slate-200 rounded-xl font-black text-blue-600 text-xl text-center outline-none"/>
                    </div>
                  </div>

                  <div className="bg-slate-100/80 p-3 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/60">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                      <button key={key} type="button" onClick={() => handleVirtualKeypad(key, regBalance, setRegBalance)} className={`py-3.5 text-lg font-black rounded-xl border transition-all active:scale-95 ${key === '⌫' ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-white text-slate-800 border-slate-200 shadow-sm'}`}>{key}</button>
                    ))}
                  </div>
                  <button type="button" onClick={() => handleRegister()} disabled={!regUid || !regName.trim()} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 disabled:opacity-30 disabled:pointer-events-none text-white font-bold p-4 rounded-xl text-sm uppercase tracking-wider shadow-md active:scale-[0.98] transition-all">🚀 Attiva Nuova Tessera</button>
                </div>
              )}
            </section>
          )}

          {/* TAB RICARICA */}
          {tab === 'topup' && (role === 'gestore' || role === 'operatore') && (
            <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">UID Carta (Passa sul lettore)</label>
                <div className="flex gap-2">
                  <input 
                    ref={topupInputRef} 
                    type="text" 
                    maxLength={15} 
                    value={topupUid} 
                    onChange={(e) => setTopupUid(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleUidSearch(topupUid, 'topup')} 
                    placeholder="In attesa della lettura..." 
                    className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-emerald-500"
                  />
                  <button type="button" onClick={() => handleUidSearch(topupUid, 'topup')} className="bg-emerald-600 text-white font-bold px-4 rounded-xl text-xs uppercase">Verifica</button>
                </div>
              </div>

              {loadingTag && <div className="text-center text-xs font-bold text-slate-400">Verifica tessera in corso...</div>}

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

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Importo Cash da Aggiungere (€)</label>
                  <input type="text" value={topupAmount} readOnly placeholder="0.00" className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-emerald-600 text-2xl text-center outline-none"/>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {['10', '20', '50', '100'].map(val => (
                    <button key={val} type="button" onClick={() => setTopupAmount(val)} className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-black py-2.5 rounded-xl text-xs active:scale-95 transition-all">+{val}€</button>
                  ))}
                </div>
                <div className="bg-slate-100/80 p-3 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/60">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                    <button key={key} type="button" onClick={() => handleVirtualKeypad(key, topupAmount, setTopupAmount)} className={`py-3.5 text-lg font-black rounded-xl border transition-all active:scale-95 ${key === '⌫' ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-white text-slate-800 border-slate-200 shadow-sm'}`}>{key}</button>
                  ))}
                </div>
                <button type="button" onClick={() => handleTopup()} disabled={!scannedCard || !topupAmount || parseFloat(topupAmount) <= 0} className={`w-full font-bold p-4 rounded-xl text-sm uppercase tracking-wider shadow-md transition-all active:scale-[0.98] ${scannedCard && parseFloat(topupAmount) > 0 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}>💰 Conferma ed Incassa</button>
              </div>

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

          {/* TAB PAGAMENTO */}
          {tab === 'pay' && (role === 'gestore' || role === 'bar') && (
            <section className="bg-white p-6 rounded-3xl shadow-xl border border-slate-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">UID Carta da Addebitare</label>
                <div className="flex gap-2">
                  <input 
                    ref={payInputRef} 
                    type="text" 
                    maxLength={15} 
                    value={payUid} 
                    onChange={(e) => setPayUid(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleUidSearch(payUid, 'pay')} 
                    placeholder="In attesa della lettura..." 
                    className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-mono font-bold text-center tracking-widest outline-none focus:border-purple-500"
                  />
                  <button type="button" onClick={() => handleUidSearch(payUid, 'pay')} className="bg-purple-600 text-white font-bold px-4 rounded-xl text-xs uppercase">Verifica</button>
                </div>
              </div>

              {scannedCard && (
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 flex justify-between items-center">
                  <div><span className="text-xs text-slate-400 font-bold uppercase block">Ospite</span><span className="font-black text-slate-800 text-base">{scannedCard.name}</span></div>
                  <div className="text-right"> <span className="text-xs text-slate-400 font-bold uppercase block">Disponibilità</span><span className="font-black text-purple-600 text-xl">€{parseFloat(scannedCard.balance).toFixed(2)}</span></div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Costo Consumazione (€)</label>
                  <input type="text" value={payAmount} readOnly placeholder="0.00" className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-black text-purple-600 text-2xl text-center outline-none"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Causale Spesa</label>
                  <select value={payDescription} onChange={(e) => setPayDescription(e.target.value)} className="w-full p-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl font-semibold text-slate-800 bg-white outline-none focus:border-purple-500">
                    <option value="Consumazione Bar">Consumazione Bar</option>
                    <option value="Consumazione Ristorante">Consumazione Ristorante</option>
                    <option value="Pagamento Ingresso">Pagamento Ingresso</option>
                  </select>
                </div>

                <div className="bg-slate-100/80 p-3 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200/60">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((key) => (
                    <button key={key} type="button" onClick={() => handleVirtualKeypad(key, payAmount, setPayAmount)} className={`py-3.5 text-lg font-black rounded-xl border transition-all active:scale-95 ${key === '⌫' ? 'bg-rose-100 text-rose-600 border-rose-200' : 'bg-white text-slate-800 border-slate-200 shadow-sm'}`}>{key}</button>
                  ))}
                </div>
                <button type="button" onClick={() => handlePayment()} disabled={!scannedCard || !payAmount || parseFloat(payAmount) <= 0} className={`w-full font-bold p-4 rounded-xl text-sm uppercase tracking-wider shadow-md transition-all active:scale-[0.98] ${scannedCard && parseFloat(payAmount) > 0 ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}`}>🛒 Conferma Addebito</button>
              </div>

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
      </main>

      {/* WINDOW MODALE CHIUSURA TESSERA */}
      {showDeleteModal && role === 'gestore' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-5 text-white relative z-50">
            <div className="text-center space-y-1">
              <span className="text-4xl">⚠️</span>
              <h3 className="text-lg font-black text-white uppercase tracking-wider mt-2">Chiusura e Riconsegna</h3>
              <p className="text-xs text-slate-400">Stai per disassociare la tessera di <b className="text-sky-400">{scannedCard?.name}</b>.</p>
            </div>
            
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Contante Residuo:</span>
                <span className="font-bold text-white">€{parseFloat(scannedCard?.balance || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-300 border-b border-white/10 pb-2">
                <span>Caparra da restituire:</span>
                <span className="font-bold text-blue-400">+ €5.00</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white pt-1">
                <span>TOTALE DA RENDERE:</span>
                <span className="text-emerald-400 text-base font-black">€{(parseFloat(scannedCard?.balance || 0) + 5.00).toFixed(2)}</span>
              </div>
            </div>

            {scannedCard && parseFloat(scannedCard.balance) > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Metodo di Rimborso</p>
                <p className="text-xs text-slate-300 font-bold mt-0.5">💵 Solo Contanti (Cash Only)</p>
              </div>
            )}

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-start space-x-3">
              <input type="checkbox" id="checkCaparra" checked={depositReturned} onChange={(e) => setDepositReturned(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-white/20 bg-slate-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-900 cursor-pointer" />
              <label htmlFor="checkCaparra" className="text-[11px] text-slate-300 font-medium leading-tight cursor-pointer select-none">
                Ho ritirato la <b className="text-white">tessera fisica</b> e confermo di aver restituito i <b className="text-blue-400">€5.00</b> di caparra ed il Credito Residuo al cliente.
              </label>
            </div>

            <div className="flex space-x-2 pt-1">
              <button type="button" onClick={() => { setShowDeleteModal(false); setDepositReturned(false); }} className="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold p-3 rounded-xl text-xs uppercase tracking-wider transition-colors border border-white/10">Annulla</button>
              <button type="button" onClick={() => confirmDisassociation('CONTANTI')} disabled={!depositReturned} className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white font-bold p-3 rounded-xl text-xs uppercase tracking-wider shadow-md transition-all disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed disabled:shadow-none">💵 Rimborsa e Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST COMPONENT */}
      {toast.show && (
        <div className={`fixed bottom-5 right-5 z-50 flex items-center p-4 rounded-2xl shadow-2xl border text-xs font-black uppercase tracking-wider transition-all duration-300 transform translate-y-0 ${
          toast.isSuccess 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          <span className="mr-2 text-sm">{toast.isSuccess ? '✅' : '🛑'}</span>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
