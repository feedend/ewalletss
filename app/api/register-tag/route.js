export const dynamic = 'force-dynamic'; // 🔥 Forza Next.js a saltare il controllo statico nel build

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";

// 🔥 Scriviamo il link di Supabase direttamente qui per evitare crash a freddo
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

    // 1. Creiamo il nuovo cliente nel database
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .insert([{ name, balance: balanceNum }])
      .select()
      .single();

    if (custError) throw custError;

    // 2. Usiamo UPSERT: se l'UID esiste già, lo riassegna al nuovo cliente
    const { error: tagError } = await supabase
      .from('nfc_tags')
      .upsert([{ uid: uid.trim(), customer_id: customer.id, status: 'active' }], { onConflict: 'uid' });

    if (tagError) throw tagError;

    // 3. Se c'è un credito iniziale, registriamo la transazione di ricarica
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
    console.error("❌ ERRORE DA SUPABASE REGISTRAZIONE:", error);
    const msg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
