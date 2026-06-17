export default function manifest() {
  return {
    name: 'Lido eWallet',
    short_name: 'LidoWallet',
    description: 'Sistema di gestione tessere e pagamenti per stabilimenti balneari',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc', // slate-50
    theme_color: '#2563eb',      // blue-600 (colore della barra di stato)
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
