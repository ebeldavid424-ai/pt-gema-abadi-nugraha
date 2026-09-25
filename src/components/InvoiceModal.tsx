import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  Building,
  CheckCircle,
  FileSpreadsheet,
  MessageCircle,
  Phone
} from 'lucide-react';
import { Transaction, CompanyProfile, Partner, Account, BusinessUnit } from '../types';
import { formatTerbilang, shareDocumentOrText } from '../engines/documentEngine';
import { formatRupiah } from '../engines/reportEngine';
import { createWhatsAppUrl, generateInvoiceWAMessage } from '../utils/whatsapp';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  companyProfile: CompanyProfile;
  partners: Partner[];
  accounts: Account[];
  units: BusinessUnit[];
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  transaction,
  companyProfile,
  partners,
  accounts,
  units,
}) => {
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [targetPhone, setTargetPhone] = useState('');

  if (!isOpen || !transaction) return null;

  const invoiceNo = transaction.trxNumber.replace(/^(PJL|PBL|KLR|MSK|BYP|BYH|TRF|TRX)/, 'INV');
  const terbilangText = formatTerbilang(transaction.totalAmount);

  // Try to find partner phone
  const matchedPartner = partners.find(
    (p) => p.name.toLowerCase() === transaction.partyName.toLowerCase()
  );

  const selectedUnitName = units.find((u) => u.id === transaction.unitId)?.name || transaction.unitId;
  const selectedAccount = accounts.find((a) => a.id === transaction.accountId);
  const activeBankAccounts = accounts.filter((a) => a.isActive && a.type === 'BANK');

  const formattedDate = new Date(transaction.date).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleOpenWhatsAppPrompt = () => {
    setTargetPhone(matchedPartner?.phone || '');
    setShowWhatsAppPrompt(true);
  };

  const handleSendWhatsApp = () => {
    const message = generateInvoiceWAMessage(transaction, companyProfile, invoiceNo, accounts);
    const url = createWhatsAppUrl(targetPhone, message);
    window.open(url, '_blank');
    setShowWhatsAppPrompt(false);
  };

  const handleShare = async () => {
    const message = generateInvoiceWAMessage(transaction, companyProfile, invoiceNo, accounts);
    await shareDocumentOrText(`Faktur Penjualan ${invoiceNo}`, message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none">
        {/* Actions Bar (hidden on print) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Faktur Penjualan (Invoice)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenWhatsAppPrompt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Kirim WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>Cetak / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Bagikan</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Invoice Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto bg-white font-sans text-xs sm:text-sm">
          {/* Header PT */}
          <div className="border-b-2 border-slate-900 pb-4 flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-black text-lg">
                  G
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight uppercase">
                  {companyProfile.name}
                </h1>
              </div>
              <p className="text-xs text-slate-600">{companyProfile.address}</p>
              <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 mt-1">
                <span>Telp: {companyProfile.phone}</span>
                <span>Email: {companyProfile.email}</span>
                {companyProfile.taxId && <span>NPWP: {companyProfile.taxId}</span>}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="inline-block px-3 py-1 rounded bg-amber-400 text-slate-950 font-black text-sm tracking-wider uppercase">
                FAKTUR PENJUALAN
              </div>
              <p className="text-xs font-mono font-bold text-slate-800 mt-1">
                No: {invoiceNo}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tanggal: {formattedDate}
              </p>
            </div>
          </div>

          {/* Customer / Billed To Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400">Ditagihkan Kepada:</span>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 uppercase">
                {transaction.partyName || 'Pelanggan Tunai'}
              </h3>
              {matchedPartner?.address && (
                <p className="text-xs text-slate-600 mt-0.5">{matchedPartner.address}</p>
              )}
              {matchedPartner?.phone && (
                <p className="text-xs text-slate-600 mt-0.5">Telp/WA: {matchedPartner.phone}</p>
              )}
            </div>

            <div className="space-y-1 sm:text-right text-xs">
              <div>
                <span className="text-slate-500">Status Pembayaran:</span>{' '}
                <span className="font-bold text-slate-900">
                  {transaction.paymentMethod === 'CREDIT' ? 'BON / KREDIT' : 'LUNAS (TUNAI / TRANSFER)'}
                </span>
              </div>
              {transaction.paymentMethod === 'CREDIT' && transaction.dueDate && (
                <div>
                  <span className="text-rose-600 font-semibold">Jatuh Tempo:</span>{' '}
                  <span className="font-bold text-rose-700">{transaction.dueDate}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500">Unit Usaha:</span>{' '}
                <span className="font-bold text-slate-900 uppercase">{selectedUnitName}</span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3">Uraian Barang / Jasa</th>
                  <th className="py-2.5 px-3 text-center">Qty</th>
                  <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                  <th className="py-2.5 px-3 text-right">Total (Rp)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="py-3 px-3 text-center text-slate-500 font-mono">1</td>
                  <td className="py-3 px-3 font-semibold text-slate-900">
                    {transaction.itemName}
                    {transaction.notes && (
                      <div className="text-[11px] text-slate-500 font-normal mt-0.5">{transaction.notes}</div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center font-bold text-slate-800">{transaction.qty}</td>
                  <td className="py-3 px-3 text-right text-slate-700">{formatRupiah(transaction.unitPrice)}</td>
                  <td className="py-3 px-3 text-right font-black text-slate-900">{formatRupiah(transaction.totalAmount)}</td>
                </tr>
              </tbody>
              <tfoot className="border-t-2 border-slate-900 font-bold bg-slate-50 text-xs">
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right text-slate-700">SUBTOTAL:</td>
                  <td className="py-2.5 px-3 text-right text-slate-900">{formatRupiah(transaction.totalAmount)}</td>
                </tr>
                <tr>
                  <td colSpan={4} className="py-2.5 px-3 text-right text-slate-900 font-black text-sm">TOTAL AKHIR:</td>
                  <td className="py-2.5 px-3 text-right font-black text-slate-950 text-base">{formatRupiah(transaction.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Terbilang Box */}
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
            <span className="font-semibold text-amber-800">Terbilang:</span>{' '}
            <span className="font-bold italic text-amber-950"># {terbilangText} #</span>
          </div>

          {/* Bank Payment Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1">
              <span className="font-bold text-slate-700 uppercase">Rekening Bank Resmi Perusahaan</span>
              {activeBankAccounts.length > 0 ? activeBankAccounts.map((a) => (
                <p key={a.id} className="text-slate-600">
                  • {a.bankName || a.name}: <span className="font-bold font-mono text-slate-900">{a.accountNumber || 'Nomor belum diisi'}</span>{a.accountHolder ? ' a.n. ' + a.accountHolder : ''}
                </p>
              )) : (
                <p className="text-amber-700">Belum ada rekening bank aktif. Atur di Pengaturan → Kas, Bank & E-Wallet.</p>
              )}
              <p className="text-slate-500 italic text-[10px] mt-1">Gunakan rekening yang tercantum di sistem ini untuk pembayaran.</p>
            </div>

            {/* Account actually used */}
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] space-y-1">
              <span className="font-bold text-blue-800 uppercase">Akun yang Dipakai Transaksi</span>
              <p className="text-slate-700">{selectedAccount?.name || 'Akun tidak ditemukan'}</p>
              {selectedAccount?.bankName && <p className="text-slate-600">Bank: {selectedAccount.bankName}</p>}
              {selectedAccount?.accountNumber && <p className="text-slate-600">No. Rek: <span className="font-mono font-bold">{selectedAccount.accountNumber}</span></p>}
            </div>

            {/* Signature Box */}
            <div className="text-center text-xs flex flex-col justify-end">
              <p className="text-slate-600 mb-12">Hormat Kami,</p>
              <p className="font-bold text-slate-950 border-t border-slate-400 pt-1">
                {companyProfile.name}
              </p>
              <span className="text-[10px] text-slate-500">Authorized Signature</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Prompt Modal */}
        {showWhatsAppPrompt && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <MessageCircle className="w-4 h-4" />
                  <span>Kirim Faktur via WhatsApp</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWhatsAppPrompt(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300">
                Pesan faktur lengkap dan rincian transaksi akan otomatis terisi di WhatsApp tujuan.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nomor WhatsApp Pelanggan
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    placeholder="Contoh: 08123456789 atau 62812..."
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-emerald-400 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppPrompt(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
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
    </div>
  );
};
