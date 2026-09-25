import React, { useState, useRef } from 'react';
import {
  X,
  Printer,
  Share2,
  Download,
  Building,
  CheckCircle,
  FileText,
  MessageCircle,
  Phone
} from 'lucide-react';
import { Transaction, CompanyProfile, Partner, Account } from '../types';
import { formatTerbilang, shareDocumentOrText } from '../engines/documentEngine';
import { formatRupiah } from '../engines/reportEngine';
import { createWhatsAppUrl, generateReceiptWAMessage } from '../utils/whatsapp';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  companyProfile: CompanyProfile;
  partners?: Partner[];
  accounts?: Account[];
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  companyProfile,
  partners = [],
  accounts = [],
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [showWhatsAppPrompt, setShowWhatsAppPrompt] = useState(false);
  const [targetPhone, setTargetPhone] = useState('');

  if (!isOpen || !transaction) return null;

  const receiptNo = transaction.trxNumber.replace(/^(PJL|PBL|KLR|MSK|BYP|BYH|TRF|TRX)/, 'KWT');
  const terbilangText = formatTerbilang(transaction.totalAmount);

  const matchedPartner = partners.find(
    (p) => p.name.toLowerCase() === transaction.partyName.toLowerCase()
  );

  const selectedAccount = accounts.find((a) => a.id === transaction.accountId);

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
    const text = generateReceiptWAMessage(transaction, companyProfile, receiptNo, accounts);
    const url = createWhatsAppUrl(targetPhone, text);
    window.open(url, '_blank');
    setShowWhatsAppPrompt(false);
  };

  const handleShare = async () => {
    const text = generateReceiptWAMessage(transaction, companyProfile, receiptNo, accounts);
    await shareDocumentOrText(`Kwitansi ${receiptNo}`, text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none">
        {/* Actions Bar (hidden on print) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Kwitansi Resmi
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

        {/* Printable Official Receipt Body */}
        <div ref={receiptRef} className="p-6 sm:p-8 space-y-6 overflow-y-auto bg-white">
          {/* Header PT */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight uppercase">
                {companyProfile.name}
              </h1>
              <p className="text-xs text-slate-600 mt-1">{companyProfile.address}</p>
              <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-1">
                <span>Telp: {companyProfile.phone}</span>
                <span>Email: {companyProfile.email}</span>
                {companyProfile.taxId && <span>NPWP: {companyProfile.taxId}</span>}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 rounded bg-slate-100 text-slate-900 font-black text-base tracking-widest border border-slate-300">
                KWITANSI
              </div>
              <p className="text-xs font-mono font-bold text-slate-700 mt-1">
                No: {receiptNo}
              </p>
            </div>
          </div>

          {/* Receipt Data Table */}
          <div className="space-y-3.5 text-sm">
            <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Telah Diterima Dari:</span>
              <span className="col-span-2 font-bold text-slate-900 uppercase">
                {transaction.partyName || '-'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Uang Sejumlah:</span>
              <div className="col-span-2">
                <span className="text-base sm:text-lg font-black text-slate-900">
                  {formatRupiah(transaction.totalAmount)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-2 px-3 rounded-lg bg-amber-50 border border-amber-200">
              <span className="text-amber-800 font-semibold text-xs">Terbilang:</span>
              <span className="col-span-2 text-xs font-bold italic text-amber-950">
                # {terbilangText} #
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Untuk Pembayaran:</span>
              <div className="col-span-2 font-semibold text-slate-800">
                <p>{transaction.itemName}</p>
                {transaction.notes && (
                  <p className="text-xs text-slate-500 mt-0.5">{transaction.notes}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Metode Pembayaran:</span>
              <span className="col-span-2 font-medium text-slate-800">
                {transaction.paymentMethod === 'CASH'
                  ? 'Kas Tunai'
                  : transaction.paymentMethod === 'TRANSFER'
                  ? 'Transfer Bank'
                  : 'Bon / Kredit'}
                {selectedAccount && transaction.paymentMethod !== 'CREDIT' && (
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {selectedAccount.name}
                    {selectedAccount.bankName ? ' • ' + selectedAccount.bankName : ''}
                    {selectedAccount.accountNumber ? ' • ' + selectedAccount.accountNumber : ''}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Signatures & Verification */}
          <div className="pt-4 flex items-end justify-between text-xs">
            <div>
              <div className="p-2 border border-dashed border-slate-300 rounded text-[10px] text-slate-500 w-36 text-center">
                <span className="font-mono">{transaction.id.substring(0, 12).toUpperCase()}</span>
                <p className="mt-0.5 text-[9px] text-emerald-600 font-bold">VERIFIED VALID</p>
              </div>
            </div>

            <div className="text-center w-48">
              <p className="text-slate-600 mb-1">{formattedDate}</p>
              <p className="text-slate-500 text-[11px] mb-12">Petugas Administrasi,</p>
              <p className="font-bold text-slate-950 border-t border-slate-400 pt-1">
                {transaction.createdByName || 'Petugas Keuangan'}
              </p>
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-slate-500">
            {companyProfile.receiptFooter || 'Terima kasih atas kerja sama dan kepercayaan Anda.'}
          </div>
        </div>

        {/* WhatsApp Prompt Modal */}
        {showWhatsAppPrompt && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl text-white space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <MessageCircle className="w-4 h-4" />
                  <span>Kirim Kwitansi via WhatsApp</span>
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
                Pesan kwitansi resmi akan otomatis terisi dan siap dikirimkan kepada pelanggan via WhatsApp.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nomor WhatsApp Penerima
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
