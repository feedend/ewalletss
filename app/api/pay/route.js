import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 MANTENIAMO QUESTO: Forza Vercel a ignorare il file in fase di build
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // 🛡️ Le chiavi rimangono dentro la funzione, così a Vercel non si blocca il build
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Riceviamo i dati reali inviati dalla cassa
    const { uid, amount, description } = await request.json();
    const parsedAmount = parseFloat(amount);

    // 1. Controlli di sicurezza sui dati in ingresso
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Tag UID mancante.' }, { status: 400 });
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Importo non valido (deve essere maggiore di 0).' }, { status: 400 });
    }

    // 2. Recuperiamo la tessera e il cliente associato
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
      return NextResponse.json({ success: false, error: 'Tessera inesistente o non registrata.' }, { status: 404 });
    }

    // Controllo difensivo per la relazione esterna (se array, prendiamo il primo)
    const customer = Array.isArray(tagData.customers) ? tagData.customers[0] : tagData.customers;

    // 3. Verifichiamo se l'account o la tessera sono bloccati
    if (!customer || customer.is_active === false) {
      return NextResponse.json({ success: false, error: 'Questo account cliente è disattivato.' }, { status: 403 });
    }
    if (tagData.status !== 'active') {
      return NextResponse.json({ success: false, error: `Tessera non attiva. Stato: ${tagData.status}` }, { status: 403 });
    }

    const currentBalance = parseFloat(customer.balance);

    // 4. CONTROLLO SALDO MINIMO: Evitiamo che il conto vada in negativo
    if (currentBalance < parsedAmount) {
      return NextResponse.json({ 
        success: false, 
        error: `Credito insufficiente! Disponibile: € ${currentBalance.toFixed(2)}, Richiesto: € ${parsedAmount.toFixed(2)}.` 
      }, { status: 400 });
    }

    const newBalance = currentBalance - parsedAmount;

    // 5. SCRITTURA NEL DB: Scaliamo l'importo dal cliente
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customer.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: `Errore addebito: ${updateError.message}` }, { status: 500 });
    }

    // 6. STORICO: Registriamo il movimento nella tabella delle transazioni
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        customer_id: customer.id,
        type: 'purchase',
        amount: parsedAmount,
        description: description || 'Addebito Cassa Lido'
      });

    if (txError) {
      // Se fallisce solo lo storico, stampiamo l'errore sul server ma diamo comunque OK alla cassa
      console.error(`⚠️ Saldo aggiornato ma fallito inserimento transazione: ${txError.message}`);
    }

    // Risposta finale di successo alla cassa
    return NextResponse.json({
      success: true,
      message: 'Pagamento completato!',
      client_name: customer.name,
      previous_balance: currentBalance,
      new_balance: newBalance
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
