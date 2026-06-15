import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inizializzazione client Supabase con le variabili d'ambiente di Vercel
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(request) {
  try {
    const { uid } = await request.json();
    
    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID mancante' }, { status: 400 });
    }

    // Cerchiamo il tag e tiriamo dentro i dati del customer associato (Relazione FK)
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
      .maybeSingle(); // Evita crash se il tag non esiste

    // Se c'è un errore di database o il tag non esiste nel sistema
    if (error || !tagData) {
      return NextResponse.json({ success: true, exists: false });
    }

    // Se il tag esiste ma non è ancora stato assegnato a nessun cliente
    if (!tagData.customers) {
      return NextResponse.json({ success: true, exists: false });
    }

    // Il tag esiste ed è attivo: restituiamo i dati pronti per la cassa
    return NextResponse.json({
      success: true,
      exists: true,
      card: {
        uid: tagData.uid,
        name: tagData.customers.name,
        balance: tagData.customers.balance
      }
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
