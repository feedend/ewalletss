import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request) {
  try {
    const { uid, amount } = await request.json();
    const numericAmount = parseFloat(amount);

    if (!uid || isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Dati di ricarica non validi' }, { status: 400 });
    }

    // 1. Recuperiamo il customer_id legato a questo UID
    const { data: tagData, error: tagError } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid)
      .single();

    if (tagError || !tagData || !tagData.customer_id) {
      return NextResponse.json({ success: false, error: 'Tessera non associata ad un cliente attivo' }, { status: 404 });
    }

    const customerId = tagData.customer_id;

    // 2. Preleviamo il saldo attuale del cliente per evitare disallineamenti
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      return NextResponse.json({ success: false, error: 'Cliente non trovato nel database' }, { status: 404 });
    }

    // Calcoliamo il nuovo saldo finale
    const newBalance = customer.balance + numericAmount;

    // 3. Aggiorniamo il bilancio del cliente sulla tabella 'customers'
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId);

    if (updateError) throw updateError;

    // 4. Scriviamo il movimento nella tabella 'transactions' (Storico/Log di cassa)
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        customer_id: customerId,
        type: 'topup',
        amount: numericAmount,
        description: 'Ricarica eWallet da Cassa Centrale'
      });

    if (txError) throw txError;

    // Risposta di successo al frontend per stampare la ricevuta a schermo
    return NextResponse.json({
      success: true,
      new_balance: newBalance
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
