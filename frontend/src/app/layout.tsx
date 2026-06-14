import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { NavbarWrapper } from "@/components/navbar-wrapper"
import { Suspense } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "CodeArena - Competencias de Programación",
  description: "Plataforma de competencias de programación con problemas de LeetCode",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Suspense fallback={null}>
            <div className="min-h-screen bg-background">
              <NavbarWrapper />
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
          </Suspense>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
