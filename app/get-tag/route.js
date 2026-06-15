// app/api/get-tag/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-base'; // O il tuo import di Supabase

// Sostituisci con le tue reali configurazioni di inizializzazione Supabase se le hai in un file separato
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request) {
  try {
    const { uid } = await request.json();
    
    // Sostituisci 'tessere' o 'customers' con il nome reale della tua tabella
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('tessere') 
      .select('*')
      .eq('uid', uid)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 significa "nessun risultato trovato"

    if (!data) {
      return NextResponse.json({ success: true, exists: false });
    }

    return NextResponse.json({ success: true, exists: true, card: data });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
