import '@/app/ui/global.css';
import { inter } from '@/app/ui/fonts';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | Bamlo Enterprise',
    default: 'Bamlo Enterprise',
  },
  description: 'The official Website for Bamlo Enterprise',
  metadataBase: new URL('https://barmlo.co.zw/index.php/services/agricultural-processing'),
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}