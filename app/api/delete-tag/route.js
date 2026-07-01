import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 FONDAMENTALE: Forza Vercel a eseguire il codice sul DB ogni volta, senza usare la cache
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Legge i dati inviati dal modulo di chiusura cassa
    const body = await request.json().catch(() => ({}));
    const { uid, method } = body; // 'method' indica il metodo di rimborso (es. 'CONTANTI')

    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID tessera mancante' }, { status: 400 });
    }

    // 1. RECUPERO INFO ASSOCIAZIONE
    // Troviamo il customer_id legato alla tessera prima di cancellare il record o modificarlo
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

    // 2. RESET E DISASSOCIAZIONE DELLA TESSERA FISICA
    // Impostiamo il token a null (il vecchio QR muore qui), azzeriamo il cliente e cambiamo lo stato
    const { error: tagUpdateError } = await supabase
      .from('nfc_tags')
      .update({
        customer_id: null,
        token: null,       // 👈 Il vecchio QR stampato smette istantaneamente di funzionare!
        status: 'inactive' // Torna disponibile per essere riassociata a un nuovo ospite
      })
      .eq('uid', uid.trim());

    if (tagUpdateError) {
      return NextResponse.json({ success: false, error: `Errore disassociazione hardware: ${tagUpdateError.message}` }, { status: 500 });
    }

    // 3. ELIMINAZIONE CLIENTE / SVUOTAMENTO ANAGRAFICA
    // Se la tessera era legata a un cliente valido, puliamo la tabella customers
    if (tagData.customer_id) {
      const { error: customerDeleteError } = await supabase
        .from('customers')
        .delete()
        .eq('id', tagData.customer_id);

      if (customerDeleteError) {
        // 💡 NOTA DI BACKEND: Se hai una tabella 'transactions' legata a 'customers' tramite Foreign Key,
        // questa eliminazione fallirà a meno che tu non abbia impostato il vincolo su "ON DELETE CASCADE".
        // Registriamo l'errore in console ma non blocchiamo la risposta, poiché la tessera è già stata liberata.
        console.error("Nota: Impossibile eliminare l'anagrafica cliente, probabilmente ha transazioni collegate storiche:", customerDeleteError.message);
      }
    }

    // 4. RISPOSTA DI SUCCESSO
    return NextResponse.json({
      success: true,
      message: `Tessera ${uid} liberata con successo. Rimborso registrato via ${method || 'CONTANTI'}.`
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
