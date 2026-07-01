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
    
    // Legge i dati inviati dalla cassa
    const body = await request.json().catch(() => ({}));
    const { uid, name, balance } = body;
    const initialBalance = parseFloat(balance) || 0;

    // Controlli preliminari sui dati obbligatori
    if (!uid || !name) {
      return NextResponse.json({ success: false, error: 'UID e Nome sono obbligatori' }, { status: 400 });
    }

    // 1. CREAZIONE CLIENTE
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .insert({ 
        name: name.trim(),
        balance: initialBalance // SALVA IL SALDO INIZIALE NEL DB!
      })
      .select()
      .single();

    if (customerError) {
      return NextResponse.json({ success: false, error: `Errore creazione cliente: ${customerError.message}` }, { status: 500 });
    }

    // 2. GENERAZIONE TOKEN SECURE "USA E GETTA"
    // crypto.randomUUID() genera una stringa casuale unica del tipo: "123e4567-e89b-12d3-a456-426614174000"
    const secureToken = crypto.randomUUID();

    // 3. ASSOCIAZIONE TESSERA (Usa l'ID del cliente e salva il token)
    const { error: tagError } = await supabase
      .from('nfc_tags')
      .insert({
        uid: uid.trim(),
        customer_id: customerData.id,
        status: 'active',
        token: secureToken // 👈 SALVA IL TOKEN USA E GETTA NEL DB!
      });

    if (tagError) {
      // 🛡️ ANNULLAMENTO (Rollback): Se la tessera fallisce (es. UID già esistente), cancella il cliente appena creato per non lasciare dati orfani
      await supabase.from('customers').delete().eq('id', customerData.id);
      
      if (tagError.code === '23505') {
        return NextResponse.json({ success: false, error: 'Questa tessera (UID) è già associata a un altro cliente.' }, { status: 400 });
      }
      return NextResponse.json({ success: false, error: `Errore associazione tag: ${tagError.message}` }, { status: 500 });
    }

    // 4. RISPOSTA DI SUCCESSO
    return NextResponse.json({
      success: true,
      message: 'Cliente e Tessera registrati correttamente sul database!',
      token: secureToken, // 👈 RESTITUISCE IL TOKEN AL FRONTEND PER IL QR CODE!
      customer: {
        id: customerData.id,
        name: customerData.name,
        balance: parseFloat(customerData.balance || 0)
      }
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
