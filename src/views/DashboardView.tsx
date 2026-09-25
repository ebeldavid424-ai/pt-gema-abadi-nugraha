import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  CreditCard,
  Building,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Receipt,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Eye,
  MessageCircle,
  FileText
} from 'lucide-react';
import {
  Transaction,
  Account,
  BusinessUnit,
  CompanyProfile,
  Partner,
  UserRole
} from '../types';
import {
  calculateFinancialSummary,
  PeriodFilter,
  DateFilterRange
} from '../engines/financialEngine';
import { formatRupiah, exportSummaryToExcel } from '../engines/reportEngine';
import { cancelAtomicTransaction } from '../engines/dbEngine';
import { createWhatsAppUrl } from '../utils/whatsapp';

interface DashboardViewProps {
  transactions: Transaction[];
  accounts: Account[];
  units: BusinessUnit[];
  partners: Partner[];
  selectedUnitId: string;
  onSelectUnit: (unitId: string) => void;
  companyProfile: CompanyProfile;
  userEmail: string;
  userRole: UserRole;
  onOpenReceipt: (trx: Transaction) => void;
  onOpenInvoice: (trx: Transaction) => void;
  onQuickAction: (type?: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  accounts,
  units,
  partners,
  selectedUnitId,
  onSelectUnit,
  companyProfile,
  userEmail,
  userRole,
  onOpenReceipt,
  onOpenInvoice,
  onQuickAction,
}) => {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [customRange, setCustomRange] = useState<DateFilterRange>({
    startDate: '',
    endDate: '',
  });
  const [cancellingTrxId, setCancellingTrxId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [isProcessingVoid, setIsProcessingVoid] = useState<boolean>(false);

  // Build unit name lookup
  const unitNamesMap: Record<string, string> = {};
  units.forEach((u) => {
    unitNamesMap[u.id] = u.name;
  });

  const summary = calculateFinancialSummary(
    transactions,
    accounts,
    selectedUnitId,
    period,
    customRange,
    unitNamesMap
  );

  const selectedUnitName =
    selectedUnitId === 'all'
      ? 'Semua Unit Usaha'
      : units.find((u) => u.id === selectedUnitId)?.name || 'Unit';

  const periodLabels: Record<PeriodFilter, string> = {
    today: 'Hari Ini',
    week: '7 Hari Terakhir',
    month: 'Bulan Ini',
    year: 'Tahun Berjalan',
    custom: 'Kustom Tanggal',
    all: 'Semua Waktu',
  };

  const handleVoidTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingTrxId || !cancelReason.trim()) return;

    try {
      setIsProcessingVoid(true);
      await cancelAtomicTransaction(cancellingTrxId, cancelReason.trim(), userEmail);
      setCancellingTrxId(null);
      setCancelReason('');
    } catch (err: any) {
      alert(err.message || 'Gagal membatalkan transaksi');
    } finally {
      setIsProcessingVoid(false);
    }
  };

  const handleQuickWhatsApp = (trx: Transaction) => {
    const matchedPartner = partners.find(
      (p) => p.name.toLowerCase() === trx.partyName.toLowerCase()
    );
    const phone = matchedPartner?.phone || '';
    const text = `*${companyProfile.name}*\nTransaksi: ${trx.trxNumber}\nTanggal: ${trx.date}\nPihak: ${trx.partyName}\nUraian: ${trx.itemName}\nTotal: ${formatRupiah(trx.totalAmount)} [${trx.paymentMethod}]\nStatus: Aktif\nTerima kasih.`;
    const url = createWhatsAppUrl(phone, text);
    window.open(url, '_blank');
  };

  const canVoid = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'AKUNTAN';
  const recentTransactions = transactions.slice(0, 10);

  return (
    <div className="space-y-5 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Header & Filter Controls */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">
              Executive Dashboard Owner & Manajemen
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Kondisi Keuangan Perusahaan
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Unit: <span className="font-bold text-slate-200">{selectedUnitName}</span> • Periode: <span className="font-bold text-slate-200">{periodLabels[period]}</span>
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => exportSummaryToExcel(summary, periodLabels[period], selectedUnitName, companyProfile.name)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
              title="Unduh ringkasan dashboard ke Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Excel</span>
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('SALE')}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
            >
              <span>+ Transaksi Baru</span>
            </button>
          </div>
        </div>

        {/* Filter Period Buttons */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-1.5">
          {(['today', 'week', 'month', 'year', 'all', 'custom'] as PeriodFilter[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                period === p
                  ? 'bg-amber-500 text-slate-950 font-bold shadow'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs if custom selected */}
        {period === 'custom' && (
          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-800">
            <input
              type="date"
              value={customRange.startDate}
              onChange={(e) => setCustomRange({ ...customRange, startDate: e.target.value })}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
            />
            <span className="text-xs text-slate-400">s/d</span>
            <input
              type="date"
              value={customRange.endDate}
              onChange={(e) => setCustomRange({ ...customRange, endDate: e.target.value })}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
            />
          </div>
        )}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* 1. Omzet Hari Ini */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Omzet Hari Ini</span>
            <Calendar className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-400">
            {formatRupiah(summary.omzetHariIni)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Penjualan 24 jam ini</div>
        </div>

        {/* 2. Omzet Bulan Ini */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Omzet Bulan Ini</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-300">
            {formatRupiah(summary.omzetBulanIni)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Akumulasi bulan berjalan</div>
        </div>

        {/* 3. Total Pendapatan */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Pendapatan</span>
            <ArrowDownLeft className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-teal-300">
            {formatRupiah(summary.totalPendapatan)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Omzet + Pendapatan Lain</div>
        </div>

        {/* 4. Total Pengeluaran / Beban */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Pengeluaran</span>
            <ArrowUpRight className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-rose-400">
            {formatRupiah(summary.totalPengeluaran)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Pembelian + Beban Operasional</div>
        </div>

        {/* 5. Laba / Rugi Sementara */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Laba/Rugi Sementara</span>
            {summary.labaRugiSementara >= 0 ? (
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div
            className={`text-lg sm:text-xl font-black ${
              summary.labaRugiSementara >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatRupiah(summary.labaRugiSementara)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Pendapatan dikurangi Beban</div>
        </div>

        {/* 6. Kas & Bank Tersedia */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Kas & Bank Tersedia</span>
            <Wallet className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-400">
            {formatRupiah(summary.totalKasTersedia)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Likuiditas riil saat ini</div>
        </div>

        {/* 7. Piutang Belum Dibayar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Piutang Belum Dibayar</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-blue-400">
            {formatRupiah(summary.totalPiutangBelumDibayar)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Uang tagihan di pelanggan</div>
        </div>

        {/* 8. Hutang Belum Dibayar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Hutang Belum Dibayar</span>
            <Building className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-lg sm:text-xl font-black text-purple-400">
            {formatRupiah(summary.totalHutangBelumDibayar)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Kewajiban ke supplier/toko</div>
        </div>
      </div>

      {/* Ringkasan Performa Tiap Unit Usaha */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
        <h2 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
          <span>Performa per Unit Usaha</span>
          <span className="text-xs font-normal text-slate-400">Otomatis dari transaksi</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {units.map((u) => {
            const unitData = summary.ringkasanUnit[u.id] || {
              name: u.name,
              omzet: 0,
              pengeluaran: 0,
              labaRugi: 0,
              jumlahTrx: 0,
            };

            return (
              <div
                key={u.id}
                onClick={() => onSelectUnit(u.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  selectedUnitId === u.id
                    ? 'bg-slate-800 border-amber-500/80 shadow-md ring-1 ring-amber-500'
                    : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-200">{u.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {u.code}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Omzet:</span>
                    <span className="font-semibold text-emerald-400">
                      {formatRupiah(unitData.omzet)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Beban:</span>
                    <span className="font-semibold text-rose-400">
                      {formatRupiah(unitData.pengeluaran)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800/80 font-bold">
                    <span className="text-slate-300">Laba/Rugi:</span>
                    <span className={unitData.labaRugi >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {formatRupiah(unitData.labaRugi)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 text-right pt-0.5">
                    {unitData.jumlahTrx} Transaksi
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-white">Transaksi Terkini (Real-Time)</h2>
            <p className="text-xs text-slate-400">10 transaksi aktif terakhir yang masuk ke sistem</p>
          </div>
          <span className="text-xs text-amber-400 font-bold">
            Total {transactions.length} Transaksi
          </span>
        </div>

        {recentTransactions.length === 0 ? (
          <div className="py-12 text-center text-slate-500 space-y-3">
            <Receipt className="w-12 h-12 mx-auto text-slate-600 stroke-[1.5]" />
            <div>
              <p className="text-sm font-semibold text-slate-400">Database Transaksi Kosong</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Sistem dirancang tanpa mock data. Tekan tombol "+ Transaksi Baru" untuk mencatat penjualan, pembelian, atau pengeluaran nyata pertama Anda.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onQuickAction('SALE')}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
            >
              + Catat Transaksi Sekarang
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 font-semibold">No / Tgl</th>
                  <th className="py-2.5 font-semibold">Tipe</th>
                  <th className="py-2.5 font-semibold">Unit</th>
                  <th className="py-2.5 font-semibold">Pihak / Mitra</th>
                  <th className="py-2.5 font-semibold">Uraian Barang/Jasa</th>
                  <th className="py-2.5 font-semibold text-right">Nominal</th>
                  <th className="py-2.5 font-semibold">Cara Bayar</th>
                  <th className="py-2.5 font-semibold text-center">Aksi Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentTransactions.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3">
                      <div className="font-mono font-bold text-slate-200">{trx.trxNumber}</div>
                      <div className="text-[10px] text-slate-500">{trx.date}</div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          trx.type === 'SALE'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : trx.type === 'PURCHASE'
                            ? 'bg-rose-950 text-rose-400 border border-rose-800'
                            : trx.type === 'EXPENSE'
                            ? 'bg-amber-950 text-amber-400 border border-amber-800'
                            : trx.type === 'RECEIVABLE_PAYMENT'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : trx.type === 'DEBT_PAYMENT'
                            ? 'bg-purple-950 text-purple-400 border border-purple-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {trx.type}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">
                      {unitNamesMap[trx.unitId] || trx.unitId}
                    </td>
                    <td className="py-3 font-semibold text-white">
                      {trx.partyName}
                    </td>
                    <td className="py-3 text-slate-300 max-w-xs truncate">
                      {trx.itemName}
                    </td>
                    <td className="py-3 text-right font-black text-white">
                      {formatRupiah(trx.totalAmount)}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          trx.paymentMethod === 'CREDIT'
                            ? 'bg-rose-900/60 text-rose-300'
                            : trx.paymentMethod === 'TRANSFER'
                            ? 'bg-blue-900/60 text-blue-300'
                            : 'bg-emerald-900/60 text-emerald-300'
                        }`}
                      >
                        {trx.paymentMethod === 'CREDIT' ? 'Bon' : trx.paymentMethod === 'TRANSFER' ? 'Transfer' : 'Tunai'}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* WhatsApp Click to Chat */}
                        <button
                          type="button"
                          onClick={() => handleQuickWhatsApp(trx)}
                          className="p-1 rounded bg-slate-800 hover:bg-emerald-950 text-emerald-400 transition"
                          title="Kirim Pesan Transaksi via WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>

                        {/* Faktur (Invoice) if SALE */}
                        {trx.type === 'SALE' && (
                          <button
                            type="button"
                            onClick={() => onOpenInvoice(trx)}
                            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-[10px] font-bold transition flex items-center gap-1"
                            title="Buka Faktur Penjualan"
                          >
                            <FileText className="w-3 h-3" />
                            <span>Faktur</span>
                          </button>
                        )}

                        {/* Kwitansi */}
                        <button
                          type="button"
                          onClick={() => onOpenReceipt(trx)}
                          className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-bold transition"
                          title="Cetak Kwitansi"
                        >
                          Kwitansi
                        </button>

                        {/* Void / Batal */}
                        {canVoid && (
                          <button
                            type="button"
                            onClick={() => setCancellingTrxId(trx.id)}
                            className="px-1.5 py-1 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 text-[10px] transition"
                            title="Batalkan (Void)"
                          >
                            Batal
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Void Modal Confirmation */}
      {cancellingTrxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center gap-2.5 text-rose-400 mb-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">Batalkan Transaksi (VOID)?</h3>
            </div>
            <p className="text-xs text-slate-300 mb-3">
              Transaksi tidak akan dihapus permanen, melainkan berstatus VOID dan seluruh dampaknya terhadap kas, piutang, dan laba rugi akan otomatis dinetralkan.
            </p>
            <form onSubmit={handleVoidTransaction} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Alasan Pembatalan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Kesalahan nominal, salah pilih unit..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-rose-400 focus:outline-hidden"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCancellingTrxId(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isProcessingVoid}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow"
                >
                  {isProcessingVoid ? 'Memproses...' : 'Ya, Batalkan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
