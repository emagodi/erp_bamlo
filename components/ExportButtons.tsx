'use client';

import { Document, Page, Text, View, StyleSheet, PDFDownloadLink } from '@react-pdf/renderer';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

// Define styles for the PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    paddingVertical: 5,
  },
  col1: {
    width: '60%',
  },
  col2: {
    width: '20%',
    textAlign: 'right',
  },
  col3: {
    width: '20%',
    textAlign: 'right',
  },
  totalRow: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#000000',
  },
});

// PDF Document Component
const QuoteDocument = ({ data }: { data: any }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>Quotation</Text>
        <Text style={styles.subtitle}>Reference: {data.number || 'DRAFT'}</Text>
        <Text style={styles.subtitle}>Date: {new Date().toLocaleDateString()}</Text>
        <Text style={styles.subtitle}>Customer: {data.customer?.displayName}</Text>
      </View>

      <View style={styles.section}>
        <View style={[styles.row, { borderBottomWidth: 2 }]}>
          <Text style={[styles.col1, { fontWeight: 'bold' }]}>Description</Text>
          <Text style={[styles.col2, { fontWeight: 'bold' }]}>Qty</Text>
          <Text style={[styles.col3, { fontWeight: 'bold' }]}>Amount</Text>
        </View>

        {data.lines?.map((line: any, i: number) => (
          <View key={i} style={styles.row}>
            <Text style={styles.col1}>{line.description}</Text>
            <Text style={styles.col2}>{line.quantity}</Text>
            <Text style={styles.col3}>${(Number(line.lineTotalMinor) / 100).toFixed(2)}</Text>
          </View>
        ))}

        <View style={styles.totalRow}>
          <Text style={styles.col1}>Total</Text>
          <Text style={styles.col2}></Text>
          <Text style={styles.col3}>
            ${(data.lines?.reduce((acc: number, line: any) => acc + Number(line.lineTotalMinor), 0) / 100).toFixed(2)}
          </Text>
        </View>
      </View>
    </Page>
  </Document>
);

export default function ExportButtons({ data }: { data: any }) {
  return (
    <div className="flex gap-2">
      <PDFDownloadLink
        document={<QuoteDocument data={data} />}
        fileName={`quote-${data.number || 'draft'}.pdf`}
        className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
      >
        {({ blob, url, loading, error }) =>
          loading ? 'Generating PDF...' : (
            <>
              <ArrowDownTrayIcon className="-ml-0.5 h-5 w-5 text-gray-400" aria-hidden="true" />
              Export PDF
            </>
          )
        }
      </PDFDownloadLink>
      
      {/* Word export placeholder - requires different library like docx */}
      <button 
        className="inline-flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 opacity-50 cursor-not-allowed"
        disabled
        title="Word export coming soon"
      >
        Export Word
      </button>
    </div>
  );
}
