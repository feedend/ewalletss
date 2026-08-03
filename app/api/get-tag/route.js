import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 Dice a Vercel di NON memorizzare questa risposta e di interrogare il DB ad ogni chiamata
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Usa preferibilmente la SERVICE_ROLE_KEY per garantire l'accesso al DB
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Riceve l'UID inviato dal lettore della cassa
    const { uid } = await request.json();

    if (!uid || !uid.trim()) {
      return NextResponse.json({ success: false, error: 'UID della tessera mancante nella richiesta.' }, { status: 400 });
    }

    const cleanUid = uid.trim();

    // 1. QUERY SU SUPABASE: Cerca la tessera ed i dati del cliente collegato (gestisce maiuscole/minuscole con ilike)
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
      .ilike('uid', cleanUid)
      .maybeSingle();

    if (tagError) {
      return NextResponse.json({ success: false, error: `Errore DB: ${tagError.message}` }, { status: 500 });
    }

    // Gestione difensiva se la relazione 'customers' viene restituita come array
    const customer = Array.isArray(tagData?.customers) ? tagData.customers[0] : tagData?.customers;

    // 2. SE LA TESSERA NON ESISTE, NON HA UN CLIENTE O IL CLIENTE È DISATTIVATO -> È LIBERA!
    if (!tagData || !customer || customer.is_active === false) {
      return NextResponse.json({ 
        success: true, 
        exists: false, // 🟢 Segnala al frontend che la scheda si può REGISTRARE
        message: 'Tessera libera e pronta per l\'associazione.' 
      });
    }

    // 3. SE LA TESSERA È OCCUPATA DA UN CLIENTE ATTIVO
    return NextResponse.json({
      success: true,
      exists: true, // 🔴 Segnala al frontend che la scheda ha già un padrone attivo
      status: tagData.status,
      customer: {
        id: customer.id,
        name: customer.name,
        balance: parseFloat(customer.balance),
        is_active: customer.is_active
      }
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
