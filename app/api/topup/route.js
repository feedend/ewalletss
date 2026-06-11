export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Inizializzazione client Supabase
// Assicurati che SUPABASE_URL e SUPABASE_ANON_KEY siano nelle variabili d'ambiente di Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

export async function POST(request: Request) {
  try {
    const { uid, amount, description } = await request.json();
    const chargeAmount = parseFloat(amount);

    // 1. Validazione input
    if (!uid || isNaN(chargeAmount) || chargeAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Dati di pagamento non validi" }, 
        { status: 400 }
      );
    }

    // 2. Recupero del cliente associato all'UID
    const { data: tag, error: tagError } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid)
      .eq('status', 'active')
      .maybeSingle();

    if (tagError || !tag) {
      return NextResponse.json(
        { success: false, error: "Tessera non trovata o non attiva" }, 
        { status: 404 }
      );
    }
    
    const customerId = tag.customer_id;

    // 3. Recupero saldo attuale
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customerId)
      .maybeSingle();

    if (custError || !customer) {
      return NextResponse.json(
        { success: false, error: "Anagrafica cliente non trovata" }, 
        { status: 404 }
      );
    }

    // 4. Calcolo nuovo saldo (USANDO chargeAmount CORRETTO)
    const currentBalance = parseFloat(customer.balance) || 0.00;
    const newBalance = parseFloat((currentBalance + chargeAmount).toFixed(2));

    // 5. Aggiornamento saldo
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId);

    if (updateError) throw new Error("Impossibile aggiornare il saldo");

    // 6. Registrazione transazione
    await supabase
      .from('transactions')
      .insert([
        { 
          customer_id: customerId, 
          type: 'topup', 
          amount: chargeAmount, 
          description: description || 'Ricarica Cassa' 
        }
      ]);

    return NextResponse.json({ success: true, new_balance: newBalance });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Errore sconosciuto";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
