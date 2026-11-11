import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://first-class-styles.vercel.app'),
  title: 'First Class Styles | Salon & Hair Spa in Suitland, MD',
  description:
    'Book your salon appointment at First Class Styles in Suitland, Maryland. Explore sew-ins, quick weaves, silk presses, and signature hair care.',
  applicationName: 'First Class Styles – Salon & Hair Spa',
  openGraph: {
    title: 'First Class Styles | Salon & Hair Spa',
    description:
      'Professional hair services in Suitland, Maryland. Request your appointment online.',
    url: 'https://first-class-styles.vercel.app',
    siteName: 'First Class Styles – Salon & Hair Spa',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'First Class Styles | Salon & Hair Spa',
    description:
      'Professional hair services in Suitland, Maryland. Request your appointment online.',
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#080706',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
