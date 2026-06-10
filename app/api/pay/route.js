import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  'https://rvsgbsnkurutsburxkwk.supabase.co',
  process.env.SUPABASE_ANON_KEY
);

export async function POST(request) {
  try {
    const { uid, amount, description } = await request.json();
    const chargeAmount = parseFloat(amount);

    if (!uid || isNaN(chargeAmount) || chargeAmount <= 0) {
      return NextResponse.json({ success: false, error: "Dati di pagamento non validi" }, { status: 400 });
    }

    // 1. Trova il braccialetto e controlla il saldo agganciato
    const { data: tag, error: tagError } = await supabase
      .from('nfc_tags')
      .select('customer_id, customers(balance)')
      .eq('uid', uid)
      .eq('status', 'active')
      .maybeSingle();

    if (tagError || !tag) {
      return NextResponse.json({ success: false, error: "Braccialetto non valido o non attivo" }, { status: 404 });
    }

    const customerId = tag.customer_id;
    const currentBalance = parseFloat(tag.customers.balance) || 0.00;

    // 2. Controllo del credito residuo
    if (currentBalance < chargeAmount) {
      return NextResponse.json({ success: false, error: "Credito insufficiente sull'eWallet!" }, { status: 400 });
    }

    const newBalance = parseFloat((currentBalance - chargeAmount).toFixed(2));

    // 3. Scala i soldi dal conto del cliente
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId);

    if (updateError) throw new Error("Errore durante l'addebito del saldo");

    // 4. Scrivi la transazione di acquisto dello storico
    await supabase
      .from('transactions')
      .insert([
        { 
          customer_id: customerId, 
          type: 'purchase', 
          amount: chargeAmount, 
          description: description || 'Consumazione Bar Lido' 
        }
      ]);

    return NextResponse.json({ 
      success: true, 
      message: "Pagamento completato con successo", 
      remaining_balance: newBalance 
    });

  } catch (error) {
    console.error("ERRORE PAY BAR:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
