import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rvsgbsnkurutsburxkwk.supabase.co';

// 🛡️ Aggiungiamo un testo di fallback per evitare che il build vada in crash se la chiave è indefinita per un millisecondo
const supabaseKey = process.env.SUPABASE_ANON_KEY || "placeholder-key-for-build";

export const supabase = createClient(supabaseUrl, supabaseKey);
