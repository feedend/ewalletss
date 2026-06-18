export const metadata = {
  title: 'Lido Cashless Cassa',
  description: 'Gestione Cashless per carte NFC',
  manifest: '/manifest.json', // <-- Fondamentale per far leggere la PWA
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lido Cashless Cassa",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tailwindcss/ui@latest/dist/tailwind-ui.min.css"/>
      </head>
      <body>
        {children}

        {/* Iniezione sicura del Service Worker senza rompere il Server Component */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('PWA Service Worker registrato:', reg.scope); })
                    .catch(function(err) { console.error('Errore registrazione SW:', err); });
                });
              }
            `
          }}
        />
      </body>
    </html>
  )
}
