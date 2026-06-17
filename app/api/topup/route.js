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
    
    // Riceve l'UID della tessera e l'importo da accreditare
    const { uid, amount, description } = await request.json();
    const parsedAmount = parseFloat(amount);

    // 2. Controlli preventivi sui dati ricevuti
    if (!uid) {
      return NextResponse.json({ success: false, error: 'Tag UID mancante.' }, { status: 400 });
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Importo della ricarica non valido (deve essere maggiore di 0).' }, { status: 400 });
    }

    // 3. Recupera la tessera e il cliente associato
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

    // 4. Verifiche sullo stato del conto
    if (!customer || customer.is_active === false) {
      return NextResponse.json({ success: false, error: 'Questo account cliente è disattivato.' }, { status: 403 });
    }

    const currentBalance = parseFloat(customer.balance);
    
    // Calcolo del nuovo saldo (addizione per la ricarica)
    const newBalance = currentBalance + parsedAmount;

    // 5. OPERAZIONE AGGIORNAMENTO: Incrementa il saldo del cliente
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customer.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: `Errore durante l'accredito: ${updateError.message}` }, { status: 500 });
    }

    // 6. STORICO: Registra la ricarica nella tabella delle transazioni
    // Tipo impostato su 'topup' per rispettare il vincolo CHECK delle transazioni
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        customer_id: customer.id,
        type: 'topup',
        amount: parsedAmount,
        description: description || 'Ricarica Credito Cassa'
      });

    if (txError) {
      console.error(`⚠️ Ricarica eseguita ma errore scrittura storico: ${txError.message}`);
    }

    // Risposta di successo al frontend
    return NextResponse.json({
      success: true,
      message: 'Ricarica effettuata con successo!',
      client_name: customer.name,
      previous_balance: currentBalance,
      new_balance: newBalance
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
