export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Ruota di scorta per la chiave in fase di build
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "";

const supabase = createClient(
  'https://rvsgbsnkurutsburxkwk.supabase.co',
  SUPABASE_KEY
);

export async function POST(request) {
  try {
    // Riceviamo i dati corretti inviati dal modulo "Nuova Scheda" del frontend
    const { uid, name, initialBalance } = await request.json();
    const balanceNum = parseFloat(initialBalance) || 0.00;

    // 1. Controllo dei campi obbligatori
    if (!uid || !name) {
      return NextResponse.json({ success: false, error: "UID e Nome Ombrellone sono obbligatori!" }, { status: 400 });
    }

    // 2. Creiamo l'anagrafica del cliente nella tabella 'customers'
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .insert([{ name, balance: balanceNum }])
      .select()
      .single();

    if (custError) throw custError;

    // 3. Colleghiamo il braccialetto NFC (UID) al cliente appena creato
    const { error: tagError } = await supabase
      .from('nfc_tags')
      .insert([{ uid, customer_id: customer.id, status: 'active' }]);

    if (tagError) throw tagError;

    // 4. Se è stato caricato del denaro iniziale, registriamo la transazione di ricarica
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

    // 5. Risposta di successo al frontend
    return NextResponse.json({ success: true, customer });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Errore sconosciuto";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
