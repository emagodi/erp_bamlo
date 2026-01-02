// lib/pdf/QuoteDoc.tsx
import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image, Svg, Path } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10 },
  h1: { fontSize: 14, marginBottom: 6 },
  row: { flexDirection: 'row' },
  header: { marginTop: 8, marginBottom: 6, fontSize: 12, fontWeight: 700 },
  cell: { paddingVertical: 2, paddingRight: 6 },
  th: {
    fontWeight: 700,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 3,
    marginBottom: 3,
  },
  // simple fixed widths to avoid layout warnings
  cIdx: { width: 32 },
  cDesc: { width: 240 },
  cUnit: { width: 60 },
  cQty: { width: 60, textAlign: 'right' },
  cAmt: { width: 80, textAlign: 'right' },
});

type PdfLine = {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  lineTotalMinor: number;
};

type PdfQuote = {
  id: string;
  number: string | null;
  currency: string;
  vatBps: number; // e.g. 1500
  status: string;
  customer: { displayName: string } | null;
};

const money = (minor: number, currency: string) =>
  `${currency === 'USD' ? 'US$' : ''}${(minor / 100).toFixed(2)}`;

export default function QuoteDoc({ quote, lines }: { quote: PdfQuote; lines: PdfLine[] }) {
  const currency = String(quote.currency || 'USD');
  const number = quote.number ? String(quote.number) : `#${quote.id.slice(0, 6)}`;
  const customerName = quote.customer?.displayName ? String(quote.customer.displayName) : '';

  // guard: ensure only numbers/strings end up in <Text>
  const safeLines = Array.isArray(lines) ? lines : [];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, borderBottomWidth: 2, borderBottomColor: '#581c87', paddingBottom: 10 }}>
          <View style={{ alignItems: 'center' }}>
             {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={process.cwd() + "/public/barmlo_logo.png"} style={{ width: 150, height: 60, objectFit: 'contain' }} />
            <Text style={{ color: '#f97316', fontStyle: 'italic', fontSize: 10, marginTop: 4, fontWeight: 'medium' }}>Your happiness is our pride</Text>
          </View>
          
          <View style={{ flexDirection: 'column', gap: 4 }}>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Svg viewBox="0 0 24 24" style={{ width: 12, height: 12, color: '#581c87' }}>
                   <Path fill="#581c87" d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 101.06-1.06l-8.689-8.69a2.25 2.25 0 00-3.182 0l-8.69 8.69a.75.75 0 001.061 1.06l8.69-8.69z M12 5.432l8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75V21a.75.75 0 01-.75.75H5.625a1.875 1.875 0 01-1.875-1.875v-6.198a2.29 2.29 0 00.091-.086L12 5.43z" />
                </Svg>
                <Text style={{ fontSize: 9, color: '#581c87', fontStyle: 'italic', fontWeight: 'bold' }}>3294, Light Industry Mberengwa{'\n'}Business Center</Text>
             </View>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Svg viewBox="0 0 24 24" style={{ width: 12, height: 12, color: '#581c87' }}>
                   <Path fill="#581c87" d="M1.5 8.67v8.58a3 3 0 003 3h15a3 3 0 003-3V8.67l-8.928 5.493a3 3 0 01-3.144 0L1.5 8.67z M22.5 6.908V6.75a3 3 0 00-3-3h-15a3 3 0 00-3 3v.158l9.714 5.978a1.5 1.5 0 001.572 0L22.5 6.908z" />
                </Svg>
                <Text style={{ fontSize: 9, color: '#581c87', fontStyle: 'italic', fontWeight: 'bold' }}>info@barmlo.co.zw</Text>
             </View>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Svg viewBox="0 0 24 24" style={{ width: 12, height: 12, color: '#581c87' }}>
                   <Path fill="#581c87" d="M21.721 12.752a9.711 9.711 0 00-.945-5.003 12.754 12.754 0 01-4.339 2.708 18.991 18.991 0 01-.214 4.772 17.165 17.165 0 005.498-2.477z M14.634 15.55a17.324 17.324 0 00.332-4.647c-.952.227-1.945.347-2.966.347-1.021 0-2.014-.12-2.966-.347a17.515 17.515 0 00.332 4.647 17.387 17.387 0 005.268 0z M9.772 17.119a18.963 18.963 0 004.456 0A17.182 17.182 0 0112 21.724a17.16 17.16 0 01-2.228-4.605z M7.777 15.275a18.991 18.991 0 01-.214-4.772 12.754 12.754 0 01-4.339-2.708 9.711 9.711 0 00-.944 5.003 17.165 17.165 0 005.497 2.477z M21.356 14.752a9.765 9.765 0 01-7.478 6.817 18.64 18.64 0 001.988-4.718 18.627 18.627 0 005.49-2.099z M2.644 14.752c1.682.971 3.53 1.688 5.49 2.099a18.64 18.64 0 001.988 4.718 9.765 9.765 0 01-7.478-6.817z M6.111 7.79a17.158 17.158 0 011.903-4.407 9.686 9.686 0 00-3.61 3.002 18.7 18.7 0 001.707 1.405z M12 2.276a17.152 17.152 0 012.805 4.495 17.2 17.2 0 00-5.61 0A17.151 17.151 0 0112 2.276z M15.986 3.383a17.158 17.158 0 011.903 4.407 18.7 18.7 0 001.707-1.405 9.686 9.686 0 00-3.61-3.002z" />
                </Svg>
                <Text style={{ fontSize: 9, color: '#581c87', fontStyle: 'italic', fontWeight: 'bold' }}>www.barmlo.co.zw</Text>
             </View>
          </View>
        </View>

        <Text style={styles.h1}>Quote {number}</Text>
        <Text>Customer: {customerName}</Text>
        <Text>VAT: {(quote.vatBps / 100).toFixed(2)}%</Text>
        <Text>Status: {String(quote.status || '')}</Text>

        <Text style={styles.header}>Items</Text>

        <View style={[styles.row, styles.th]}>
          <Text style={[styles.cell, styles.cIdx]}>Item</Text>
          <Text style={[styles.cell, styles.cDesc]}>Description</Text>
          <Text style={[styles.cell, styles.cUnit]}>Unit</Text>
          <Text style={[styles.cell, styles.cQty]}>Qty</Text>
          <Text style={[styles.cell, styles.cAmt]}>Amount</Text>
        </View>

        {safeLines.map((l, i) => (
          <View key={String(l.id)} style={styles.row}>
            <Text style={[styles.cell, styles.cIdx]}>{String(i + 1)}</Text>
            <Text style={[styles.cell, styles.cDesc]}>{String(l.description || '')}</Text>
            <Text style={[styles.cell, styles.cUnit]}>{String(l.unit || '')}</Text>
            <Text style={[styles.cell, styles.cQty]}>{Number(l.quantity || 0).toFixed(3)}</Text>
            <Text style={[styles.cell, styles.cAmt]}>
              {money(Number(l.lineTotalMinor || 0), currency)}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
