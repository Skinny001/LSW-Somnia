import type React from "react"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { Providers } from "./providers"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata = {
  title: "Last Staker Wins - Somnia Testnet",
  description: "Compete for the prize pool on Somnia Testnet",
  generator: "v0.app",
  icons: {
    icon: '/LSW-logo.png',
    shortcut: '/LSW-logo.png',
    apple: '/LSW-logo.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
