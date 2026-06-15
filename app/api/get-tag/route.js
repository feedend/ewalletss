import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 🛑 FORZA NEXT.JS A IGNORARE QUESTO FILE IN FASE DI BUILD
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    // Spostiamo le chiavi all'interno per non farle scattare durante il "next build"
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ success: false, error: 'Configurazione database mancante' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { uid } = await request.json();
    
    if (!uid) {
      return NextResponse.json({ success: false, error: 'UID mancante' }, { status: 400 });
    }

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
      .maybeSingle();

    if (error || !tagData || !tagData.customers) {
      return NextResponse.json({ success: true, exists: false });
    }

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
