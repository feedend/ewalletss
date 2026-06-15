import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 FORZA NEXT.JS A IGNORARE QUESTO FILE IN FASE DI BUILD
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { uid, amount } = await request.json();
    const numericAmount = parseFloat(amount);

    if (!uid || isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Dati di ricarica non validi' }, { status: 400 });
    }

    const { data: tagData, error: tagError } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid)
      .single();

    if (tagError || !tagData || !tagData.customer_id) {
      return NextResponse.json({ success: false, error: 'Tessera non associata ad un cliente attivo' }, { status: 404 });
    }

    const customerId = tagData.customer_id;

    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customerId)
      .single();

    if (custError || !customer) {
      return NextResponse.json({ success: false, error: 'Cliente non trovato' }, { status: 404 });
    }

    const newBalance = customer.balance + numericAmount;

    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId);

    if (updateError) throw updateError;

    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        customer_id: customerId,
        type: 'topup',
        amount: numericAmount,
        description: 'Ricarica eWallet da Cassa Centrale'
      });

    if (txError) throw txError;

    return NextResponse.json({
      success: true,
      new_balance: newBalance
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
