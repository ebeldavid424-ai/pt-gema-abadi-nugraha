import React, { useState } from 'react';
import {
  X,
  Camera,
  Upload,
  Check,
  AlertCircle,
  HardDrive,
  FileText
} from 'lucide-react';
import { uploadFileToGoogleDrive, saveDocumentRecord } from '../engines/documentEngine';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  driveConnected: boolean;
  userEmail: string;
  onSuccess: () => void;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  driveConnected,
  userEmail,
  onSuccess,
}) => {
  if (!isOpen) return null;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Pilih foto nota atau dokumen terlebih dahulu.');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage(null);

      let driveRes = null;
      if (driveConnected) {
        driveRes = await uploadFileToGoogleDrive(selectedFile);
      }

      await saveDocumentRecord({
        name: selectedFile.name,
        mimeType: selectedFile.type,
        size: selectedFile.size,
        storageType: driveRes?.fileId ? 'DRIVE' : 'LOCAL',
        driveFileId: driveRes?.fileId,
        webViewLink: driveRes?.webViewLink,
        dataUrl: filePreview || undefined,
        notes: notes.trim() || 'Dokumen transaksi / nota',
        uploadedBy: userEmail || 'user',
        uploadedAt: new Date().toISOString(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Gagal mengupload dokumen.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Upload Nota & Dokumen</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs text-slate-300 flex items-center gap-2.5">
            <HardDrive className={`w-4 h-4 shrink-0 ${driveConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
            <span>
              {driveConnected
                ? 'Google Drive aktif. File akan otomatis disimpan ke folder Google Drive perusahaan.'
                : 'Google Drive belum terhubung. File akan disimpan secara lokal.'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Ambil Foto / Pilih Berkas
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="cursor-pointer flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-dashed border-slate-700 hover:border-amber-400 transition text-center">
                <Camera className="w-6 h-6 text-amber-400 mb-1" />
                <span className="text-xs font-bold text-white">Kamera HP</span>
                <span className="text-[10px] text-slate-400">Foto langsung nota</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              <label className="cursor-pointer flex flex-col items-center justify-center p-4 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-dashed border-slate-700 hover:border-amber-400 transition text-center">
                <Upload className="w-6 h-6 text-amber-400 mb-1" />
                <span className="text-xs font-bold text-white">Pilih Berkas</span>
                <span className="text-[10px] text-slate-400">PDF atau Gambar</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {selectedFile && (
            <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 flex items-center gap-3">
              <FileText className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="overflow-hidden flex-1">
                <div className="text-xs font-semibold text-white truncate">{selectedFile.name}</div>
                <div className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
          )}

          {filePreview && (
            <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
              <img src={filePreview} alt="Preview" className="w-full h-full object-contain" />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Catatan / Keterangan Dokumen
            </label>
            <input
              type="text"
              placeholder="Contoh: Nota Semen Toko A, Slip Transfer Mandiri..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs focus:border-amber-400 focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={isUploading || !selectedFile}
            className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wide shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Mengunggah...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Simpan Dokumen</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
