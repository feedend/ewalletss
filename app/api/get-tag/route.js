import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase'; // Adegua questo import in base al tuo file di configurazione Supabase

export async function POST(request) {
  try {
    const { uid } = await request.json();
    if (!uid) return NextResponse.json({ success: false, error: 'UID mancante' }, { status: 400 });

    // Cerchiamo se il tag è attivo e tiriamo dentro i dati del cliente associato
    const { data: tagData, error } = await supabase
      .from('nfc_tags')
      .select('uid, status, customer_id, customers!nfc_tags_customer_id_fkey(id, name, balance, is_active)')
      .eq('uid', uid)
      .eq('status', 'active')
      .maybeSingle(); // Evita eccezioni se la tessera non esiste (restituisce null)

    if (error) throw error;

    // Se il tag non esiste o non è legato a un cliente attivo, la tessera è vergine
    if (!tagData || !tagData.customers) {
      return NextResponse.json({ success: true, exists: false });
    }

    // Se esiste, mappiamo i dati esattamente come se li aspetta il frontend
    return NextResponse.json({
      success: true,
      exists: true,
      customer: {
        id: tagData.customers.id,
        name: tagData.customers.name,
        balance: tagData.customers.balance
      }
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
