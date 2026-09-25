import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  RefreshCw,
  Download
} from 'lucide-react';
import { createAtomicTransaction, generateTrxNumber } from '../engines/dbEngine';
import { Account, BusinessUnit, Transaction, TransactionType, PaymentMethod } from '../types';

interface ImportItem {
  trxNumber: string;
  date: string;
  type: TransactionType;
  unitId: string;
  partyName: string;
  partyType?: Transaction['partyType'];
  itemName: string;
  itemCategory: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  accountId: string;
  destinationAccountId?: string;
  dueDate?: string;
  referenceTrxId?: string;
  notes?: string;
  isValid: boolean;
  errors: string[];
}

interface ImportExportViewProps {
  userEmail: string;
  transactionsCount: number;
  units: BusinessUnit[];
  accounts: Account[];
}

const TYPE_MAP: Record<string, TransactionType> = {
  SALE: 'SALE',
  PENJUALAN: 'SALE',
  PURCHASE: 'PURCHASE',
  PEMBELIAN: 'PURCHASE',
  EXPENSE: 'EXPENSE',
  PENGELUARAN: 'EXPENSE',
  INCOME: 'INCOME',
  PENDAPATAN: 'INCOME',
  RECEIVABLE_PAYMENT: 'RECEIVABLE_PAYMENT',
  BAYAR_PIUTANG: 'RECEIVABLE_PAYMENT',
  DEBT_PAYMENT: 'DEBT_PAYMENT',
  BAYAR_HUTANG: 'DEBT_PAYMENT',
  TRANSFER: 'TRANSFER',
};

