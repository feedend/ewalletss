import { NextResponse } from 'next/server';
// 💡 Importa qui la connessione al tuo database, ad esempio:
// import { sql } from '@vercel/postgres'; 
// o import { db } from '@/lib/db';

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, error: 'Campi obbligatori mancanti' }, { status: 400 });
    }

    const targetUser = username.trim().toLowerCase();

    /* 
    ========================================================================
    🔌 INTEGRAZIONE CON IL TUO DB (Esempio con pseudo-codice o Vercel Postgres)
    ========================================================================
    const { rows } = await sql`SELECT * FROM users WHERE username = ${targetUser}`;
    const user = rows[0];
    
    if (!user || user.password_hash !== password) { 
      // NOTA: Usa bcrypt.compare(password, user.password_hash) in produzione!
      return NextResponse.json({ success: false, error: 'Credenziali errate' }, { status: 401 });
    }
    */

    // 🕒 EMULAZIONE DATI DI BACKEND (Rimuovila quando colleghi il DB sopra)
    const mockUsers = [
      { username: 'admin', password_hash: 'gestore123', role: 'gestore' },
      { username: 'spiaggia', password_hash: 'operatore123', role: 'operatore' },
      { username: 'chiosco', password_hash: 'bar123', role: 'bar' }
    ];
    
    const user = mockUsers.find(u => u.username === targetUser && u.password_hash === password);

    if (!user) {
      return NextResponse.json({ success: false, error: 'Username o password errati!' }, { status: 401 });
    }

    // Risposta sicura inviata al client se le credenziali sono corrette
    return NextResponse.json({
      success: true,
      username: user.username,
      role: user.role
    });

  } catch (error) {
    console.error("Errore login API:", error);
    return NextResponse.json({ success: false, error: 'Errore interno del server' }, { status: 500 });
  }
}
