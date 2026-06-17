import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 FONDAMENTALE: Dice a Vercel di NON memorizzare questa risposta e di andare sul DB ogni volta
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

    // Riceve l'UID inviato dal lettore della cassa
    const { uid } = await request.json();

    if (!uid || !uid.trim()) {
      return NextResponse.json({ success: false, error: 'UID della tessera mancante nella richiesta.' }, { status: 400 });
    }

    // 2. QUERY REALE SU SUPABASE: Cerca il tag e si tira dietro i dati del cliente
    const { data: tagData, error: tagError } = await supabase
      .from('nfc_tags')
      .select(`
        uid,
        status,
        customers (
          id,
          name,
          balance,
          is_active
        )
      `)
      .eq('uid', uid.trim())
      .maybeSingle(); // Ritorna un oggetto singolo o null se non trova nulla (senza andare in errore)

    if (tagError) {
      return NextResponse.json({ success: false, error: `Errore DB: ${tagError.message}` }, { status: 500 });
    }

    // 3. SE LA TESSERA NON ESISTE
    if (!tagData) {
      return NextResponse.json({ 
        success: true, 
        exists: false, 
        message: 'Tessera nuova, pronta per essere registrata.' 
      });
    }

    // Gestione difensiva se la relazione 'customers' viene restituita come array
    const customer = Array.isArray(tagData.customers) ? tagData.customers[0] : tagData.customers;

    // 4. SE LA TESSERA ESISTE: Ritorna tutti i dati reali al frontend della cassa
    return NextResponse.json({
      success: true,
      exists: true,
      status: tagData.status,
      customer: customer ? {
        id: customer.id,
        name: customer.name,
        balance: parseFloat(customer.balance),
        is_active: customer.is_active
      } : null
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
