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
    const { uid } = body;

    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID tessera mancante' }, { status: 400 });
    }

    // 1. Recupero del cliente associato alla tessera
    const { data: tagData, error: tagFetchError } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid.trim())
      .maybeSingle();

    if (tagFetchError) {
      return NextResponse.json({ success: false, error: `Errore lettura tag: ${tagFetchError.message}` }, { status: 500 });
    }

    if (!tagData) {
      return NextResponse.json({ success: false, error: 'Tessera non trovata nel database' }, { status: 404 });
    }

    // 2. Aggiornamento stato hardware a inactive
    const { error: tagUpdateError } = await supabase
      .from('nfc_tags')
      .update({ status: 'inactive' })
      .eq('uid', uid.trim());

    if (tagUpdateError) {
      return NextResponse.json({ success: false, error: `Errore disattivazione tag: ${tagUpdateError.message}` }, { status: 500 });
    }

    // 3. Disattivazione anagrafica cliente e azzeramento saldo
    if (tagData.customer_id) {
      const { error: customerUpdateError } = await supabase
        .from('customers')
        .update({
          is_active: false,
          balance: 0.00
        })
        .eq('id', tagData.customer_id);

      if (customerUpdateError) {
        return NextResponse.json({ success: false, error: `Errore disattivazione cliente: ${customerUpdateError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, message: 'Tessera liberata e cliente disattivato.' });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
