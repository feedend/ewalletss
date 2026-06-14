export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";

// 🔥 SCRIVIAMO IL LINK DIRETTAMENTE QUI, COSI VERCEL NON PUÒ ANDARE IN ERRORE DURANTE IL BUILD!
const supabase = createClient(
  'https://rvsgbsnkurutsburxkwk.supabase.co',
  SUPABASE_KEY
);

export async function POST(request) {
  try {
    const { uid, amount } = await request.json();
    const amountNum = parseFloat(amount) || 0.00;

    if (!uid || amountNum <= 0) {
      return NextResponse.json({ success: false, error: "UID e Importo valido sono obbligatori!" }, { status: 400 });
    }

    // 1. Cerchiamo a quale cliente appartiene questo braccialetto/tessera
    const { data: tagData, error: tagError } = await supabase
      .from('nfc_tags')
      .select('customer_id')
      .eq('uid', uid.trim())
      .single();

    if (tagError || !tagData) {
      return NextResponse.json({ success: false, error: "Tessera non trovata o non associata ad alcun cliente!" }, { status: 404 });
    }

    const customerId = tagData.customer_id;

    // 2. Recuperiamo il saldo attuale del cliente per aggiornarlo in sicurezza
    const { data: customerData, error: custFetchError } = await supabase
      .from('customers')
      .select('balance')
      .eq('id', customerId)
      .single();

    if (custFetchError) throw custFetchError;

    const currentBalance = parseFloat(customerData.balance) || 0.00;
    const newBalance = currentBalance + amountNum;

    // 3. Aggiorniamo il saldo del cliente
    const { error: updateError } = await supabase
      .from('customers')
      .update({ balance: newBalance })
      .eq('id', customerId);

    if (updateError) throw updateError;

    // 4. Registruire la transazione nello storico
    await supabase
      .from('transactions')
      .insert([
        { 
          customer_id: customerId, 
          type: 'topup', 
          amount: amountNum, 
          description: 'Ricarica effettuata in cassa' 
        }
      ]);

    return NextResponse.json({ success: true, new_balance: newBalance });

  } catch (error) {
    console.error("❌ ERRORE TOPUP:", error);
    const msg = error?.message || "Errore interno durante la ricarica.";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
