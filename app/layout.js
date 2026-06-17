export const metadata = {
  title: 'Lido Cashless Cassa',
  description: 'Gestione Cashless per carte NFC',
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Lido Cashless Cassa",
  },
  formatDetection: {
    telephone: false,
  },
}

export const metadata = {
  title: "eWallets",
  description: "La tua applicazione",
  manifest: "/manifest.json", // <-- Aggiungi questa riga esatta
}

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Evita lo zoom automatico fastidioso sui dispositivi mobile quando si legge l'UID
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <head>
        {/* Inseriamo il foglio di stile globale se serve */}
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tailwindcss/ui@latest/dist/tailwind-ui.min.css"/>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
