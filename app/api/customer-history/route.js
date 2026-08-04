import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { uid } = await request.json();

    if (!uid || !uid.trim()) {
      return NextResponse.json({ success: false, error: 'Inserisci il numero della carta.' }, { status: 400 });
    }

    const cleanUid = uid.trim();

    // 1. Cerca la tessera e l'anagrafica cliente
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

    const customer = Array.isArray(tagData?.customers) ? tagData.customers[0] : tagData?.customers;

    // Se la tessera non esiste o il cliente non è attivo
    if (!tagData || !customer || customer.is_active === false) {
      return NextResponse.json({ success: false, error: 'Numero carta non valido o tessera non attiva.' }, { status: 404 });
    }

    // 2. Recupera lo storico transazioni del cliente (dalla più recente)
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (txError) {
      return NextResponse.json({ success: false, error: `Errore recupero storico: ${txError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      customer: {
        name: customer.name,
        balance: parseFloat(customer.balance)
      },
      transactions: transactions || []
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
