export const metadata = {
  title: 'Lido eWallet Cassa',
  description: 'Gestione eWallet per braccialetti NFC',
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
