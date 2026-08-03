import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Usiamo la SERVICE_ROLE_KEY per bypassare i blocchi RLS in scrittura
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID mancante' }, { status: 400 });
    }

    // 1. Recupera la tessera ed il cliente attualmente collegato
    const { data: tag, error: fetchErr } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid)
      .maybeSingle();

    if (fetchErr || !tag) {
      return NextResponse.json({ success: false, error: 'Tessera non trovata' }, { status: 404 });
    }

    // 2. Se c'è un cliente associato, disattivalo
    if (tag.customer_id) {
      await supabase
        .from('customers')
        .update({ is_active: false })
        .eq('id', tag.customer_id);
    }

    // 3. CRUCIALE: Libera la tessera azzerando customer_id e resettando lo status
    const { error: unbindErr } = await supabase
      .from('nfc_tags')
      .update({ customer_id: null, status: 'available' })
      .eq('uid', uid);

    if (unbindErr) {
      return NextResponse.json({ success: false, error: `Errore disassociazione: ${unbindErr.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Tessera disassociata e resa disponibile!' });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
