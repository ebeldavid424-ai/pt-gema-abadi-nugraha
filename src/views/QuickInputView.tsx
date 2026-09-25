import React, { useState } from 'react';
import {
  Calendar,
  Building2,
  User,
  FileText,
  Wallet,
  Clock,
  Camera,
  Check,
  AlertCircle,
  Sparkles,
  CheckCircle2
} from 'lucide-react';
import {
  TransactionType,
  PaymentMethod,
  BusinessUnit,
  Partner,
  Account,
  ExpenseCategory,
  ProductItem,
  UserProfile,
  Transaction
} from '../types';
import { createAtomicTransaction, generateTrxNumber } from '../engines/dbEngine';
import { uploadFileToGoogleDrive, saveDocumentRecord } from '../engines/documentEngine';
import { formatRupiah } from '../engines/reportEngine';

interface QuickInputViewProps {
  units: BusinessUnit[];
  partners: Partner[];
  accounts: Account[];
  expenseCategories: ExpenseCategory[];
  products: ProductItem[];
  existingTransactionsCount: number;
  userProfile: UserProfile;
  currentEmail: string;
  driveConnected: boolean;
  onOpenReceipt: (trx: Transaction) => void;
}

export const QuickInputView: React.FC<QuickInputViewProps> = ({
  units,
  partners,
  accounts,
  expenseCategories,
  products,
  existingTransactionsCount,
  userProfile,
  currentEmail,
  driveConnected,
  onOpenReceipt,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [type, setType] = useState<TransactionType>('SALE');
  const [date, setDate] = useState<string>(todayStr);
  const [unitId, setUnitId] = useState<string>(units[0]?.id || 'bengkel');
  const [partyName, setPartyName] = useState<string>('');
  const [partyType, setPartyType] = useState<string>('PELANGGAN');
  const [itemName, setItemName] = useState<string>('');
  const [itemCategory, setItemCategory] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || 'kas_utama');
  const [destinationAccountId, setDestinationAccountId] = useState<string>(accounts[1]?.id || '');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Receipt File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedTrx, setSavedTrx] = useState<Transaction | null>(null);

  const handleTypeSelect = (t: TransactionType) => {
    setType(t);
    if (t === 'SALE') {
      setPartyType('PELANGGAN');
      setPaymentMethod('CASH');
    } else if (t === 'PURCHASE') {
      setPartyType('SUPPLIER');
      setPaymentMethod('CASH');
    } else if (t === 'EXPENSE') {
      setPartyType('KARYAWAN');
      setPaymentMethod('CASH');
    } else if (t === 'RECEIVABLE_PAYMENT') {
      setPartyType('PELANGGAN');
      setPaymentMethod('CASH');
    } else if (t === 'DEBT_PAYMENT') {
      setPartyType('SUPPLIER');
      setPaymentMethod('CASH');
    }
  };

  const handleQtyChange = (val: number) => {
    setQty(val);
    setTotalAmount(val * unitPrice);
  };

  const handlePriceChange = (val: number) => {
    setUnitPrice(val);
    setTotalAmount(qty * val);
  };

  const handleDirectTotalChange = (val: number) => {
    setTotalAmount(val);
    if (qty > 0) {
      setUnitPrice(Math.round(val / qty));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFilePreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (totalAmount <= 0) {
      setErrorMessage('Nominal transaksi harus lebih dari 0.');
      return;
    }

    if (!partyName && type !== 'EXPENSE' && type !== 'TRANSFER') {
      setErrorMessage('Nama pelanggan / supplier / pihak wajib diisi.');
      return;
    }

    if (!itemName && type !== 'TRANSFER') {
      setErrorMessage('Uraian transaksi barang / jasa wajib diisi.');
      return;
    }

    try {
      setIsSubmitting(true);
      const trxNumber = generateTrxNumber(type, date, existingTransactionsCount);

      const newTrxData: Omit<Transaction, 'id'> = {
        trxNumber,
        type,
        date,
        unitId,
        partyName: partyName.trim() || (type === 'TRANSFER' ? 'Internal' : 'Umum'),
        partyType: partyType as any,
        itemName: itemName.trim() || 'Transaksi',
        ...(itemCategory && itemCategory.trim() ? { itemCategory: itemCategory.trim() } : {}),
        qty: Number(qty) || 1,
        unitPrice: Number(unitPrice) || Number(totalAmount),
        totalAmount: Number(totalAmount),
        paymentMethod,
        accountId,
        ...(type === 'TRANSFER' && destinationAccountId ? { destinationAccountId } : {}),
        ...(paymentMethod === 'CREDIT' && dueDate ? { dueDate } : {}),
        ...(notes && notes.trim() ? { notes: notes.trim() } : {}),
        status: 'ACTIVE',
        createdBy: currentEmail || userProfile.email || 'user',
        createdByName: userProfile.displayName || userProfile.role,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newId = await createAtomicTransaction(newTrxData, currentEmail || userProfile.email);

      if (selectedFile) {
        let driveRes = null;
        if (driveConnected) {
          driveRes = await uploadFileToGoogleDrive(selectedFile);
        }

        await saveDocumentRecord({
          transactionId: newId,
          name: selectedFile.name,
          mimeType: selectedFile.type,
          size: selectedFile.size,
          storageType: driveRes?.fileId ? 'DRIVE' : 'LOCAL',
          driveFileId: driveRes?.fileId,
          webViewLink: driveRes?.webViewLink,
          dataUrl: filePreview || undefined,
          notes: `Lampiran ${trxNumber}`,
          uploadedBy: currentEmail || userProfile.email,
          uploadedAt: new Date().toISOString(),
        });
      }

      const completedTrx: Transaction = {
        ...newTrxData,
        id: newId,
      };

      setSavedTrx(completedTrx);
      // Reset form
      setPartyName('');
      setItemName('');
      setTotalAmount(0);
      setUnitPrice(0);
      setQty(1);
      setNotes('');
      setSelectedFile(null);
      setFilePreview(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan transaksi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-2xl mx-auto px-3 sm:px-4 pt-3">
      {/* View Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">
          Operator Terminal
        </span>
        <h1 className="text-lg font-black text-white">Input Cepat Transaksi</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Tanggal → Jenis Transaksi → Nama Pihak → Barang/Jasa → Nominal → Cara Bayar → Simpan
        </p>
      </div>

      {savedTrx && (
        <div className="p-4 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Transaksi {savedTrx.trxNumber} Berhasil Disimpan!</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenReceipt(savedTrx)}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow"
            >
              Lihat Kwitansi
            </button>
          </div>
          <p className="text-emerald-400">
            {savedTrx.partyName} • {savedTrx.itemName} • {formatRupiah(savedTrx.totalAmount)} [{savedTrx.paymentMethod}]
          </p>
        </div>
      )}

      {/* Main Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow">
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Jenis Transaksi */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              1. Pilih Jenis Transaksi
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'SALE', label: 'Penjualan' },
                { id: 'PURCHASE', label: 'Pembelian' },
                { id: 'EXPENSE', label: 'Uang Keluar' },
                { id: 'INCOME', label: 'Uang Masuk' },
                { id: 'RECEIVABLE_PAYMENT', label: 'Bayar Piutang' },
                { id: 'DEBT_PAYMENT', label: 'Bayar Hutang' },
                { id: 'TRANSFER', label: 'Transfer Bank' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeSelect(t.id as any)}
                  className={`py-2.5 px-2 text-xs font-bold rounded-xl border text-center transition ${
                    type === t.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md scale-[1.02]'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Tanggal & Unit Usaha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                Tanggal Transaksi
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                Unit Usaha
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
              >
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 3. Nama Pihak */}
          {type !== 'TRANSFER' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                Nama Pihak (Pelanggan / Supplier / Toko Material)
              </label>
              <input
                type="text"
                placeholder="Ketik nama pelanggan atau toko..."
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
              />
            </div>
          )}

          {/* 4. Uraian Barang / Jasa */}
          {type !== 'TRANSFER' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Uraian Barang, Jasa, atau Biaya
              </label>
              <input
                type="text"
                placeholder="Contoh: Semen Gresik, Servis Dinamo, Bensin Pick Up..."
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
              />
            </div>
          )}

          {/* 5. Nominal Total */}
          <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Qty
                </label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => handleQtyChange(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm text-center font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Harga Satuan (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  value={unitPrice || ''}
                  onChange={(e) => handlePriceChange(Number(e.target.value))}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[11px] font-bold text-amber-400 mb-1">
                  Total Nominal (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalAmount || ''}
                  onChange={(e) => handleDirectTotalChange(Number(e.target.value))}
                  placeholder="Rp 0"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border-2 border-amber-500 rounded-xl text-amber-300 font-black text-base"
                />
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              Terhitung: <span className="font-bold text-emerald-400">{formatRupiah(totalAmount)}</span>
            </div>
          </div>

          {/* 6. Cara Bayar & Akun */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {type !== 'TRANSFER' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cara Bayar
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CASH')}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition ${
                      paymentMethod === 'CASH'
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Tunai
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('TRANSFER')}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition ${
                      paymentMethod === 'TRANSFER'
                        ? 'bg-blue-500 text-white border-blue-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Transfer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('CREDIT')}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border text-center transition ${
                      paymentMethod === 'CREDIT'
                        ? 'bg-rose-500 text-white border-rose-400'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    Bon (Kredit)
                  </button>
                </div>
              </div>
            )}

            {paymentMethod !== 'CREDIT' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  Akun Kas / Bank
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {paymentMethod === 'CREDIT' && (
              <div>
                <label className="block text-xs font-semibold text-rose-400 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Jatuh Tempo Bon
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-rose-500 rounded-xl text-rose-300 text-sm"
                />
              </div>
            )}
          </div>

          {/* 7. Foto Nota / Slip Kamera */}
          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-amber-400" />
              Foto Nota / Slip Pembayaran
            </label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-400 transition">
                <Camera className="w-4 h-4" />
                <span>Kamera Ponsel</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {selectedFile && (
                <span className="text-xs text-slate-300 truncate max-w-[200px]">
                  {selectedFile.name}
                </span>
              )}
            </div>
            {filePreview && (
              <div className="mt-2.5 w-24 h-24 rounded-lg overflow-hidden border border-slate-700">
                <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan ke Financial Engine...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>SIMPAN TRANSAKSI SEKARANG</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
