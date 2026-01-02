import '@/app/ui/global.css';
import { Montserrat } from 'next/font/google';
import { Metadata } from 'next';

const montserrat = Montserrat({ subsets: ['latin'] });

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
      <body className={`${montserrat.className} antialiased`}>{children}</body>
    </html>
  );
}