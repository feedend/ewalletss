export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(
  'https://rvsgbsnkurutsburxkwk.supabase.co',
  SUPABASE_KEY
);

export async function POST(request) {
  try {
    const { uid, name, initialBalance } = await request.json();
    const balanceNum = parseFloat(initialBalance) || 0.00;

    if (!uid || !name) {
      return NextResponse.json({ success: false, error: "UID e Nome Ombrellone sono obbligatori!" }, { status: 400 });
    }

    const { data: customer, error: custError } = await supabase
      .from('customers')
      .insert([{ name, balance: balanceNum }])
      .select()
      .single();

    if (custError) throw custError;

    const { error: tagError } = await supabase
      .from('nfc_tags')
      .insert([{ uid, customer_id: customer.id, status: 'active' }]);

    if (tagError) throw tagError;

    if (balanceNum > 0) {
      await supabase
        .from('transactions')
        .insert([
          { 
            customer_id: customer.id, 
            type: 'topup', 
            amount: balanceNum, 
            description: 'Credito caricato all\'attivazione' 
          }
        ]);
    }

    return NextResponse.json({ success: true, customer });

  } catch (error) {
    // 1. Stampa l'errore reale nel terminale di Codespaces per sicurezza
    console.error("❌ ERRORE DA SUPABASE:", error);

    // 2. Estrae il messaggio reale dall'oggetto di Supabase
    const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
