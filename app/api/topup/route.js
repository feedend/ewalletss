import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  'https://rvsgbsnkurutsburxkwk.supabase.co',
  process.env.SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { uid, amount } = await request.json();
    const topupAmount = parseFloat(amount);

    if (!uid || isNaN(topupAmount) || topupAmount <= 0) {
      return NextResponse.json({ success: false, error: "UID o importo non valido" }, { status: 400 });
    }

    // 1. Trova il cliente associato al braccialetto NFC
    const { data: tag, error: tagError } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid)
      .eq('status', 'active')
      .maybeSingle();

    if (tagError || !tag) {
      return NextResponse.json({ success: false, error: "Tessera non trovata o non attiva" }, { status: 404 });
    }
    
    const customerId = tag.customer_id;

    // 2. Recupera il saldo attuale del cliente
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customerId)
      .maybeSingle();

    if (custError || !customer) {
      return NextResponse.json({ success: false, error: "Anagrafica cliente non trovata" }, { status: 404 });
    }

    const currentBalance = parseFloat(customer.balance) || 0.00;
    
    // Calcoliamo il nuovo saldo arrotondando a due cifre decimali
    const newBalance = parseFloat((currentBalance + topupAmount).toFixed(2));

    // 3. Aggiorna il saldo nel database
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId);

    if (updateError) throw new Error("Impossibile aggiornare il saldo su Supabase");

    // 4. Registra l'operazione nello storico transazioni
    await supabase
      .from('transactions')
      .insert([
        { customer_id: customerId, type: 'topup', amount: topupAmount, description: 'Ricarica Cassa Vercel' }
      ]);

    return NextResponse.json({ success: true, new_balance: newBalance });

 } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto";
    console.error("ERRORE TOPUP:", errorMessage);
    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
