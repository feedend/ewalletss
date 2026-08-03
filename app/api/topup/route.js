import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Usare preferibilmente la SERVICE_ROLE_KEY per garantire i permessi di UPDATE
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { uid, amount, description } = await request.json();
    const parsedAmount = parseFloat(amount);

    if (!uid) {
      return NextResponse.json({ success: false, error: 'Tag UID mancante.' }, { status: 400 });
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ success: false, error: 'Importo ricarica non valido.' }, { status: 400 });
    }

    // Recupera la tessera ed il cliente collegato
    const { data: tagData, error: tagError } = await supabase
      .from('nfc_tags')
      .select(`
        uid,
        status,
        customer_id,
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
      return NextResponse.json({ success: false, error: 'Tessera non registrata o non associata ad un cliente.' }, { status: 404 });
    }

    const customer = Array.isArray(tagData.customers) ? tagData.customers[0] : tagData.customers;

    if (!customer || customer.is_active === false) {
      return NextResponse.json({ success: false, error: 'Questo account cliente è stato disattivato.' }, { status: 403 });
    }

    const currentBalance = parseFloat(customer.balance || 0);
    const newBalance = currentBalance + parsedAmount;

    // Aggiorna saldo
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customer.id);

    if (updateError) {
      return NextResponse.json({ success: false, error: `Errore accredito: ${updateError.message}` }, { status: 500 });
    }

    // Storico transazione
    await supabase.from('transactions').insert({
      customer_id: customer.id,
      type: 'topup',
      amount: parsedAmount,
      description: description || 'Ricarica Credito Cassa'
    });

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
