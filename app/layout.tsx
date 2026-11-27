import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Seata Saga State Machine Designer',
  description:
    'Visual state machine designer, validator, JSON editor, and compensation simulator for Apache Seata Saga distributed transactions.',
  openGraph: {
    title: 'Seata Saga State Machine Designer',
    description:
      'Visual state machine designer, validator, JSON editor, and compensation simulator for Apache Seata Saga distributed transactions.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Seata Saga State Machine Designer',
    description:
      'Visual state machine designer, validator, JSON editor, and compensation simulator for Apache Seata Saga distributed transactions.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="zh-Hant"
      className={`${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans antialiased bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 overflow-x-hidden"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
