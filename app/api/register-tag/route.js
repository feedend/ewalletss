import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 Forza Vercel a eseguire il codice sul DB ogni volta, senza usare la cache
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

    // Controlli di sicurezza minimi
    if (!uid || !name) {
      return NextResponse.json({ success: false, error: 'UID e Nome sono obbligatori' }, { status: 400 });
    }

    // 1. CREAZIONE CLIENTE
    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .insert({ 
        name: name.trim(),
        balance: initialBalance,
        is_active: true // Forza il cliente come attivo
      })
      .select()
      .single();

    if (customerError) {
      return NextResponse.json({ success: false, error: `Errore creazione cliente: ${customerError.message}` }, { status: 500 });
    }

    // 2. TRACCIAMENTO FINANZIARIO (Se c'è un saldo iniziale, registra la ricarica)
    // Questo popola la tabella transactions rispettando il vincolo CHECK (amount > 0)
    if (initialBalance > 0) {
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          customer_id: customerData.id,
          type: 'topup', // 👈 Rispetta il check constraint ['topup', 'purchase', 'refund', 'adjustment']
          amount: initialBalance,
          description: 'Ricarica iniziale all\'attivazione della tessera'
        });

      if (txError) {
        // Rollback di sicurezza: se la transazione fallisce, cancella il cliente appena creato
        await supabase.from('customers').delete().eq('id', customerData.id);
        return NextResponse.json({ success: false, error: `Errore registrazione ricarica iniziale: ${txError.message}` }, { status: 500 });
      }
    }

    // 3. GENERAZIONE TOKEN SICURO PER QR CODE
    const secureToken = crypto.randomUUID();

    // 4. ASSOCIAZIONE TESSERA (Usa UPSERT per permettere il riciclo dell'hardware)
    const { error: tagError } = await supabase
      .from('nfc_tags')
      .upsert({
        uid: uid.trim(),
        customer_id: customerData.id, // Collega la tessera fisica al NUOVO cliente
        status: 'active',
        token: secureToken
      }, { onConflict: 'uid' }); // 👈 Se l'UID esiste già, sovrascrive i dati (riciclo chip)

    if (tagError) {
      // Rollback totale: se l'hardware fallisce, pulisci il cliente (le transazioni collegate si cancellano se hai il CASCADE, 
      // altrimenti eliminiamo manualmente anche la transazione se necessario. Per sicurezza eliminiamo il cliente).
      await supabase.from('customers').delete().eq('id', customerData.id);
      return NextResponse.json({ success: false, error: `Errore associazione tag hardware: ${tagError.message}` }, { status: 500 });
    }

    // 5. RISPOSTA DI SUCCESSO
    return NextResponse.json({
      success: true,
      message: 'Cliente, Tessera e Ricarica registrati correttamente!',
      token: secureToken, // 👈 Passalo al frontend per generare il QR Code stampabile
      customer: {
        id: customerData.id,
        name: customerData.name,
        balance: initialBalance
      }
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