const METHOD_MAP: Record<string, PaymentMethod> = {
  CASH: 'CASH',
  TUNAI: 'CASH',
  TRANSFER: 'TRANSFER',
  BANK_TRANSFER: 'TRANSFER',
  CREDIT: 'CREDIT',
  BON: 'CREDIT',
  KREDIT: 'CREDIT',
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function findUnitId(value: unknown, units: BusinessUnit[]): string {
  const raw = normalizeText(value);
  if (!raw) return '';
  const byId = units.find((u) => u.id.toLowerCase() === raw.toLowerCase());
  if (byId) return byId.id;
  const byName = units.find((u) => u.name.toLowerCase() === raw.toLowerCase());
  return byName?.id || '';
}

function findAccountId(value: unknown, accounts: Account[]): string {
  const raw = normalizeText(value);
  if (!raw) return '';
  const byId = accounts.find((a) => a.id.toLowerCase() === raw.toLowerCase());
  if (byId) return byId.id;
  const byName = accounts.find((a) => a.name.toLowerCase() === raw.toLowerCase());
  return byName?.id || '';
}

export const ImportExportView: React.FC<ImportExportViewProps> = ({
  userEmail,
  transactionsCount,
  units,
  accounts,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result;
        if (!(buffer instanceof ArrayBuffer)) {
          throw new Error('Isi file tidak dapat dibaca.');
        }

        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('Sheet Excel tidak ditemukan.');

        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
          defval: '',
        });

        const validated: ImportItem[] = rawRows.map((row, idx) => {
          const errors: string[] = [];
          const date = normalizeText(row['Tanggal'] || row['date']);
          const rawType = normalizeText(row['Tipe'] || row['type']).toUpperCase();
          const type = TYPE_MAP[rawType];
          const partyName = normalizeText(
            row['Pihak / Mitra'] || row['Pelanggan'] || row['partyName'] || row['Nama Pihak']
          );
          const itemName = normalizeText(row['Barang / Uraian'] || row['Barang'] || row['itemName']);
          const itemCategory = normalizeText(row['Kategori'] || row['itemCategory']);
          const qty = Number(row['Qty'] || row['qty']);
          const totalAmount = Number(row['Total'] || row['totalAmount'] || row['Nominal']);
          const unitPrice = Number(row['Harga Satuan'] || row['unitPrice']);
          const rawMethod = normalizeText(row['Metode Bayar'] || row['paymentMethod']).toUpperCase();
          const paymentMethod = METHOD_MAP[rawMethod];
          const unitId = findUnitId(row['Unit Usaha'] || row['unitId'], units);
          const accountId = findAccountId(row['Akun'] || row['accountId'], accounts);
          const destinationAccountId = findAccountId(
            row['Akun Tujuan'] || row['destinationAccountId'],
            accounts
          );
          const dueDate = normalizeText(row['Jatuh Tempo'] || row['dueDate']);
          const referenceTrxId = normalizeText(row['Referensi'] || row['referenceTrxId']);
          const notes = normalizeText(row['Catatan'] || row['notes']);

          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Tanggal harus YYYY-MM-DD');
          if (!type) errors.push('Tipe transaksi tidak dikenal');
          if (!unitId) errors.push('Unit Usaha tidak ditemukan');
          if (!paymentMethod) errors.push('Metode bayar tidak dikenal');

          const parsedTotal = Number.isFinite(totalAmount) ? totalAmount : 0;
          const parsedQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
          const parsedUnitPrice = Number.isFinite(unitPrice) && unitPrice > 0
            ? unitPrice
            : parsedQty > 0 && parsedTotal > 0
              ? parsedTotal / parsedQty
              : 0;

          if (parsedQty <= 0 && type !== 'TRANSFER' && type !== 'RECEIVABLE_PAYMENT' && type !== 'DEBT_PAYMENT') {
            errors.push('Qty harus lebih dari 0');
          }
          if (parsedTotal <= 0) errors.push('Nominal total harus > 0');

          if (type !== 'TRANSFER' && !itemName && type !== 'RECEIVABLE_PAYMENT' && type !== 'DEBT_PAYMENT') {
            errors.push('Uraian barang/jasa kosong');
          }
          if (type === 'SALE' || type === 'PURCHASE' || type === 'EXPENSE') {
            if (!itemCategory) errors.push('Kategori wajib diisi');
          }
          if (type === 'SALE' || type === 'PURCHASE') {
            if (!partyName) errors.push('Nama pelanggan/supplier kosong');
          }
          if (paymentMethod !== 'CREDIT' && !accountId) errors.push('Akun Kas/Bank tidak ditemukan');
          if (paymentMethod === 'CREDIT' && !dueDate) errors.push('Jatuh tempo wajib diisi untuk kredit');
          if (type === 'TRANSFER') {
            if (!accountId) errors.push('Akun asal transfer belum dipilih');
            if (!destinationAccountId) errors.push('Akun tujuan transfer belum dipilih');
            if (accountId && destinationAccountId && accountId === destinationAccountId) {
              errors.push('Akun asal dan tujuan tidak boleh sama');
            }
          }
          if ((type === 'RECEIVABLE_PAYMENT' || type === 'DEBT_PAYMENT') && !referenceTrxId) {
            errors.push('Referensi transaksi piutang/hutang wajib diisi');
          }

          const fallbackDate = date || new Date().toISOString().split('T')[0];
          const trxNumber =
            normalizeText(row['No Transaksi'] || row['trxNumber']) ||
            generateTrxNumber(type || 'EXPENSE', fallbackDate, transactionsCount + idx);

          const partyType: Transaction['partyType'] =
            type === 'PURCHASE' || type === 'DEBT_PAYMENT'
              ? 'SUPPLIER'
              : type === 'SALE' || type === 'RECEIVABLE_PAYMENT'
                ? 'PELANGGAN'
                : type === 'EXPENSE'
                  ? 'KARYAWAN'
                  : 'LAINNYA';

          return {
            trxNumber,
            date,
            type: type || 'EXPENSE',
            unitId,
            partyName: partyName || (type === 'TRANSFER' ? 'Internal Transfer' : 'Umum'),
            partyType,
            itemName: itemName || (type === 'TRANSFER' ? 'Transfer Antar Akun' : 'Transaksi'),
            itemCategory,
            qty: parsedQty || 1,
            unitPrice: parsedUnitPrice || parsedTotal,
            totalAmount: parsedTotal,
            paymentMethod: paymentMethod || 'CASH',
            accountId,
            destinationAccountId: destinationAccountId || undefined,
            dueDate: dueDate || undefined,
            referenceTrxId: referenceTrxId || undefined,
            notes: notes || undefined,
            isValid: errors.length === 0,
            errors,
          };
        });

        setParsedRows(validated);
      } catch (err) {
        console.error(err);
        alert('Gagal membaca berkas Excel/CSV. Pastikan format tabel sesuai template.');
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDownloadTemplate = () => {
    const headers = [[
      'No Transaksi', 'Tanggal', 'Tipe', 'Unit Usaha', 'Pihak / Mitra',
      'Barang / Uraian', 'Kategori', 'Qty', 'Harga Satuan', 'Total',
      'Metode Bayar', 'Akun', 'Akun Tujuan', 'Jatuh Tempo', 'Referensi', 'Catatan'
    ]];

    const instructions = [
      ['Petunjuk', 'Gunakan nama Unit Usaha dan nama Akun yang tampil di aplikasi. Jangan mengisi data contoh palsu.'],
      ['Tipe', 'SALE / PURCHASE / EXPENSE / INCOME / RECEIVABLE_PAYMENT / DEBT_PAYMENT / TRANSFER'],
      ['Metode Bayar', 'CASH / TRANSFER / CREDIT'],
      ['Kategori', 'Wajib untuk SALE, PURCHASE, dan EXPENSE'],
      ['Kredit', 'Wajib mengisi Jatuh Tempo'],
      ['Bayar Piutang/Hutang', 'Wajib mengisi Referensi berupa ID transaksi sumber'],
      ['Transfer', 'Wajib mengisi Akun dan Akun Tujuan, keduanya harus berbeda'],
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(headers), 'Template');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instructions), 'Petunjuk');
    XLSX.writeFile(wb, 'Template_Import_Transaksi_PT_GEMA_ABADI.xlsx');
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setImportResult('Tidak ada baris data yang valid untuk diimpor.');
      return;
    }
    if (!userEmail) {
      setImportResult('Pengguna belum terautentikasi.');
      return;
    }

    try {
      setIsProcessing(true);
      let count = 0;

      for (const row of validRows) {
        await createAtomicTransaction(
          {
            trxNumber: row.trxNumber,
            type: row.type,
            date: row.date,
            unitId: row.unitId,
            partyName: row.partyName,
            partyType: row.partyType,
            itemName: row.itemName,
            ...(row.itemCategory ? { itemCategory: row.itemCategory } : {}),
            qty: row.qty,
            unitPrice: row.unitPrice,
            totalAmount: row.totalAmount,
            paymentMethod: row.paymentMethod,
            accountId: row.accountId,
            ...(row.destinationAccountId ? { destinationAccountId: row.destinationAccountId } : {}),
            ...(row.dueDate ? { dueDate: row.dueDate } : {}),
            ...(row.referenceTrxId ? { referenceTrxId: row.referenceTrxId } : {}),
            ...(row.notes ? { notes: row.notes } : {}),
            status: 'ACTIVE',
            createdBy: userEmail,
            createdByName: 'Import Excel',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          userEmail
        );
        count += 1;
      }

      setImportResult(`Sukses mengimpor ${count} transaksi. Setiap baris melewati Financial Engine + Audit Trail.`);
      setParsedRows([]);
      setFile(null);
    } catch (err: any) {
      setImportResult(err?.message || 'Gagal mengimpor data');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-5 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">Import Transaksi Excel / CSV</h1>
          <p className="text-xs text-slate-400">
            Upload → Preview → Validasi → Simpan melalui Financial Engine
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-semibold transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh Template Excel</span>
        </button>
      </div>

      {importResult && (
        <div className="p-4 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{importResult}</span>
        </div>
      )}

      {units.length === 0 || accounts.length === 0 ? (
        <div className="p-4 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-300 text-xs">
          Master Unit Usaha dan Akun Kas/Bank belum siap. Isi konfigurasi terlebih dahulu sebelum import.
        </div>
      ) : null}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow text-center space-y-3">
        <FileSpreadsheet className="w-12 h-12 mx-auto text-amber-400" />
        <div>
          <h2 className="text-sm font-bold text-white">Pilih Berkas Excel (.xlsx) atau CSV</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Sistem tidak membuat Unit Usaha, Akun, atau transaksi contoh secara otomatis. Semua master harus cocok dengan data nyata.
          </p>
        </div>
        <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow transition">
          <Upload className="w-4 h-4" />
          <span>PILIH BERKAS IMPORT</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        {file && <p className="text-xs text-slate-300 font-mono">{file.name}</p>}
      </div>

      {parsedRows.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-sm font-bold text-white">Hasil Validasi Data Berkas</h2>
              <div className="flex items-center gap-3 text-xs mt-1">
                <span className="text-slate-300">Total: <b>{parsedRows.length}</b> baris</span>
                <span className="text-emerald-400 font-bold">✓ {validCount} Valid</span>
                {invalidCount > 0 && (
                  <span className="text-rose-400 font-bold">⚠ {invalidCount} Perlu Diperiksa</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={isProcessing || validCount === 0}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow transition disabled:opacity-50 flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengimpor...</span>
                </>
              ) : (
                <>
                  <FileCheck className="w-4 h-4" />
                  <span>IMPORT {validCount} BARIS VALID</span>
                </>
              )}
            </button>
          </div>

          {invalidCount > 0 && (
            <div className="flex items-center gap-2 text-rose-400 text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Baris bermasalah tidak akan disimpan.</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2">Status</th>
                  <th className="py-2">Tanggal</th>
                  <th className="py-2">Tipe</th>
                  <th className="py-2">Unit</th>
                  <th className="py-2">Pihak / Mitra</th>
                  <th className="py-2">Kategori</th>
                  <th className="py-2">Total</th>
                  <th className="py-2">Catatan Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {parsedRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className={row.isValid ? 'hover:bg-slate-800/30' : 'bg-rose-950/20'}>
                    <td className="py-2">
                      {row.isValid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400">VALID</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400">PERIKSA</span>
                      )}
                    </td>
                    <td className="py-2 text-slate-400">{row.date || '-'}</td>
                    <td className="py-2 font-bold text-white">{row.type}</td>
                    <td className="py-2 text-slate-300">{row.unitId || '-'}</td>
                    <td className="py-2 text-slate-200">{row.partyName || '-'}</td>
                    <td className="py-2 text-slate-300">{row.itemCategory || '-'}</td>
                    <td className="py-2 text-right font-bold text-white">
                      Rp{row.totalAmount.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 text-rose-400 text-[11px]">
                      {row.errors.join(', ') || 'OK'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
