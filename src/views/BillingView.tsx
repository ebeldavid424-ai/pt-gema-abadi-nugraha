import React, { useState } from 'react';
import {
  Receipt,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Filter,
  ArrowRight,
  MessageCircle,
  Phone,
  X
} from 'lucide-react';
import { Transaction, Account, UserProfile, Partner, CompanyProfile } from '../types';
import { calculateReceivables, calculatePayables, ReceivableItem, PayableItem } from '../engines/financialEngine';
import { formatRupiah } from '../engines/reportEngine';
import { createAtomicTransaction, generateTrxNumber } from '../engines/dbEngine';
import { createWhatsAppUrl, generateBillingReminderWAMessage } from '../utils/whatsapp';

interface BillingViewProps {
  transactions: Transaction[];
  accounts: Account[];
  partners: Partner[];
  companyProfile: CompanyProfile;
  userProfile: UserProfile;
  currentEmail: string;
  onOpenReceipt: (trx: Transaction) => void;
  transactionsCount: number;
}

export const BillingView: React.FC<BillingViewProps> = ({
  transactions,
  accounts,
  partners,
  companyProfile,
  userProfile,
  currentEmail,
  onOpenReceipt,
  transactionsCount,
}) => {
  const [activeTab, setActiveTab] = useState<'RECEIVABLES' | 'PAYABLES'>('RECEIVABLES');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'DUE' | 'PAID'>('UNPAID');

  // Payment Modal state
  const [payingItem, setPayingItem] = useState<{
    type: 'RECEIVABLE' | 'PAYABLE';
    item: ReceivableItem | PayableItem;
  } | null>(null);

  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentAccountId, setPaymentAccountId] = useState<string>(accounts[0]?.id || 'kas_utama');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // WhatsApp Billing Reminder State
  const [waReminderItem, setWaReminderItem] = useState<ReceivableItem | null>(null);
  const [targetPhone, setTargetPhone] = useState<string>('');

  const activeTrx = transactions.filter((t) => t.status === 'ACTIVE');
  const receivables = calculateReceivables(activeTrx);
  const payables = calculatePayables(activeTrx);

  const totalPiutangOutstanding = receivables.reduce((sum, r) => sum + r.remainingAmount, 0);
  const totalHutangOutstanding = payables.reduce((sum, p) => sum + p.remainingAmount, 0);

  const filterList = (items: (ReceivableItem | PayableItem)[]) => {
    return items.filter((item) => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'UNPAID') return item.remainingAmount > 0;
      if (statusFilter === 'DUE') return item.status === 'JATUH_TEMPO';
      if (statusFilter === 'PAID') return item.status === 'LUNAS';
      return true;
    });
  };

  const displayedReceivables = filterList(receivables) as ReceivableItem[];
  const displayedPayables = filterList(payables) as PayableItem[];

  const handleOpenPayModal = (type: 'RECEIVABLE' | 'PAYABLE', item: ReceivableItem | PayableItem) => {
    setPayingItem({ type, item });
    setPaymentAmount(item.remainingAmount);
    setPaymentNotes(`Pelunasan bon untuk ${item.trxNumber}`);
  };

  const handleOpenWaReminder = (item: ReceivableItem) => {
    const matched = partners.find(
      (p) => p.name.toLowerCase() === item.partyName.toLowerCase()
    );
    setTargetPhone(matched?.phone || '');
    setWaReminderItem(item);
  };

  const handleSendWaReminder = () => {
    if (!waReminderItem) return;
    const msg = generateBillingReminderWAMessage(
      waReminderItem.partyName,
      waReminderItem.trxNumber,
      waReminderItem.itemName,
      waReminderItem.totalAmount,
      waReminderItem.paidAmount,
      waReminderItem.remainingAmount,
      waReminderItem.dueDate,
      companyProfile
    );
    const url = createWhatsAppUrl(targetPhone, msg);
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.click();
    setWaReminderItem(null);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingItem || paymentAmount <= 0) return;
    setPaymentError(null);

    try {
      setIsSubmitting(true);
      const isReceivable = payingItem.type === 'RECEIVABLE';
      const trxType = isReceivable ? 'RECEIVABLE_PAYMENT' : 'DEBT_PAYMENT';
      const trxNumber = generateTrxNumber(trxType, paymentDate, transactionsCount);

      const paymentTrx: Omit<Transaction, 'id'> = {
        trxNumber,
        type: trxType,
        date: paymentDate,
        unitId: payingItem.item.unitId || 'umum',
        partyName: payingItem.item.partyName,
        partyType: isReceivable ? 'PELANGGAN' : 'SUPPLIER',
        itemName: isReceivable
          ? `Pembayaran Piutang (${payingItem.item.trxNumber})`
          : `Pembayaran Hutang (${payingItem.item.trxNumber})`,
        qty: 1,
        unitPrice: paymentAmount,
        totalAmount: paymentAmount,
        paymentMethod: 'CASH',
        accountId: paymentAccountId,
        referenceTrxId: payingItem.item.id,
        ...(paymentNotes && paymentNotes.trim() ? { notes: paymentNotes.trim() } : {}),
        status: 'ACTIVE',
        createdBy: currentEmail || userProfile.email || 'user',
        createdByName: userProfile.displayName || userProfile.role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createAtomicTransaction(paymentTrx, currentEmail || userProfile.email);
      setPayingItem(null);
    } catch (err: any) {
      setPaymentError(err.message || 'Gagal memproses pembayaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Header Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div
          onClick={() => setActiveTab('RECEIVABLES')}
          className={`p-4 rounded-2xl border cursor-pointer transition ${
            activeTab === 'RECEIVABLES'
              ? 'bg-blue-950/50 border-blue-500 shadow-lg shadow-blue-950/40 ring-1 ring-blue-500'
              : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-blue-400">Buku Piutang (Pelanggan)</span>
            <CreditCard className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {formatRupiah(totalPiutangOutstanding)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {receivables.filter((r) => r.remainingAmount > 0).length} bon belum lunas
          </div>
        </div>

        <div
          onClick={() => setActiveTab('PAYABLES')}
          className={`p-4 rounded-2xl border cursor-pointer transition ${
            activeTab === 'PAYABLES'
              ? 'bg-purple-950/50 border-purple-500 shadow-lg shadow-purple-950/40 ring-1 ring-purple-500'
              : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-purple-400">Buku Hutang (Supplier / Toko)</span>
            <Building className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white">
            {formatRupiah(totalHutangOutstanding)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {payables.filter((p) => p.remainingAmount > 0).length} bon belum dibayar
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setStatusFilter('UNPAID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'UNPAID'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Belum Lunas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('DUE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'DUE'
                ? 'bg-rose-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Jatuh Tempo
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PAID')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'PAID'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Lunas
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'ALL'
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Semua
          </button>
        </div>
      </div>

      {/* Receivables / Payables List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow">
        <h2 className="text-sm font-bold text-white mb-3">
          {activeTab === 'RECEIVABLES'
            ? 'Daftar Piutang Penjualan (Bon Pelanggan)'
            : 'Daftar Hutang Pembelian (Bon Supplier)'}
        </h2>

        {(activeTab === 'RECEIVABLES' ? displayedReceivables : displayedPayables).length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
            <p className="text-xs font-semibold text-slate-400">Tidak ada data tagihan yang sesuai filter</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {(activeTab === 'RECEIVABLES' ? displayedReceivables : displayedPayables).map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-300">
                      {item.trxNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'LUNAS'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : item.status === 'JATUH_TEMPO'
                          ? 'bg-rose-950 text-rose-400 border border-rose-800 animate-pulse'
                          : item.status === 'SEBAGIAN'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800'
                          : 'bg-amber-950 text-amber-400 border border-amber-800'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-sm font-bold text-white">{item.partyName}</div>
                  <div className="text-xs text-slate-400">{item.itemName}</div>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                    <span>Tgl: {item.date}</span>
                    {item.dueDate && (
                      <span className={item.status === 'JATUH_TEMPO' ? 'text-rose-400 font-bold' : ''}>
                        Tempo: {item.dueDate}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] text-slate-400">Sisa Tagihan:</div>
                    <div className="text-base font-black text-rose-400">
                      {formatRupiah(item.remainingAmount)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Total: {formatRupiah(item.totalAmount)} • Terbayar: {formatRupiah(item.paidAmount)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Kirim Tagihan WhatsApp button for Receivables */}
                    {activeTab === 'RECEIVABLES' && item.remainingAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenWaReminder(item as ReceivableItem)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow flex items-center gap-1"
                        title="Kirim pemberitahuan tagihan via WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Kirim Tagihan</span>
                      </button>
                    )}

                    {item.remainingAmount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenPayModal(activeTab === 'RECEIVABLES' ? 'RECEIVABLE' : 'PAYABLE', item)}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow flex items-center gap-1.5"
                      >
                        <span>Bayar</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pay Modal */}
      {payingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1">
              {payingItem.type === 'RECEIVABLE' ? 'Penerimaan Pelunasan Piutang' : 'Pembayaran Pelunasan Hutang'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Bon: {payingItem.item.trxNumber} • {payingItem.item.partyName}
            </p>

            <form onSubmit={handleProcessPayment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nominal Pembayaran (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  max={payingItem.item.remainingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border-2 border-amber-500 rounded-xl text-amber-400 font-bold text-base"
                />
                <div className="text-right text-[11px] text-slate-400 mt-1">
                  Sisa Maks: {formatRupiah(payingItem.item.remainingAmount)}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Tanggal Pembayaran
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {payingItem.type === 'RECEIVABLE' ? 'Diterima di Akun' : 'Dibayar dari Akun'}
                </label>
                <select
                  value={paymentAccountId}
                  onChange={(e) => setPaymentAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Catatan Pelunasan
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              {paymentError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {paymentError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingItem(null)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WhatsApp Billing Reminder Modal Prompt */}
      {waReminderItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-white space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <MessageCircle className="w-4 h-4" />
                <span>Kirim Tagihan via WhatsApp</span>
              </div>
              <button
                type="button"
                onClick={() => setWaReminderItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Pemberitahuan tagihan untuk <b>{waReminderItem.partyName}</b> sebesar <b>{formatRupiah(waReminderItem.remainingAmount)}</b> akan otomatis diformat.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nomor WhatsApp Tujuan
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="08123456789..."
                  value={targetPhone}
                  onChange={(e) => setTargetPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-400 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setWaReminderItem(null)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSendWaReminder}
                className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Buka WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
