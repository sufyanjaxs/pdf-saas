import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PDF & Image Tools — Fast · Free · No Login',
  description:
    'A blazing-fast PDF and image toolbox that runs 100% in your browser. Split, merge, compress, convert and more — your files never leave your device.',
  keywords:
    'pdf tools, merge pdf, split pdf, compress pdf, pdf to jpg, jpg to pdf, image compressor, free online tools',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
