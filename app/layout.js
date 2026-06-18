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
      </body>
    </html>
  )
}
