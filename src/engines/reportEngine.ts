import * as XLSX from 'xlsx';
import { JournalEntry, LedgerAccount } from '../types';
import { FinancialSummary } from './financialEngine';

/**
 * Export table data to CSV format
 */
export function exportToCSV(rows: Record<string, any>[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export Financial Summary and unit breakdown to Excel (.xlsx)
 */
export function exportSummaryToExcel(
  summary: FinancialSummary,
  periodName: string,
  unitName: string,
  companyName: string = 'PT. GEMA ABADI NUGRAHA'
): void {
  const wb = XLSX.utils.book_new();

  const summarySheetData = [
    { Parameter: 'Nama Perusahaan', Nilai: companyName },
    { Parameter: 'Periode Laporan', Nilai: periodName },
    { Parameter: 'Unit Usaha', Nilai: unitName },
    { Parameter: 'Tanggal Cetak', Nilai: new Date().toLocaleDateString('id-ID') },
    { Parameter: '', Nilai: '' },
    { Parameter: 'TOTAL PENDAPATAN', Nilai: summary.totalPendapatan },
    { Parameter: '  - Pendapatan Penjualan (Omzet)', Nilai: summary.totalOmzet },
    { Parameter: '  - Pendapatan Lain-lain', Nilai: summary.pendapatanLain },
    { Parameter: 'TOTAL PENGELUARAN / BEBAN', Nilai: summary.totalPengeluaran },
    { Parameter: 'LABA / RUGI SEMENTARA', Nilai: summary.labaRugiSementara },
    { Parameter: '', Nilai: '' },
    { Parameter: 'POSISI KEUANGAN LAINNYA', Nilai: '' },
    { Parameter: 'Total Kas & Saldo Bank Tersedia', Nilai: summary.totalKasTersedia },
    { Parameter: 'Total Piutang Belum Tertagih', Nilai: summary.totalPiutangBelumDibayar },
    { Parameter: 'Total Hutang Belum Dibayar', Nilai: summary.totalHutangBelumDibayar },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Laba Rugi & Posisi');

  // Breakdown Unit Usaha Sheet
  const unitBreakdown = Object.values(summary.ringkasanUnit).map((u: any) => ({
    'Unit Usaha': u.name,
    'Jumlah Transaksi': u.jumlahTrx,
    Omzet: u.omzet,
    'Beban / Pengeluaran': u.pengeluaran,
    'Laba / Rugi': u.labaRugi,
  }));
  const wsUnits = XLSX.utils.json_to_sheet(unitBreakdown);
  XLSX.utils.book_append_sheet(wb, wsUnits, 'Performa Unit');

  XLSX.writeFile(wb, `Laporan_Keuangan_${unitName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

/**
 * Format currency to Rupiah format
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);
}
