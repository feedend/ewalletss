'use client';

import { useState } from 'react';

export default function StoricoClientePage() {
  const [cardUid, setCardUid] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Dati cliente autenticato
  const [customerData, setCustomerData] = useState(null);
  const [transactions, setTransactions] = useState([]);

  // Chiamata all'API di login / consultazione
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!cardUid.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/customer-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: cardUid })
      });

      const data = await res.json();

      if (data.success) {
        setCustomerData(data.customer);
        setTransactions(data.transactions);
      } else {
        setErrorMsg(data.error || 'Carta non trovata');
      }
    } catch (err) {
      setErrorMsg('Errore di connessione. Riprova più tardi.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCustomerData(null);
    setTransactions([]);
    setCardUid('');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans text-slate-800">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Intestazione */}
        <div className="bg-blue-600 p-6 text-white text-center">
          <h1 className="text-2xl font-black uppercase tracking-wider">Storico E-Wallet</h1>
          <p className="text-blue-100 text-sm mt-1">Consulta saldo e movimenti della tua carta</p>
        </div>

        {/* VISTA 1: FORM DI ACCESSO */}
        {!customerData ? (
          <form onSubmit={handleLogin} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Numero Carta (UID)
              </label>
              <input
                type="text"
                value={cardUid}
                onChange={(e) => setCardUid(e.target.value)}
                placeholder="Es. 0076100748"
                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl text-center text-xl font-bold tracking-widest text-slate-800 focus:border-blue-500 focus:outline-none transition-all"
                required
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-semibold text-center">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-black text-lg rounded-xl shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
            >
              {loading ? 'Verifica in corso...' : 'CONSULTA STORICO'}
            </button>
          </form>
        ) : (
          
        /* VISTA 2: Dettaglio Saldo e Storico Transazioni */
          <div className="p-6 space-y-6">
            
            {/* Box Saldo */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Titolare: {customerData.name}
              </span>
              <div className="text-3xl font-black text-emerald-600">
                € {customerData.balance.toFixed(2)}
              </div>
              <span className="text-xs font-medium text-slate-500">Saldo Disponibile</span>
            </div>

            {/* Lista Movimenti */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Ultimi Movimenti ({transactions.length})
              </h3>

              {transactions.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">
                  Nessuna transazione registrata.
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {transactions.map((tx) => {
                    const isTopup = tx.type === 'topup';
                    const formattedDate = new Date(tx.created_at).toLocaleString('it-IT', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div
                        key={tx.id || tx.created_at}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 text-sm"
                      >
                        <div>
                          <div className="font-bold text-slate-700">
                            {tx.description || (isTopup ? 'Ricarica Credito' : 'Addebito Cassa')}
                          </div>
                          <div className="text-xs text-slate-400">{formattedDate}</div>
                        </div>
                        <div className={`font-black text-base ${isTopup ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {isTopup ? '+' : '-'}€ {parseFloat(tx.amount).toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pulsante Esci */}
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all"
            >
              Cerca un'altra carta
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
