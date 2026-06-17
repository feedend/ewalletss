import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  try {
    const { uid, method } = await request.json();

    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID della tessera mancante.' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // [FACOLTATIVO] Se in futuro vorrai salvare un registro dei rimborsi (es. per il commercialista),
    // questo è il punto perfetto per fare una .insert() in una tabella 'storico_chiusure' 
    // salvando l'importo liquidato e il metodo (CONTANTI/POS).

    // 🟢 CORRETTO: Puntiamo a nfc_tags per liberare l'UID fisico del chip
    const { error } = await supabase
      .from('nfc_tags') 
      .delete()
      .eq('uid', uid);

    if (error) throw error;

    // Log di controllo sul server Vercel
    console.log(`[Cassa Lido] 🗑️ Tag [${uid}] disassociato con successo. Metodo rimborso: ${method || 'Nessuno (Saldo 0)'}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
