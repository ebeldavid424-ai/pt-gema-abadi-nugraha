import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  Wallet,
  BookOpen,
  Receipt,
  FileSpreadsheet
} from 'lucide-react';
import {
  Transaction,
  Account,
  BusinessUnit,
  CompanyProfile
} from '../types';
import {
  calculateFinancialSummary,
  calculateAccountBalances,
  generateGeneralJournal,
  generateGeneralLedger,
  PeriodFilter,
  DateFilterRange
} from '../engines/financialEngine';
import { formatRupiah, exportToCSV, exportSummaryToExcel } from '../engines/reportEngine';

interface ReportsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  units: BusinessUnit[];
  selectedUnitId: string;
  companyProfile: CompanyProfile;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  transactions,
  accounts,
  units,
  selectedUnitId,
  companyProfile,
}) => {
  const [subTab, setSubTab] = useState<'PL' | 'CASHBOOK' | 'JOURNAL' | 'LEDGER'>('PL');
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState<string>('all');

  const unitNamesMap: Record<string, string> = {};
  units.forEach((u) => {
    unitNamesMap[u.id] = u.name;
  });

  const accountNamesMap: Record<string, string> = {};
  accounts.forEach((a) => {
    accountNamesMap[a.id] = a.name;
  });

  const activeTrx = transactions.filter((t) => t.status === 'ACTIVE');
  const summary = calculateFinancialSummary(
    transactions,
    accounts,
    selectedUnitId,
    period,
    undefined,
    unitNamesMap
  );

  const accountBalances = calculateAccountBalances(activeTrx, accounts);
  const journalEntries = generateGeneralJournal(activeTrx, accountNamesMap);
  const generalLedger = generateGeneralLedger(journalEntries);

  const handlePrint = () => {
    window.print();
  };

  const handleExportJournalCSV = () => {
    const rows = journalEntries.map((j) => ({
      Tanggal: j.date,
      'No Transaksi': j.trxNumber,
      Deskripsi: j.description,
      Akun: j.account,
      Debit: j.debit,
      Kredit: j.credit,
      'Unit Usaha': unitNamesMap[j.unitId] || j.unitId,
    }));
    exportToCSV(rows, `Jurnal_Umum_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3 print:p-0 print:m-0">
      {/* Top Bar for Reports Navigation & Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-black text-white">Laporan Keuangan & Akuntansi</h1>
            <p className="text-xs text-slate-400">Pusat Laba Rugi, Buku Kas, Jurnal, dan Buku Besar</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Cetak Laporan</span>
            </button>
            <button
              type="button"
              onClick={handleExportJournalCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Sub-tab selection */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('PL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              subTab === 'PL' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Laba / Rugi Sementara
          </button>
          <button
            type="button"
            onClick={() => setSubTab('CASHBOOK')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              subTab === 'CASHBOOK' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Buku Kas Harian & Bank
          </button>
          <button
            type="button"
            onClick={() => setSubTab('JOURNAL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              subTab === 'JOURNAL' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Jurnal Umum
          </button>
          <button
            type="button"
            onClick={() => setSubTab('LEDGER')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              subTab === 'LEDGER' ? 'bg-amber-500 text-slate-950 shadow' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Buku Besar (Ledger)
          </button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block text-slate-950 mb-6 border-b-2 border-slate-900 pb-3">
        <h1 className="text-xl font-black">{companyProfile.name}</h1>
        <p className="text-xs text-slate-600">{companyProfile.address}</p>
        <p className="text-xs font-bold mt-2">
          LAPORAN KEUANGAN • Tanggal Cetak: {new Date().toLocaleDateString('id-ID')}
        </p>
      </div>

      {/* 1. TAB: Laba / Rugi Sementara */}
      {subTab === 'PL' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">Laporan Laba / Rugi Komprehensif</h2>
            <p className="text-xs text-slate-400">
              Perhitungan murni pendapatan riil dikurangi seluruh beban operasional
            </p>
          </div>

          <div className="space-y-4">
            {/* PENDAPATAN */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 border-b border-slate-800 pb-1">
                1. Pendapatan Usaha
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 px-3 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-300">Pendapatan Penjualan & Jasa (Omzet)</span>
                  <span className="font-bold text-white">{formatRupiah(summary.totalOmzet)}</span>
                </div>
                <div className="flex justify-between py-1 px-3 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-300">Pendapatan Lain-lain</span>
                  <span className="font-bold text-white">{formatRupiah(summary.pendapatanLain)}</span>
                </div>
                <div className="flex justify-between py-2 px-3 bg-emerald-950/40 rounded-lg border border-emerald-900/60 font-bold text-sm">
                  <span className="text-emerald-300">TOTAL PENDAPATAN</span>
                  <span className="text-emerald-400 font-black">{formatRupiah(summary.totalPendapatan)}</span>
                </div>
              </div>
            </div>

            {/* PENGELUARAN / BEBAN */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-400 border-b border-slate-800 pb-1">
                2. Beban & Pengeluaran Operasional
              </h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1 px-3 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-300">Beban Pembelian & Material</span>
                  <span className="font-bold text-white">
                    {formatRupiah(
                      activeTrx
                        .filter((t) => t.type === 'PURCHASE')
                        .reduce((acc, t) => acc + t.totalAmount, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-1 px-3 bg-slate-950/40 rounded-lg">
                  <span className="text-slate-300">Beban Operasional, Gaji & Proyek</span>
                  <span className="font-bold text-white">
                    {formatRupiah(
                      activeTrx
                        .filter((t) => t.type === 'EXPENSE')
                        .reduce((acc, t) => acc + t.totalAmount, 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between py-2 px-3 bg-rose-950/40 rounded-lg border border-rose-900/60 font-bold text-sm">
                  <span className="text-rose-300">TOTAL PENGELUARAN</span>
                  <span className="text-rose-400 font-black">{formatRupiah(summary.totalPengeluaran)}</span>
                </div>
              </div>
            </div>

            {/* HASIL LABA RUGI */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400">HASIL AKHIR:</span>
                <div className="text-lg font-black text-white">LABA / RUGI SEMENTARA</div>
              </div>
              <div
                className={`text-xl sm:text-2xl font-black ${
                  summary.labaRugiSementara >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatRupiah(summary.labaRugiSementara)}
              </div>
            </div>

            {/* POSISI KEUANGAN TERPISAH (Bukan Laba) */}
            <div className="pt-4 border-t border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                Posisi Kas & Kewajiban (Bukan Termasuk Laba)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Total Kas & Saldo Bank</div>
                  <div className="text-base font-bold text-amber-400">{formatRupiah(summary.totalKasTersedia)}</div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Piutang Belum Tertagih</div>
                  <div className="text-base font-bold text-blue-400">{formatRupiah(summary.totalPiutangBelumDibayar)}</div>
                </div>
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="text-slate-400 text-[11px]">Hutang Belum Dibayar</div>
                  <div className="text-base font-bold text-purple-400">{formatRupiah(summary.totalHutangBelumDibayar)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TAB: Buku Kas Harian & Bank */}
      {subTab === 'CASHBOOK' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {accounts.map((acc) => (
              <div key={acc.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span className="text-xs font-bold text-slate-200">{acc.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                    {acc.type}
                  </span>
                </div>
                <div className="text-lg font-black text-emerald-400">
                  {formatRupiah(accountBalances[acc.id] || 0)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Rek: {acc.accountNumber || '-'}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow overflow-hidden">
            <h2 className="text-sm font-bold text-white mb-3">Arus Kas Masuk & Keluar Harian</h2>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 font-semibold">Tanggal</th>
                    <th className="py-2.5 font-semibold">No Bukti</th>
                    <th className="py-2.5 font-semibold">Keterangan</th>
                    <th className="py-2.5 font-semibold">Akun Kas/Bank</th>
                    <th className="py-2.5 font-semibold text-right text-emerald-400">Uang Masuk</th>
                    <th className="py-2.5 font-semibold text-right text-rose-400">Uang Keluar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activeTrx
                    .filter((t) => t.paymentMethod !== 'CREDIT')
                    .map((t) => {
                      const isIncoming = t.type === 'SALE' || t.type === 'INCOME' || t.type === 'RECEIVABLE_PAYMENT';
                      return (
                        <tr key={t.id} className="hover:bg-slate-800/40">
                          <td className="py-2.5 text-slate-400">{t.date}</td>
                          <td className="py-2.5 font-mono text-slate-300">{t.trxNumber}</td>
                          <td className="py-2.5 font-medium text-white max-w-xs truncate">
                            {t.itemName} ({t.partyName})
                          </td>
                          <td className="py-2.5 text-slate-400">{accountNamesMap[t.accountId] || t.accountId}</td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">
                            {isIncoming ? formatRupiah(t.totalAmount) : '-'}
                          </td>
                          <td className="py-2.5 text-right font-bold text-rose-400">
                            {!isIncoming ? formatRupiah(t.totalAmount) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. TAB: Jurnal Umum */}
      {subTab === 'JOURNAL' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Jurnal Umum (Double-Entry Otomatis)</h2>
              <p className="text-xs text-slate-400">Sistem otomatis mencatat debit dan kredit berimbang</p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 font-semibold">Tanggal</th>
                  <th className="py-2.5 font-semibold">No Transaksi</th>
                  <th className="py-2.5 font-semibold">Akun Perkiraan</th>
                  <th className="py-2.5 font-semibold">Keterangan</th>
                  <th className="py-2.5 font-semibold text-right">Debit (Rp)</th>
                  <th className="py-2.5 font-semibold text-right">Kredit (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {journalEntries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40">
                    <td className="py-2 text-slate-400 font-sans">{entry.date}</td>
                    <td className="py-2 text-amber-300">{entry.trxNumber}</td>
                    <td className="py-2 font-bold text-white">{entry.account}</td>
                    <td className="py-2 text-slate-300 font-sans max-w-xs truncate">{entry.description}</td>
                    <td className="py-2 text-right text-emerald-400">
                      {entry.debit > 0 ? formatRupiah(entry.debit) : '-'}
                    </td>
                    <td className="py-2 text-right text-rose-400">
                      {entry.credit > 0 ? formatRupiah(entry.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. TAB: Buku Besar (General Ledger) */}
      {subTab === 'LEDGER' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Buku Besar Akuntansi (General Ledger)</h2>
              <p className="text-xs text-slate-400">Histori saldo mutasi per akun perkiraan</p>
            </div>
            <select
              value={selectedLedgerAccount}
              onChange={(e) => setSelectedLedgerAccount(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white"
            >
              <option value="all">-- Tampilkan Semua Akun --</option>
              {Object.keys(generalLedger).map((accName) => (
                <option key={accName} value={accName}>
                  {accName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-6">
            {Object.keys(generalLedger)
              .filter((acc) => selectedLedgerAccount === 'all' || selectedLedgerAccount === acc)
              .map((accName) => {
                const ledger = generalLedger[accName];
                return (
                  <div key={accName} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                        Akun: {ledger.accountName}
                      </span>
                      <span className="text-xs font-black text-white">
                        Saldo Akhir: {formatRupiah(ledger.finalBalance)}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-800/80">
                            <th className="py-1.5">Tanggal</th>
                            <th className="py-1.5">No Transaksi</th>
                            <th className="py-1.5">Keterangan</th>
                            <th className="py-1.5 text-right">Debit</th>
                            <th className="py-1.5 text-right">Kredit</th>
                            <th className="py-1.5 text-right">Saldo Berjalan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40 font-mono text-[11px]">
                          {ledger.entries.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              <td className="py-1.5 text-slate-400 font-sans">{item.date}</td>
                              <td className="py-1.5 text-slate-300">{item.trxNumber}</td>
                              <td className="py-1.5 text-slate-300 font-sans">{item.description}</td>
                              <td className="py-1.5 text-right text-emerald-400">
                                {item.debit > 0 ? formatRupiah(item.debit) : '-'}
                              </td>
                              <td className="py-1.5 text-right text-rose-400">
                                {item.credit > 0 ? formatRupiah(item.credit) : '-'}
                              </td>
                              <td className="py-1.5 text-right font-bold text-white">
                                {formatRupiah(item.runningBalance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
