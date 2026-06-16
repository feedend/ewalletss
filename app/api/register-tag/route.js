import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 FORZA NEXT.JS A IGNORARE QUESTO FILE IN FASE DI BUILD SU VERCEL
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Controllo di sicurezza sulle chiavi d'ambiente
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Riceve i dati dal frontend della cassa
    const { uid, name } = await request.json();

    // 2. Controlli preventivi sui campi obbligatori
    if (!uid || !uid.trim()) {
      return NextResponse.json({ success: false, error: 'Impossibile registrare: Campo UID vuoto.' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Impossibile registrare: Campo Nome cliente vuoto.' }, { status: 400 });
    }

    // 3. INSERIMENTO CLIENTE: Sfrutta il GENERATED ALWAYS AS IDENTITY per l'ID automatico
    // Il saldo (balance) va a 0.00 di default come da schema DB
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (customerError) {
      return NextResponse.json({ success: false, error: `Errore creazione cliente: ${customerError.message}` }, { status: 500 });
    }

    // 4. ASSOCIAZIONE TESSERA NFC: Usa l'ID del cliente appena creato
    const { error: tagError } = await supabase
      .from('nfc_tags')
      .insert({
        uid: uid.trim(),
        customer_id: customerData.id,
        status: 'active' // Rispetta il vincolo CHECK ['active', 'inactive', 'lost']
      });

    if (tagError) {
      // 🛡️ AZIONE DI ROLLBACK: Se il tag fallisce (es. UID già esistente), cancelliamo il cliente orfano appena creato
      await supabase.from('customers').delete().eq('id', customerData.id);
      
      // Gestione specifica per errore di chiave duplicata (codice Postgres 23505)
      if (tagError.code === '23505') {
        return NextResponse.json({ success: false, error: 'Questa tessera (UID) è già associata a un altro cliente a sistema.' }, { status: 400 });
      }
      
      return NextResponse.json({ success: false, error: `Errore associazione tag: ${tagError.message}` }, { status: 500 });
    }

    // Risposta di successo al frontend
    return NextResponse.json({
      success: true,
      message: 'Cliente e Tessera registrati correttamente!',
      customer: {
        id: customerData.id,
        name: customerData.name,
        balance: parseFloat(customerData.balance)
      }
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
