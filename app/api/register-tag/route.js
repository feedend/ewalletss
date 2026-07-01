import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const body = await request.json().catch(() => ({}));
    const { uid, name, balance } = body;

    if (!uid || !name) {
      return NextResponse.json({ success: false, error: 'UID e Nome sono obbligatori' }, { status: 400 });
    }

    // 1. Creazione record cliente
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .insert({ 
        name: name.trim(),
        balance: parseFloat(balance) || 0,
        is_active: true
      })
      .select()
      .single();

    if (customerError) {
      return NextResponse.json({ success: false, error: `Errore database: ${customerError.message}` }, { status: 500 });
    }

    // 2. Associazione diretta della tessera hardware
    const { error: tagError } = await supabase
      .from('nfc_tags')
      .upsert({
        uid: uid.trim(),
        customer_id: customerData.id,
        status: 'active'
      }, { onConflict: 'uid' });

    if (tagError) {
      // Rollback se l'inserimento della tessera fallisce
      await supabase.from('customers').delete().eq('id', customerData.id);
      return NextResponse.json({ success: false, error: `Errore associazione tag: ${tagError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      customer: customerData
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
