import { getAccessToken } from '../firebase';
import { DocumentItem } from '../types';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { cleanFirestoreData } from '../utils/cleanData';

export type DocumentCategory =
  | 'NOTA_KWITANSI'
  | 'INVOICE'
  | 'SLIP_TRANSFER'
  | 'KONTRAK'
  | 'PROYEK'
  | 'LAINNYA';

/**
 * Convert number to Indonesian words (Terbilang)
 * e.g. 5000000 -> "Lima Juta Rupiah"
 */
export function formatTerbilang(nominal: number): string {
  if (nominal === 0) return 'Nol Rupiah';

  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

  function toWords(n: number): string {
    if (n < 12) {
      return satuan[n];
    } else if (n < 20) {
      return toWords(n - 10) + ' Belas';
    } else if (n < 100) {
      return toWords(Math.floor(n / 10)) + ' Puluh' + (n % 10 !== 0 ? ' ' + toWords(n % 10) : '');
    } else if (n < 200) {
      return 'Seratus' + (n - 100 !== 0 ? ' ' + toWords(n - 100) : '');
    } else if (n < 1000) {
      return toWords(Math.floor(n / 100)) + ' Ratus' + (n % 100 !== 0 ? ' ' + toWords(n % 100) : '');
    } else if (n < 2000) {
      return 'Seribu' + (n - 1000 !== 0 ? ' ' + toWords(n - 1000) : '');
    } else if (n < 1000000) {
      return toWords(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 !== 0 ? ' ' + toWords(n % 1000) : '');
    } else if (n < 1000000000) {
      return toWords(Math.floor(n / 1000000)) + ' Juta' + (n % 1000000 !== 0 ? ' ' + toWords(n % 1000000) : '');
    } else if (n < 1000000000000) {
      return toWords(Math.floor(n / 1000000000)) + ' Miliar' + (n % 1000000000 !== 0 ? ' ' + toWords(n % 1000000000) : '');
    } else {
      return toWords(Math.floor(n / 1000000000000)) + ' Triliun' + (n % 1000000000000 !== 0 ? ' ' + toWords(n % 1000000000000) : '');
    }
  }

  const cleanNum = Math.floor(Math.abs(nominal));
  return `${toWords(cleanNum)} Rupiah`;
}

/**
 * Find or create a specific folder in Google Drive
 */
export async function getOrCreateDriveFolder(folderName: string, accessToken: string): Promise<string | null> {
  try {
    const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();

    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }
    return null;
  } catch (error) {
    console.error('Error in getOrCreateDriveFolder:', error);
    return null;
  }
}

/**
 * Upload a file directly to Google Drive via multipart upload
 */
export async function uploadFileToGoogleDrive(
  file: File,
  folderName: string = 'PT Gema Abadi Nugraha - Bukti Transaksi'
): Promise<{ fileId: string; webViewLink?: string; webContentLink?: string } | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const folderId = await getOrCreateDriveFolder(folderName, token);

    const metadata: any = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
    };
    if (folderId) {
      metadata.parents = [folderId];
    }

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Google Drive Upload Failed: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      fileId: data.id,
      webViewLink: data.webViewLink,
      webContentLink: data.webContentLink,
    };
  } catch (error) {
    console.error('Drive upload failed:', error);
    return null;
  }
}

/**
 * List files from Google Drive folder
 */
export async function listGoogleDriveFiles(folderName: string = 'PT Gema Abadi Nugraha - Bukti Transaksi'): Promise<any[]> {
  const token = await getAccessToken();
  if (!token) return [];

  try {
    const folderId = await getOrCreateDriveFolder(folderName, token);
    if (!folderId) return [];

    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,webViewLink,createdTime)&orderBy=createdTime desc`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error('Failed to list drive files:', error);
    return [];
  }
}

/**
 * Delete a file from Google Drive with mandatory user confirmation
 */
export async function deleteFileFromDrive(fileId: string, filename: string): Promise<boolean> {
  const confirmed = window.confirm(
    `Apakah Anda yakin ingin menghapus berkas "${filename}" dari Google Drive perusahaan? Tindakan ini tidak dapat dibatalkan.`
  );
  if (!confirmed) return false;

  const token = await getAccessToken();
  if (!token) return false;

  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch (error) {
    console.error('Failed to delete file from drive:', error);
    return false;
  }
}

/**
 * Save Document metadata into Firestore
 */
export async function saveDocumentRecord(
  docData: Omit<DocumentItem, 'id'>
): Promise<string> {
  const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const dataUrlLength = docData.dataUrl ? docData.dataUrl.length : 0;
  // Firestore documents have a size limit. Keep local previews small; Drive is the
  // durable location for larger attachments.
  if (dataUrlLength > 700_000) {
    throw new Error('Lampiran terlalu besar untuk penyimpanan lokal. Hubungkan Google Drive atau gunakan file yang lebih kecil.');
  }

  const fullDoc: DocumentItem = {
    ...docData,
    id,
  };
  await setDoc(doc(db, 'documents', id), cleanFirestoreData(fullDoc));
  return id;
}

/**
 * Delete Document from Firestore and Drive
 */
export async function deleteDocumentRecord(docItem: DocumentItem): Promise<boolean> {
  if (docItem.driveFileId) {
    await deleteFileFromDrive(docItem.driveFileId, docItem.name);
  }
  await deleteDoc(doc(db, 'documents', docItem.id));
  return true;
}

/**
 * Trigger Native Web Share or Download Fallback
 */
export async function shareDocumentOrText(title: string, text: string, url?: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text,
        url: url || window.location.href,
      });
      return true;
    } catch (e) {
      console.log('Share dismissed or failed:', e);
    }
  }

  // Fallback: Copy to clipboard
  try {
    await navigator.clipboard.writeText(`${title}\n${text}\n${url || ''}`);
    return true;
  } catch (e) {
    return false;
  }
}
