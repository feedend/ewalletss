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

    // 2. DISATTIVAZIONE HARDWARE E ANNULLAMENTO TOKEN (Il QR muore subito)
    const { error: tagUpdateError } = await supabase
      .from('nfc_tags')
      .update({
        token: null,       
        status: 'inactive' 
      })
      .eq('uid', uid.trim());

    if (tagUpdateError) {
      return NextResponse.json({ success: false, error: `Errore disattivazione tag: ${tagUpdateError.message}` }, { status: 500 });
    }

    // 3. GESTIONE ANAGRAFICA E STORICO TRANSAZIONI
    if (tagData.customer_id) {
      
      // 3a. Leggiamo il saldo attuale del cliente prima di toccarlo
      const { data: customerData, error: customerFetchError } = await supabase
        .from('customers')
        .select('balance')
        .eq('id', tagData.customer_id)
        .single();

      if (customerFetchError) {
        return NextResponse.json({ success: false, error: `Errore lettura saldo cliente: ${customerFetchError.message}` }, { status: 500 });
      }

      const currentBalance = parseFloat(customerData?.balance || 0);

      // 3b. Se il saldo è maggiore di 0, scriviamo la transazione di tipo 'refund'
      // Questo rispetta il vincolo CHECK (amount > 0::numeric) del tuo DB
      if (currentBalance > 0) {
        const { error: txError } = await supabase
          .from('transactions')
          .insert({
            customer_id: tagData.customer_id,
            type: 'refund', // 👈 Mappa perfettamente il check constraint ['topup', 'purchase', 'refund', 'adjustment']
            amount: currentBalance,
            description: `Rimborso chiusura cassa via ${method || 'CONTANTI'}`
          });

        if (txError) {
          return NextResponse.json({ success: false, error: `Errore registrazione movimento di rimborso: ${txError.message}` }, { status: 500 });
        }
      }

      // 3c. Soft-delete: disattiviamo il cliente e azzeriamo il balance
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

    return NextResponse.json({
      success: true,
      message: `Tessera ${uid} disattivata correttamente. Movimenti di chiusura registrati nello storico.`
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
