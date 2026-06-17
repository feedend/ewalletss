import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { uid, amount } = await request.json();
    const topupAmount = parseFloat(amount);

    if (!uid || isNaN(topupAmount) || topupAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Importo inserito non valido' }, { status: 400 });
    }

    // 1. Troviamo a quale cliente appartiene la tessera passata
    const { data: tagData, error: tagError } = await supabase
      .from('nfc_tags')
      .select('customer_id, customers!nfc_tags_customer_id_fkey(balance)')
      .eq('uid', uid)
      .eq('status', 'active')
      .maybeSingle();

    if (tagError || !tagData || !tagData.customers) {
      return NextResponse.json({ success: false, error: 'Tessera attiva non trovata nel database' }, { status: 404 });
    }

    const customerId = tagData.customer_id;
    const currentBalance = parseFloat(tagData.customers.balance);
    const newBalance = currentBalance + topupAmount;

    // 2. Aggiorniamo il saldo sulla tabella customers
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId);

    if (updateError) throw updateError;

    // 3. Archiviamo il movimento storico della ricarica
    await supabase
      .from('transactions')
      .insert([{
        customer_id: customerId,
        type: 'topup',
        amount: topupAmount,
        description: 'Ricarica effettuata in cassa'
      }]);

    return NextResponse.json({ success: true, new_balance: newBalance });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
