import React, { useState } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  FileCode,
  RefreshCw,
  ShieldAlert
} from 'lucide-react';
import {
  generateFullBackupPayload,
  downloadJsonBackup,
  downloadExcelBackup,
  uploadBackupToDrive,
  restoreBackupData,
  FullBackupData
} from '../engines/backupEngine';

interface BackupRestoreViewProps {
  driveConnected: boolean;
  onConnectDrive: () => Promise<void>;
  userEmail: string;
}

export const BackupRestoreView: React.FC<BackupRestoreViewProps> = ({
  driveConnected,
  onConnectDrive,
  userEmail,
}) => {
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);

  // Restore State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restorePreview, setRestorePreview] = useState<FullBackupData | null>(null);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [restoreStatus, setRestoreStatus] = useState<string | null>(null);

  const handleBackupNow = async () => {
    try {
      setIsBackingUp(true);
      setBackupSuccessMessage(null);

      const payload = await generateFullBackupPayload();

      // Download JSON & Excel
      downloadJsonBackup(payload);
      downloadExcelBackup(payload);

      // If Google Drive connected, also auto-save into company's Google Drive folder
      let driveUploaded = false;
      if (driveConnected) {
        driveUploaded = await uploadBackupToDrive(payload);
      }

      setBackupSuccessMessage(
        `Backup berhasil dibuat! File JSON & Excel telah diunduh ke perangkat Anda.${
          driveUploaded ? ' Cadangan juga berhasil diunggah ke Google Drive perusahaan.' : ''
        }`
      );
    } catch (err: any) {
      alert(err.message || 'Gagal membuat backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleSelectRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRestoreFile(file);

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
            alert('File JSON ini tidak memiliki struktur backup yang valid!');
            setRestorePreview(null);
            return;
          }
          setRestorePreview(parsed);
        } catch (err) {
          alert('Format berkas bukan JSON yang valid.');
          setRestorePreview(null);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restorePreview) return;

    const confirmed = window.confirm(
      `PERINGATAN: Anda akan memulihkan ${restorePreview.transactions.length} transaksi ke sistem. Snapshot cadangan sistem saat ini akan otomatis diunduh sebelum proses restore. Lanjutkan?`
    );
    if (!confirmed) return;

    try {
      setIsRestoring(true);
      setRestoreStatus(null);
      const res = await restoreBackupData(restorePreview, userEmail);
      setRestoreStatus(res.message);
      setRestorePreview(null);
      setRestoreFile(null);
    } catch (err: any) {
      alert(err.message || 'Gagal memulihkan data');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-5 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow">
        <h1 className="text-lg font-black text-white">Cadangan & Pemulihan (Backup & Restore)</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Perlindungan data multi-lapis: Firestore + File Lokal (JSON & Excel) + Google Drive Perusahaan
        </p>
      </div>

      {backupSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-start gap-2.5">
          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{backupSuccessMessage}</span>
        </div>
      )}

      {/* Backup Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
        <div className="flex items-center gap-2">
          <Download className="w-5 h-5 text-amber-400" />
          <h2 className="text-sm font-bold text-white">1. Backup Database Sekarang</h2>
        </div>
        <p className="text-xs text-slate-400">
          Mengemas seluruh data transaksi keuangan, buku mitra, katalog barang/jasa, akun kas, dan log audit menjadi file arsip terstruktur.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <FileCode className="w-6 h-6 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Arsip JSON</div>
              <div className="text-[10px] text-slate-400">Data lengkap siap restore</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <div className="text-xs font-bold text-white">Buku Kerja Excel (.xlsx)</div>
              <div className="text-[10px] text-slate-400">Multi-sheet rapi untuk audit</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center gap-3">
            <HardDrive className={`w-6 h-6 shrink-0 ${driveConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
            <div>
              <div className="text-xs font-bold text-white">Google Drive</div>
              <div className="text-[10px] text-slate-400">
                {driveConnected ? 'Tersambung & Otomatis' : 'Belum Terhubung'}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBackupNow}
            disabled={isBackingUp}
            className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs tracking-wider uppercase transition shadow shadow-amber-500/20 flex items-center gap-2"
          >
            {isBackingUp ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Membuat Cadangan...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>BACKUP SEKARANG (JSON + EXCEL)</span>
              </>
            )}
          </button>

          {!driveConnected && (
            <button
              type="button"
              onClick={onConnectDrive}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold transition"
            >
              Hubungkan Akun Google Drive
            </button>
          )}
        </div>
      </div>

      {/* Restore Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-rose-400" />
          <h2 className="text-sm font-bold text-white">2. Pemulihan Database (Restore)</h2>
        </div>
        <p className="text-xs text-slate-400">
          Pulihkan database dari file cadangan JSON yang telah diexport sebelumnya. Sistem akan memvalidasi data dan membuat snapshot pengaman otomatis terlebih dahulu.
        </p>

        {restoreStatus && (
          <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{restoreStatus}</span>
          </div>
        )}

        <div className="space-y-3">
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white transition">
            <Upload className="w-4 h-4 text-amber-400" />
            <span>Pilih File Backup JSON</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleSelectRestoreFile}
              className="hidden"
            />
          </label>
          {restoreFile && (
            <span className="text-xs text-slate-300 ml-3 font-mono">{restoreFile.name}</span>
          )}
        </div>

        {/* Restore Preview & Validation Box */}
        {restorePreview && (
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>Hasil Validasi File Cadangan:</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Transaksi</span>
                <p className="text-base font-bold text-white">{restorePreview.transactions.length}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Mitra / Toko</span>
                <p className="text-base font-bold text-white">{restorePreview.partners?.length || 0}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Barang & Jasa</span>
                <p className="text-base font-bold text-white">{restorePreview.products?.length || 0}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-400 text-[10px]">Tanggal Backup</span>
                <p className="text-xs font-semibold text-slate-200 mt-1 truncate">
                  {restorePreview.timestamp.split('T')[0]}
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRestorePreview(null);
                  setRestoreFile(null);
                }}
                className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow flex items-center gap-1.5"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Memulihkan Data...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>KONFIRMASI & RESTORE SEKARANG</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
