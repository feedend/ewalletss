import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 FORZA NEXT.JS A IGNORARE QUESTO FILE IN FASE DI BUILD
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { uid } = await request.json();
    
    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID mancante' }, { status: 400 });
    }

    // Interroghiamo il DB usando lo schema esatto
    const { data: tagData, error } = await supabase
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
      .eq('uid', uid)
      .maybeSingle();

    // Se c'è un errore o la tessera non esiste proprio nel DB
    if (error || !tagData || !tagData.customers) {
      return NextResponse.json({ success: true, exists: false });
    }

    // 🛡️ CONTROLLO DIFENSIVO: Gestiamo sia il caso in cui 'customers' sia un oggetto, sia un array
    const customerData = Array.isArray(tagData.customers) ? tagData.customers[0] : tagData.customers;

    // Se il cliente associato esiste ma è stato disattivato (is_active = false)
    if (!customerData || customerData.is_active === false) {
      return NextResponse.json({ success: true, exists: false, error: 'Cliente disattivato o non valido' });
    }

    // Risposta pulita per il frontend
    return NextResponse.json({
      success: true,
      exists: true,
      card: {
        uid: tagData.uid,
        status: tagData.status,
        name: customerData.name,
        balance: parseFloat(customerData.balance) // Assicuriamoci che il numeric sia un numero JS
      }
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
