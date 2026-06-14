import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Learnprint — Learn from your own code",
  description: "Upload your GitHub project and get a personalized step-by-step curriculum generated from your actual code. Like FreeCodeCamp, but from YOUR project.",
  keywords: ["learn to code", "personalized learning", "AI curriculum", "project-based learning"],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-[#0a0a0f] text-[#e8e8f0] antialiased">
        {children}
      </body>
    </html>
  )
}
