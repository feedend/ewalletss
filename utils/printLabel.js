/**
 * Invia il comando di stampa a RawBT tramite Android Intent
 * @param {string} cardUid - Il numero/UID della carta da stampare
 */
export function printCardLabel(cardUid) {
  if (!cardUid) return;

  // Codici di controllo ESC/POS per stampanti termiche
  const ESC = '\u001B';
  const GS = '\u001D';

  let escpos = '';

  // 1. Inizializza stampante
  escpos += ESC + '@';

  // 2. Allineamento centrato
  escpos += ESC + 'a' + '\u0001';

  // 3. Intestazione: Grassetto + Testo Ingrandito (Doppia altezza e larghezza)
  escpos += ESC + 'E' + '\u0001'; // Grassetto ON
  escpos += GS + '!' + '\u0011';  // Ingrandisci testo
  escpos += 'LIDO SANTA SEVERA\n\n';

  // 4. Ripristina dimensione normale per la dicitura
  escpos += GS + '!' + '\u0000';
  escpos += 'N. CARTA / UID:\n';

  // 5. Numero Carta: Ingrandito solo in altezza
  escpos += GS + '!' + '\u0001';
  escpos += cardUid.toUpperCase() + '\n\n';

  // 6. Grassetto OFF e Avanzamento carta per taglio/strappo (3 righe)
  escpos += ESC + 'E' + '\u0000';
  escpos += ESC + 'd' + '\u0003';

  // Converti i comandi in Base64 per inviarli a RawBT
  const base64Data = btoa(unescape(encodeURIComponent(escpos)));

window.location.href = `rawbt:base64,${base64Data}`;
}
