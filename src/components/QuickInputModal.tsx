import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Check,
  AlertCircle,
  Calendar,
  Building2,
  User,
  Wallet,
  FileText,
  Clock,
  Sparkles
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

interface QuickInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: TransactionType;
  units: BusinessUnit[];
  partners: Partner[];
  accounts: Account[];
  expenseCategories: ExpenseCategory[];
  products: ProductItem[];
  existingTransactionsCount: number;
  userProfile: UserProfile;
  currentEmail: string;
  driveConnected: boolean;
  onSuccess: (trxId: string) => void;
}

export const QuickInputModal: React.FC<QuickInputModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'SALE',
  units,
  partners,
  accounts,
  expenseCategories,
  products,
  existingTransactionsCount,
  userProfile,
  currentEmail,
  driveConnected,
  onSuccess,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const itemCategoryOptions = ['Material', 'Barang', 'Jasa', 'Sparepart', 'Peralatan', 'Bahan Bakar', 'Lainnya'];

  const [type, setType] = useState<TransactionType>(defaultType);
  const [date, setDate] = useState<string>(todayStr);
  const [unitId, setUnitId] = useState<string>(units[0]?.id || '');
  const [partyName, setPartyName] = useState<string>('');
  const [partyType, setPartyType] = useState<string>('PELANGGAN');
  const [itemName, setItemName] = useState<string>('');
  const [itemCategory, setItemCategory] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id || '');
  const [destinationAccountId, setDestinationAccountId] = useState<string>(accounts[1]?.id || '');
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Receipt / Nota Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync default type when opened
  useEffect(() => {
    setType(defaultType);
    setItemCategory('');
    if (defaultType === 'SALE') {
      setPartyType('PELANGGAN');
      setPaymentMethod('CASH');
    } else if (defaultType === 'PURCHASE') {
      setPartyType('SUPPLIER');
      setPaymentMethod('CASH');
    } else if (defaultType === 'RECEIVABLE_PAYMENT') {
      setPaymentMethod('CASH');
      setPartyType('PELANGGAN');
    } else if (defaultType === 'DEBT_PAYMENT') {
      setPaymentMethod('CASH');
      setPartyType('SUPPLIER');
    } else if (defaultType === 'EXPENSE') {
      setPaymentMethod('CASH');
      setPartyType('KARYAWAN');
    }
  }, [defaultType, isOpen]);

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    setItemCategory('');
    setDueDate('');
    if (nextType === 'SALE') {
      setPartyType('PELANGGAN');
      setPaymentMethod('CASH');
    } else if (nextType === 'PURCHASE') {
      setPartyType('SUPPLIER');
      setPaymentMethod('CASH');
    } else if (nextType === 'RECEIVABLE_PAYMENT') {
      setPartyType('PELANGGAN');
      setPaymentMethod('CASH');
    } else if (nextType === 'DEBT_PAYMENT') {
      setPartyType('SUPPLIER');
      setPaymentMethod('CASH');
    } else if (nextType === 'EXPENSE') {
      setPartyType('KARYAWAN');
      setPaymentMethod('CASH');
    } else if (nextType === 'TRANSFER') {
      setPartyType('LAINNYA');
      setPaymentMethod('TRANSFER');
    }
    setTotalAmount(0);
    setUnitPrice(0);
  };

  if (!isOpen) return null;

  // Recalculate total amount when qty or price changes
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

  // Autocomplete from Product Catalog
  const handleSelectProduct = (prod: ProductItem) => {
    setItemName(prod.name);
    setUnitPrice(prod.defaultPrice);
    setTotalAmount(qty * prod.defaultPrice);
    if (prod.unitId) {
      setUnitId(prod.unitId);
    }
  };

  // Autocomplete from Partner Catalog
  const handleSelectPartner = (p: Partner) => {
    setPartyName(p.name);
    setPartyType(p.type);
  };

  // Handle camera / file select
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
      setErrorMessage('Nominal total transaksi harus lebih dari 0.');
      return;
    }

    if (!partyName && type !== 'EXPENSE' && type !== 'TRANSFER') {
      setErrorMessage('Silakan isi atau pilih nama pihak (pelanggan / supplier / mitra).');
      return;
    }

    if (!unitId) {
      setErrorMessage('Silakan pilih Unit Usaha.');
      return;
    }

    if (!itemName && type !== 'TRANSFER') {
      setErrorMessage('Silakan isi uraian barang, jasa, atau pengeluaran.');
      return;
    }

    if ((type === 'SALE' || type === 'PURCHASE') && !itemCategory.trim()) {
      setErrorMessage('Kategori Barang/Jasa wajib dipilih untuk penjualan atau pembelian.');
      return;
    }

    if (type !== 'TRANSFER' && paymentMethod !== 'CREDIT' && !accountId) {
      setErrorMessage('Silakan pilih akun Kas/Bank.');
      return;
    }

    if (paymentMethod === 'CREDIT' && !dueDate) {
      setErrorMessage('Jatuh tempo wajib diisi untuk transaksi Bon/Kredit.');
      return;
    }

    if (type === 'TRANSFER' && (!accountId || !destinationAccountId)) {
      setErrorMessage('Pilih akun asal dan akun tujuan transfer.');
      return;
    }

    if (type === 'TRANSFER' && accountId === destinationAccountId) {
      setErrorMessage('Akun asal dan akun tujuan transfer tidak boleh sama.');
      return;
    }

    try {
      setIsSubmitting(true);

      const trxNumber = generateTrxNumber(type, date, existingTransactionsCount);

      // Create atomic transaction in Firestore
      const newTrxData: Omit<Transaction, 'id'> = {
        trxNumber,
        type,
        date,
        unitId,
        partyName: partyName.trim() || (type === 'TRANSFER' ? 'Internal Transfer' : 'Umum'),
        partyType: partyType as any,
        itemName: itemName.trim() || (type === 'TRANSFER' ? 'Transfer Antar Akun' : 'Transaksi'),
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

      const newTrxId = await createAtomicTransaction(newTrxData, currentEmail || userProfile.email);

      // Upload Document if selected
      if (selectedFile) {
        let driveRes = null;
        if (driveConnected) {
          driveRes = await uploadFileToGoogleDrive(selectedFile);
        }

        await saveDocumentRecord({
          transactionId: newTrxId,
          name: selectedFile.name,
          mimeType: selectedFile.type,
          size: selectedFile.size,
          storageType: driveRes?.fileId ? 'DRIVE' : 'LOCAL',
          driveFileId: driveRes?.fileId,
          webViewLink: driveRes?.webViewLink,
          dataUrl: filePreview || undefined,
          notes: `Lampiran untuk transaksi ${trxNumber}`,
          uploadedBy: currentEmail || userProfile.email,
          uploadedAt: new Date().toISOString(),
        });
      }

      onSuccess(newTrxId);
      onClose();
    } catch (err: any) {
      console.error('Error saving transaction:', err);
      setErrorMessage(err.message || 'Gagal menyimpan transaksi. Periksa koneksi internet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[95vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              +
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                Input Transaksi: {type === 'SALE' ? 'Penjualan' : type === 'PURCHASE' ? 'Pembelian' : type === 'EXPENSE' ? 'Uang Keluar' : type === 'INCOME' ? 'Uang Masuk' : type === 'RECEIVABLE_PAYMENT' ? 'Bayar Piutang' : type === 'DEBT_PAYMENT' ? 'Bayar Hutang' : 'Transfer Antar Akun'}
              </h2>
              <p className="text-xs text-slate-400">Pencatatan langsung ke Financial Engine</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Transaction Type Selector Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
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
                  onClick={() => handleTypeChange(t.id as TransactionType)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition ${
                    type === t.id
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tanggal */}
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

            {/* Unit Usaha */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                Unit Usaha
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
              >
                <option value="" disabled>-- Pilih Unit Usaha --</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Nama Pihak (Pelanggan / Supplier / Toko Material) */}
          {type !== 'TRANSFER' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  {type === 'SALE' || type === 'RECEIVABLE_PAYMENT'
                    ? 'Nama Pelanggan'
                    : type === 'PURCHASE' || type === 'DEBT_PAYMENT'
                    ? 'Nama Supplier / Toko Material'
                    : 'Penerima / Pembayar'}
                </label>
                {partners.length > 0 && (
                  <span className="text-[11px] text-amber-400">Pilih dari Mitra</span>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik nama pelanggan, supplier, atau toko..."
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
                  required
                />
              </div>

              {/* Quick Partner Select Pill Suggestions */}
              {partners.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 mt-1">
                  {partners.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectPartner(p)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition"
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Uraian Barang / Jasa / Kategori Biaya */}
          {type !== 'TRANSFER' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  {type === 'EXPENSE' ? 'Kategori & Keterangan Biaya' : 'Barang / Jasa / Uraian'}
                </label>
                {type === 'EXPENSE' ? (
                  <select
                    value={itemCategory}
                    onChange={(e) => {
                      setItemCategory(e.target.value);
                      if (!itemName) setItemName(e.target.value);
                    }}
                    required
                    className="text-[11px] bg-slate-800 text-amber-300 border border-slate-700 rounded-lg px-2 py-0.5"
                  >
                    <option value="">-- Kategori Biaya --</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (type === 'SALE' || type === 'PURCHASE') ? (
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    required
                    className="text-[11px] bg-slate-800 text-amber-300 border border-slate-700 rounded-lg px-2 py-0.5"
                  >
                    <option value="">-- Kategori Barang/Jasa --</option>
                    {itemCategoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                ) : null}
              </div>
              <input
                type="text"
                placeholder={
                  type === 'SALE'
                    ? 'Contoh: Servis Mesin, Jasa Cor, Semen Gresik 10 Sak...'
                    : type === 'PURCHASE'
                    ? 'Contoh: Besi Beton 10mm, Oli Shell, Batu Split...'
                    : type === 'EXPENSE'
                    ? 'Contoh: Bensin Pick Up Operasional, Gaji Mingguan Mandor...'
                    : 'Uraian transaksi...'
                }
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
                required
              />

              {/* Quick Products Suggestion */}
              {products.length > 0 && (type === 'SALE' || type === 'PURCHASE') && (
                <div className="flex items-center gap-1.5 overflow-x-auto py-1 mt-1">
                  {products.slice(0, 5).map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => handleSelectProduct(prod)}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-[11px] whitespace-nowrap transition"
                    >
                      {prod.name} (Rp{prod.defaultPrice.toLocaleString('id-ID')})
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Qty, Unit Price & Total Nominal */}
          <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {type !== 'TRANSFER' && type !== 'RECEIVABLE_PAYMENT' && type !== 'DEBT_PAYMENT' && (
                <>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Jumlah (Qty)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={qty}
                      onChange={(e) => handleQtyChange(Math.max(1, Number(e.target.value) || 1))}
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
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm font-semibold"
                    />
                  </div>
                </>
              )}

              {/* Total Nominal Besar */}
              <div className={type === 'TRANSFER' || type === 'RECEIVABLE_PAYMENT' || type === 'DEBT_PAYMENT' ? 'col-span-full' : 'col-span-full sm:col-span-1'}>
                <label className="block text-[11px] font-bold text-amber-400 mb-1">
                  Total Nominal (Rp)
                </label>
                <input
                  type="number"
                  min="1"
                  value={totalAmount || ''}
                  onChange={(e) => handleDirectTotalChange(Number(e.target.value))}
                  readOnly={type === 'SALE' || type === 'PURCHASE'}
                  placeholder="Rp 0"
                  required
                  className="w-full px-3 py-2 bg-slate-800 border-2 border-amber-500/50 rounded-xl text-amber-300 text-base font-black tracking-wide"
                />
              </div>
            </div>
            <div className="text-right text-xs font-semibold text-slate-400">
              Terhitung: <span className="text-emerald-400 font-bold">Rp {totalAmount.toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Cara Bayar & Akun Kas/Bank */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Cara Bayar (Tunai vs Transfer vs Bon) */}
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
                    Tunai (Kas)
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
                    Bank Transfer
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

            {/* Akun Kas / Bank */}
            {paymentMethod !== 'CREDIT' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  {type === 'TRANSFER' ? 'Dari Akun (Asal)' : 'Masuk / Keluar Melalui'}
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
                >
                  <option value="" disabled>-- Pilih Akun --</option>
                  <option value="" disabled>-- Pilih Akun Asal --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Jatuh Tempo jika Bon */}
            {paymentMethod === 'CREDIT' && (
              <div>
                <label className="block text-xs font-semibold text-rose-400 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Tanggal Jatuh Tempo Bon
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-rose-500/50 rounded-xl text-rose-300 text-sm focus:border-rose-400 focus:outline-hidden"
                />
              </div>
            )}

            {/* Destinasi Transfer jika Transfer */}
            {type === 'TRANSFER' && (
              <div>
                <label className="block text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  Ke Akun (Tujuan)
                </label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-emerald-500/50 rounded-xl text-white text-sm focus:border-emerald-400 focus:outline-hidden"
                >
                  <option value="" disabled>-- Pilih Akun Tujuan --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Keterangan & Catatan */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Catatan / Keterangan (Opsional)
            </label>
            <input
              type="text"
              placeholder="Catatan tambahan untuk transaksi ini..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:border-amber-400 focus:outline-hidden"
            />
          </div>

          {/* Foto Nota / Kwitansi / Slip */}
          <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-400" />
                Foto Nota / Kwitansi / Slip Pembayaran
              </label>
              {driveConnected ? (
                <span className="text-[10px] text-emerald-400 font-medium">✓ Auto-upload ke Google Drive</span>
              ) : (
                <span className="text-[10px] text-amber-400 font-medium">Tersimpan di Dokumen Lokal</span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <label className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-amber-400 transition">
                <Camera className="w-4 h-4" />
                <span>Ambil Foto / Pilih File</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
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
              <div className="mt-2.5 relative w-24 h-24 rounded-lg overflow-hidden border border-slate-700">
                <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setFilePreview(null);
                  }}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-slate-900/90 text-rose-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 active:scale-[0.99] transition flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Menyimpan ke Financial Engine...</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 stroke-[2.5]" />
                  <span>SIMPAN TRANSAKSI (ATOMIC)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
