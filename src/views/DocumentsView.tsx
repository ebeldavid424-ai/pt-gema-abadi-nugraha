import React, { useState, useEffect } from 'react';
import {
  FileText,
  Camera,
  Download,
  Share2,
  HardDrive,
  Eye,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle,
  MessageCircle,
  FolderOpen,
  RefreshCw
} from 'lucide-react';
import { DocumentItem } from '../types';
import {
  shareDocumentOrText,
  listGoogleDriveFiles,
  deleteDocumentRecord,
  deleteFileFromDrive
} from '../engines/documentEngine';
import { DocumentUploadModal } from '../components/DocumentUploadModal';
import { createWhatsAppUrl } from '../utils/whatsapp';

interface DocumentsViewProps {
  documents: DocumentItem[];
  driveConnected: boolean;
  onConnectDrive: () => Promise<void>;
  userEmail: string;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  documents,
  driveConnected,
  onConnectDrive,
  userEmail,
}) => {
  const [activeTab, setActiveTab] = useState<'LOCAL' | 'DRIVE'>('LOCAL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);

  // Live Drive files
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState<boolean>(false);

  useEffect(() => {
    if (driveConnected && activeTab === 'DRIVE') {
      loadDriveFiles();
    }
  }, [driveConnected, activeTab]);

  const loadDriveFiles = async () => {
    setIsLoadingDrive(true);
    try {
      const files = await listGoogleDriveFiles();
      setDriveFiles(files);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingDrive(false);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.notes && d.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const handleShare = async (doc: DocumentItem) => {
    await shareDocumentOrText(
      doc.name,
      `Dokumen PT. Gema Abadi Nugraha: ${doc.name}\n${doc.notes || ''}`,
      doc.webViewLink || doc.dataUrl
    );
  };

  const handleShareWhatsApp = (doc: DocumentItem) => {
    const text = `*PT. GEMA ABADI NUGRAHA*\nDokumen: ${doc.name}\n${doc.notes ? `Catatan: ${doc.notes}\n` : ''}${doc.webViewLink ? `Link Drive: ${doc.webViewLink}` : ''}`;
    const url = createWhatsAppUrl('', text);
    window.open(url, '_blank');
  };

  const handleDownload = (doc: DocumentItem) => {
    if (doc.webViewLink) {
      window.open(doc.webViewLink, '_blank');
      return;
    }

    if (doc.dataUrl) {
      const a = document.createElement('a');
      a.href = doc.dataUrl;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDeleteDoc = async (doc: DocumentItem) => {
    const confirmed = window.confirm(`Hapus berkas "${doc.name}"?`);
    if (!confirmed) return;

    try {
      await deleteDocumentRecord(doc);
    } catch (e: any) {
      alert(e.message || 'Gagal menghapus dokumen');
    }
  };

  const handleDeleteDriveDirect = async (file: any) => {
    const success = await deleteFileFromDrive(file.id, file.name);
    if (success) {
      setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-7xl mx-auto px-3 sm:px-4 pt-3">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-white">Dokumen, Nota, Slip & Kontrak</h1>
          <p className="text-xs text-slate-400">
            Penyimpanan terintegrasi foto nota, faktur, slip transfer bank, dan berkas proyek ke Google Drive
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!driveConnected ? (
            <button
              type="button"
              onClick={onConnectDrive}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-semibold transition"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Hubungkan Drive</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-400 text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Drive Terhubung</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
          >
            <Camera className="w-4 h-4 stroke-[2.5]" />
            <span>+ Upload Dokumen</span>
          </button>
        </div>
      </div>

      {/* Tabs: Berkas Terdata vs Google Drive Langsung */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('LOCAL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'LOCAL'
              ? 'bg-amber-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white bg-slate-800'
          }`}
        >
          Semua Dokumen Transaksi ({documents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('DRIVE')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
            activeTab === 'DRIVE'
              ? 'bg-emerald-500 text-slate-950 shadow'
              : 'text-slate-400 hover:text-white bg-slate-800'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Folder Google Drive Perusahaan</span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Cari nama dokumen, nota, atau keterangan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-hidden"
        />
      </div>

      {/* TAB 1: Dokumen Terkait Transaksi */}
      {activeTab === 'LOCAL' && (
        <>
          {filteredDocs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-xs font-semibold text-slate-400">Belum ada dokumen atau nota tersimpan</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Tekan "+ Upload Dokumen" untuk memotret bukti nota atau mengunggah slip pembayaran.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                        <FileText className="w-3 h-3 text-amber-400" />
                        <span>{doc.storageType}</span>
                      </span>
                      <span className="text-[10px] text-slate-500">{doc.uploadedAt.split('T')[0]}</span>
                    </div>

                    <h3 className="text-sm font-bold text-white truncate" title={doc.name}>
                      {doc.name}
                    </h3>
                    {doc.notes && (
                      <p className="text-xs text-slate-400 line-clamp-2">{doc.notes}</p>
                    )}

                    {/* Preview Thumbnail if image */}
                    {doc.dataUrl && (
                      <div
                        onClick={() => setViewingDoc(doc)}
                        className="cursor-pointer relative h-28 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 group"
                      >
                        <img src={doc.dataUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-white text-xs font-bold gap-1">
                          <Eye className="w-4 h-4" />
                          <span>Lihat Nota</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setViewingDoc(doc)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleShareWhatsApp(doc)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 text-emerald-400"
                        title="Kirim via WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShare(doc)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Bagikan"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-rose-400"
                        title="Hapus Dokumen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: Live Google Drive Folder */}
      {activeTab === 'DRIVE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <span>Berkas di Google Drive: /PT Gema Abadi Nugraha - Bukti Transaksi</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Sinkronisasi langsung dengan penyimpanan cloud Drive perusahaan
              </p>
            </div>
            <button
              type="button"
              onClick={loadDriveFiles}
              disabled={isLoadingDrive}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Refresh daftar file Drive"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {!driveConnected ? (
            <div className="py-8 text-center text-slate-400 space-y-3">
              <p className="text-xs">Hubungkan akun Google Drive untuk melihat dan mengelola berkas Drive secara langsung.</p>
              <button
                type="button"
                onClick={onConnectDrive}
                className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow"
              >
                Hubungkan Google Drive
              </button>
            </div>
          ) : isLoadingDrive ? (
            <div className="py-8 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
              <p className="text-xs">Memuat berkas dari Google Drive API...</p>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="py-8 text-center text-slate-500">
              <p className="text-xs">Belum ada file di folder Google Drive ini.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {driveFiles.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-white truncate">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[11px] font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Buka di Drive</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteDriveDirect(f)}
                      className="p-1 rounded bg-slate-800 hover:bg-rose-950 text-rose-400"
                      title="Hapus Berkas dari Drive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        driveConnected={driveConnected}
        userEmail={userEmail}
        onSuccess={() => {
          setIsUploadModalOpen(false);
          if (driveConnected) loadDriveFiles();
        }}
      />

      {/* View Modal */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2 className="text-sm font-bold text-white truncate">{viewingDoc.name}</h2>
              <button
                type="button"
                onClick={() => setViewingDoc(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {viewingDoc.dataUrl ? (
              <div className="max-h-[60vh] overflow-y-auto rounded-xl bg-slate-950 p-1 border border-slate-800">
                <img src={viewingDoc.dataUrl} alt="" className="w-full h-auto object-contain rounded-lg" />
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">
                <FileText className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                <p className="text-xs">File tersimpan di Google Drive</p>
                {viewingDoc.webViewLink && (
                  <a
                    href={viewingDoc.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    Buka Dokumen di Google Drive
                  </a>
                )}
              </div>
            )}
            <div className="text-xs text-slate-400">
              {viewingDoc.notes}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
