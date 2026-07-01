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
    const { uid, method } = body; 

    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID tessera mancante' }, { status: 400 });
    }

    // 1. RECUPERO INFO TESSERA
    const { data: tagData, error: tagFetchError } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid.trim())
      .maybeSingle();

    if (tagFetchError) {
      return NextResponse.json({ success: false, error: `Errore lettura tessera: ${tagFetchError.message}` }, { status: 500 });
    }

    if (!tagData) {
      return NextResponse.json({ success: false, error: 'Tessera non trovata nel database' }, { status: 404 });
    }

    // 2. DISATTIVAZIONE TOKEN E HARDWARE
    // customer_id è NOT NULL, quindi lo lasciamo invariato. Cambiamo lo status e uccidiamo il token.
    const { error: tagUpdateError } = await supabase
      .from('nfc_tags')
      .update({
        token: null,       // Il QR code smette di funzionare all'istante
        status: 'inactive' // La tessera è pronta per essere riciclata
      })
      .eq('uid', uid.trim());

    if (tagUpdateError) {
      return NextResponse.json({ success: false, error: `Errore disattivazione tag: ${tagUpdateError.message}` }, { status: 500 });
    }

    // 3. SOFT-DELETE DEL CLIENTE (Preserva lo storico delle transazioni)
    if (tagData.customer_id) {
      const { error: customerUpdateError } = await supabase
        .from('customers')
        .update({
          is_active: false, // Il cliente non è più attivo nel lido
          balance: 0.00     // Il saldo viene azzerato (rimborsato)
        })
        .eq('id', tagData.customer_id);

      if (customerUpdateError) {
        return NextResponse.json({ success: false, error: `Errore disattivazione cliente: ${customerUpdateError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Tessera ${uid} disattivata con successo. Rimborso eseguito via ${method || 'CONTANTI'}. Storico preservato.`
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
