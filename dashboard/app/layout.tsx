import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NUDGE',
  description: 'Capture intelligence passively. Access it when it matters.',
  icons: {
    icon: [{ url: '/landing/NUDGE.png', type: 'image/png' }],
    shortcut: '/landing/NUDGE.png',
    apple: '/landing/NUDGE.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
