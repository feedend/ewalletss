import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { uid, name, balance } = await request.json();
    const initialBalance = parseFloat(balance) || 0;

    if (!uid || !name) {
      return NextResponse.json({ success: false, error: 'UID e Nome sono obbligatori' }, { status: 400 });
    }

    // 1. Inseriamo il record del cliente
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .insert([{ name, balance: initialBalance, is_active: true }])
      .select()
      .single();

    if (custError) throw custError;

    // 2. Colleghiamo il tag fisico all'ID del cliente appena generato
    const { error: tagError } = await supabase
      .from('nfc_tags')
      .insert([{ uid, customer_id: customer.id, status: 'active' }]);

    if (tagError) {
      // Sistema di sicurezza: se fallisce il tag, puliamo il cliente orfano
      await supabase.from('customers').delete().eq('id', customer.id);
      throw tagError;
    }

    // 3. Se l'operatore ha caricato dei soldi subito, registriamo il movimento nei log transazioni
    if (initialBalance > 0) {
      await supabase
        .from('transactions')
        .insert([{
          customer_id: customer.id,
          type: 'topup',
          amount: initialBalance,
          description: 'Carico iniziale alla creazione della tessera'
        }]);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
