import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 FORZA NEXT.JS A IGNORARE QUESTO FILE IN FASE DI BUILD SU VERCEL
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Controllo di sicurezza sulle chiavi d'ambiente
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Riceve l'UID della tessera e il prezzo della consumazione/servizio da scalare
    const { uid, amount, description } = await request.json();
    const parsedAmount = parseFloat(amount);

    // 2. Controlli preventivi sui dati ricevuti dal frontend
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Tag UID mancante.' }, { status: 400 });
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Importo del pagamento non valido (deve essere maggiore di 0).' }, { status: 400 });
    }

    // 3. Recupera la tessera e i dati del cliente associato
    const { data: tagData, error: tagError } = await supabase
      .from('nfc_tags')
      .select(`
        uid,
        status,
        customers (
          id,
          name,
          balance,
          is_active
        )
      `)
      .eq('uid', uid)
      .maybeSingle();

    if (tagError || !tagData || !tagData.customers) {
      return NextResponse.json({ success: false, error: 'Tessera non registrata o inesistente a sistema.' }, { status: 404 });
    }

    // Gestione difensiva se la relazione 'customers' viene restituita come array
    const customer = Array.isArray(tagData.customers) ? tagData.customers[0] : tagData.customers;

    // 4. Verifiche di validità del cliente e dello stato della tessera
    if (!customer || customer.is_active === false) {
      return NextResponse.json({ success: false, error: 'Questo account cliente è disattivato.' }, { status: 403 });
    }
    if (tagData.status !== 'active') {
      return NextResponse.json({ success: false, error: `Tessera non utilizzabile. Stato attuale: ${tagData.status}` }, { status: 403 });
    }

    const currentBalance = parseFloat(customer.balance);

    // 5. BLOCCO FONDI: Verifica matematica del saldo disponibile
    if (currentBalance < parsedAmount) {
      return NextResponse.json({ 
        success: false, 
        error: `Credito insufficiente! Il cliente ha € ${currentBalance.toFixed(2)} ma l'importo richiesto è € ${parsedAmount.toFixed(2)}.` 
      }, { status: 400 });
    }

    // Calcolo del nuovo saldo (andrà a rispettare il vincolo CHECK balance >= 0.00)
    const newBalance = currentBalance - parsedAmount;

    // 6. OPERAZIONE AGGIORNAMENTO: Scala il credito dall'account del cliente
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customer.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: `Errore durante l'addebito: ${updateError.message}` }, { status: 500 });
    }

    // 7. STORICO: Registra il movimento nella tabella delle transazioni
    // Nota: Inviamo parsedAmount positivo (es: 5.50) e tipo 'purchase' per soddisfare il vincolo 'CHECK (amount > 0)'
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        customer_id: customer.id,
        type: 'purchase',
        amount: parsedAmount,
        description: description || 'Addebito Cassa / Consumazione Lido'
      });

    if (txError) {
      // Nota: Il saldo è stato scalato ma la traccia del log è fallita. 
      // Lo segnaliamo nei log del server ma diamo comunque successo al cliente per non bloccare la cassa.
      console.error(`⚠️ Transazione scalata ma errore scrittura storico: ${txError.message}`);
    }

    // Risposta di successo al frontend con il saldo aggiornato in tempo reale
    return NextResponse.json({
      success: true,
      message: 'Pagamento effettuato con successo!',
      client_name: customer.name,
      previous_balance: currentBalance,
      new_balance: newBalance
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
