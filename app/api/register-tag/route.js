import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { uid, name, balance } = await request.json();

    if (!uid || !name) {
      return NextResponse.json({ success: false, error: 'UID e Nome sono obbligatori' }, { status: 400 });
    }

    const initialBalance = parseFloat(balance) || 0;

    // 1. Verifica se la tessera esiste già ed è ANCORA ASSEGNATA ad un cliente attivo
    const { data: existingTag } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid)
      .maybeSingle();

    if (existingTag && existingTag.customer_id) {
      const { data: activeCustomer } = await supabase
        .from('customers')
        .select('is_active')
        .eq('id', existingTag.customer_id)
        .maybeSingle();

      if (activeCustomer && activeCustomer.is_active) {
        return NextResponse.json({ success: false, error: 'Tessera già occupata da un altro cliente attivo!' }, { status: 400 });
      }
    }

    // 2. Crea il nuovo cliente
    const { data: newCustomer, error: custErr } = await supabase
      .from('customers')
      .insert({ name: name, balance: initialBalance, is_active: true })
      .select()
      .single();

    if (custErr) {
      return NextResponse.json({ success: false, error: `Errore creazione cliente: ${custErr.message}` }, { status: 500 });
    }

    // 3. Associa la tessera al nuovo cliente (Upsert: aggiorna se esiste, inserisce se nuova)
    const { error: tagErr } = await supabase
      .from('nfc_tags')
      .upsert({ uid: uid, customer_id: newCustomer.id, status: 'assigned' }, { onConflict: 'uid' });

    if (tagErr) {
      return NextResponse.json({ success: false, error: `Errore collegamento tessera: ${tagErr.message}` }, { status: 500 });
    }

    // 4. Registra la transazione iniziale se c'è un saldo caricato
    if (initialBalance > 0) {
      await supabase.from('transactions').insert({
        customer_id: newCustomer.id,
        type: 'topup',
        amount: initialBalance,
        description: 'Carico iniziale attivazione'
      });
    }

    return NextResponse.json({ success: true, message: 'Tessera attivata con successo!' });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
