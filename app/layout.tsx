import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "next-auth/react"
import { UpdateHint } from "@/components/update-hint"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sledování studií",
  description: "Přehled vysokoškolského a středoškolského studia: předměty, známky, materiály a zápisy.",
  icons: {
    icon: [
      {
        url: "/favicon.svg",
        type: "image/svg+xml",
      },
      {
        url: "/favicon.png",
        type: "image/png",
        sizes: "32x32",
      },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  generator: "zicha-study",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    // Matches --background in the .dark block of app/globals.css (224 20% 8%).
    { media: "(prefers-color-scheme: dark)", color: "#101318" },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="zs_theme"
            disableTransitionOnChange
          >
            {children}
            <UpdateHint />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
