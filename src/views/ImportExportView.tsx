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
import { writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '../utils/cleanData';
import { Transaction } from '../types';

interface ImportItem {
  id?: string;
  trxNumber: string;
  date: string;
  type: string;
  unitId: string;
  partyName: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: string;
  accountId: string;
  status: string;
  isValid: boolean;
  errors: string[];
}

interface ImportExportViewProps {
  userEmail: string;
  transactionsCount: number;
}

export const ImportExportView: React.FC<ImportExportViewProps> = ({
  userEmail,
  transactionsCount,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ImportItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setImportResult(null);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const rawJson = XLSX.utils.sheet_to_json<any>(workbook.Sheets[sheetName]);

          // Validate rows
          const validated: ImportItem[] = rawJson.map((row: any, idx: number) => {
            const errors: string[] = [];
            const date = row['Tanggal'] || row['date'] || new Date().toISOString().split('T')[0];
            const type = (row['Tipe'] || row['type'] || 'SALE').toUpperCase();
            const partyName = row['Pihak / Mitra'] || row['Pelanggan'] || row['partyName'] || row['Nama Pihak'] || '';
            const itemName = row['Barang / Uraian'] || row['Barang'] || row['itemName'] || '';
            const qty = Number(row['Qty'] || row['qty'] || 1);
            const totalAmount = Number(row['Total'] || row['totalAmount'] || row['Nominal'] || 0);
            const unitPrice = Number(row['Harga Satuan'] || row['unitPrice'] || (qty > 0 ? totalAmount / qty : totalAmount));
            const paymentMethod = (row['Metode Bayar'] || row['paymentMethod'] || 'CASH').toUpperCase();
            const unitId = row['Unit Usaha'] || row['unitId'] || 'bengkel';

            if (!itemName) errors.push('Uraian barang/jasa kosong');
            if (totalAmount <= 0) errors.push('Nominal total harus > 0');
            if (!partyName) errors.push('Nama pihak kosong');

            return {
              trxNumber: row['No Transaksi'] || `IMP-${date.replace(/-/g, '')}-${String(idx + 1).padStart(4, '0')}`,
              date,
              type,
              unitId,
              partyName,
              itemName,
              qty: isNaN(qty) ? 1 : qty,
              unitPrice: isNaN(unitPrice) ? totalAmount : unitPrice,
              totalAmount: isNaN(totalAmount) ? 0 : totalAmount,
              paymentMethod: paymentMethod.includes('BON') || paymentMethod.includes('CREDIT') ? 'CREDIT' : paymentMethod.includes('TRANSFER') ? 'TRANSFER' : 'CASH',
              accountId: 'kas_utama',
              status: 'ACTIVE',
              isValid: errors.length === 0,
              errors,
            };
          });

          setParsedRows(validated);
        } catch (err) {
          alert('Gagal membaca berkas Excel/CSV. Pastikan format tabel sesuai.');
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        Tanggal: '2026-09-25',
        Tipe: 'SALE',
        'Unit Usaha': 'bengkel',
        'Pihak / Mitra': 'Bapak Hendra',
        'Barang / Uraian': 'Ganti Oli & Filter Mesin',
        Qty: 1,
        'Harga Satuan': 250000,
        Total: 250000,
        'Metode Bayar': 'CASH',
      },
      {
        Tanggal: '2026-09-25',
        Tipe: 'PURCHASE',
        'Unit Usaha': 'toko_material',
        'Pihak / Mitra': 'PT Semen Indonesia',
        'Barang / Uraian': 'Semen Gresik 50 Sak',
        Qty: 50,
        'Harga Satuan': 65000,
        Total: 3250000,
        'Metode Bayar': 'CREDIT',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Template_Import_Transaksi_PT_GEMA_ABADI.xlsx');
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setImportResult('Tidak ada baris data yang valid untuk diimpor.');
      return;
    }

    try {
      setIsProcessing(true);
      let batch = writeBatch(db);
      let count = 0;

      for (const row of validRows) {
        const trxRef = doc(collection(db, 'transactions'));
        const newTrx: Transaction = {
          id: trxRef.id,
          trxNumber: row.trxNumber,
          type: row.type as any,
          date: row.date,
          unitId: row.unitId,
          partyName: row.partyName,
          itemName: row.itemName,
          qty: row.qty,
          unitPrice: row.unitPrice,
          totalAmount: row.totalAmount,
          paymentMethod: row.paymentMethod as any,
          accountId: row.accountId,
          status: 'ACTIVE',
          createdBy: userEmail || 'import_tool',
          createdByName: 'Import Excel Tool',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        batch.set(trxRef, cleanFirestoreData(newTrx));
        count++;

        if (count >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      setImportResult(`Sukses mengimpor ${validRows.length} transaksi ke sistem.`);
      setParsedRows([]);
      setFile(null);
    } catch (err: any) {
      setImportResult(err.message || 'Gagal mengimpor data');
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="space-y-5 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">Import Transaksi Excel / CSV</h1>
          <p className="text-xs text-slate-400">
            Alur aman: Upload → Preview Data → Validasi Baris → Import Terverifikasi
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

      {/* Upload Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow text-center space-y-3">
        <FileSpreadsheet className="w-12 h-12 mx-auto text-amber-400" />
        <div>
          <h2 className="text-sm font-bold text-white">Pilih Berkas Excel (.xlsx) atau CSV</h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
            Data akan diverifikasi sebelum masuk ke database, memastikan tidak ada baris rusak yang tersimpan.
          </p>
        </div>

        <div>
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
        </div>
        {file && <p className="text-xs text-slate-300 font-mono">{file.name}</p>}
      </div>

      {/* Validation Summary & Preview Table */}
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

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2">Status</th>
                  <th className="py-2">Tanggal</th>
                  <th className="py-2">Tipe</th>
                  <th className="py-2">Pihak / Mitra</th>
                  <th className="py-2">Barang / Uraian</th>
                  <th className="py-2 text-right">Total</th>
                  <th className="py-2">Catatan Validasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {parsedRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className={row.isValid ? 'hover:bg-slate-800/30' : 'bg-rose-950/20'}>
                    <td className="py-2">
                      {row.isValid ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400">
                          VALID
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400">
                          PERIKSA
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-slate-400">{row.date}</td>
                    <td className="py-2 font-bold text-white">{row.type}</td>
                    <td className="py-2 text-slate-200">{row.partyName || '-'}</td>
                    <td className="py-2 text-slate-300 max-w-xs truncate">{row.itemName || '-'}</td>
                    <td className="py-2 text-right font-bold text-white">
                      Rp{row.totalAmount.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 text-rose-400 text-[11px]">
                      {row.errors.join(', ')}
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
