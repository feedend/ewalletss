import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { uid, method } = await request.json();

    if (!uid) return NextResponse.json({ success: false, error: 'UID mancante' }, { status: 400 });

    // 1. Troviamo il cliente associato alla tessera prima di sganciarlo
    const { data: tagData, error: tagError } = await supabase
      .from('nfc_tags')
      .select('customer_id, customers!nfc_tags_customer_id_fkey(balance)')
      .eq('uid', uid)
      .eq('status', 'active')
      .maybeSingle();

    if (tagError || !tagData || !tagData.customers) {
      return NextResponse.json({ success: false, error: 'Tessera già libera o inesistente' }, { status: 404 });
    }

    const customerId = tagData.customer_id;
    const remainingBalance = parseFloat(tagData.customers.balance);

    // 2. Se c'erano dei soldi dentro, registriamo l'uscita finanziaria (Rimborso) prima di azzerare tutto
    if (remainingBalance > 0) {
      if (!method) {
        return NextResponse.json({ success: false, error: 'Specificare il metodo di rimborso obbligatorio per tessere con saldo attivo' }, { status: 400 });
      }

      await supabase
        .from('transactions')
        .insert([{
          customer_id: customerId,
          type: 'refund',
          amount: remainingBalance,
          description: `Rimborso cassa totale alla chiusura della tessera via ${method}`
        }]);
    }

    // 3. Disattiviamo l'anagrafica cliente azzerandone il credito residuo
    await supabase
      .from('customers')
      .update({ balance: 0, is_active: false })
      .eq('id', customerId);

    // 4. ELIMINIAMO fisicamente la riga da nfc_tags
    // Avendo rimosso la riga, la chiave primaria (uid) torna ad essere istantaneamente disponibile per una nuova registrazione
    const { error: deleteTagError } = await supabase
      .from('nfc_tags')
      .delete()
      .eq('uid', uid);

    if (deleteTagError) throw deleteTagError;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
