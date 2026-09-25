import { Transaction, CompanyProfile } from '../types';
import { formatRupiah } from '../engines/reportEngine';
import { formatTerbilang } from '../engines/documentEngine';

/**
 * Format phone number to international WhatsApp format (e.g., 081234 -> 6281234)
 */
export function formatWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62') && cleaned.length > 5) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Create a WhatsApp Click to Chat URL (wa.me)
 */
export function createWhatsAppUrl(phone: string, text: string): string {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(text);
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Generate formatted WhatsApp message for Official Receipt (Kwitansi)
 */
export function generateReceiptWAMessage(
  trx: Transaction,
  company: CompanyProfile,
  receiptNo: string
): string {
  const terbilang = formatTerbilang(trx.totalAmount);
  return `*${company.name.toUpperCase()}*
*BUKTI PEMBAYARAN RESMI (KWITANSI)*
━━━━━━━━━━━━━━━━━━━━
No. Kwitansi : ${receiptNo}
Tanggal      : ${trx.date}
Diterima Dari: ${trx.partyName || 'Pelanggan'}

*Jumlah Pembayaran:*
${formatRupiah(trx.totalAmount)}
_# ${terbilang} #_

*Untuk Keperluan:*
${trx.itemName}${trx.notes ? ` (${trx.notes})` : ''}

Metode Bayar : ${trx.paymentMethod === 'CASH' ? 'Kas Tunai' : trx.paymentMethod === 'TRANSFER' ? 'Transfer Bank' : 'Bon / Kredit'}
Petugas      : ${trx.createdByName || 'Kasir Keuangan'}
━━━━━━━━━━━━━━━━━━━━
${company.receiptFooter || 'Terima kasih atas pembayaran dan kerja sama Anda.'}`;
}

/**
 * Generate formatted WhatsApp message for Sales Invoice (Faktur Penjualan)
 */
export function generateInvoiceWAMessage(
  trx: Transaction,
  company: CompanyProfile,
  invoiceNo: string
): string {
  const terbilang = formatTerbilang(trx.totalAmount);
  return `*${company.name.toUpperCase()}*
*FAKTUR PENJUALAN / INVOICE*
━━━━━━━━━━━━━━━━━━━━
No. Faktur  : ${invoiceNo}
Tanggal     : ${trx.date}
Kepada Yth. : ${trx.partyName}

*Rincian Barang / Jasa:*
• ${trx.itemName}
  Qty: ${trx.qty} | Harga: ${formatRupiah(trx.unitPrice)}
  *Total: ${formatRupiah(trx.totalAmount)}*
  _(${terbilang})_

Status Pembayaran: ${trx.paymentMethod === 'CREDIT' ? `BON / KREDIT (Jatuh Tempo: ${trx.dueDate || 'Sesuai Kesepakatan'})` : 'LUNAS (TUNAI / TRANSFER)'}

*Rekening Resmi Perusahaan:*
• Bank BCA: 8830192831 a.n PT Gema Abadi Nugraha
• Bank Mandiri: 137001928374 a.n PT Gema Abadi Nugraha
━━━━━━━━━━━━━━━━━━━━
Mohon kirimkan bukti transfer jika pembayaran dilakukan via bank. Terima kasih.`;
}

/**
 * Generate formatted WhatsApp message for Billing Reminder (Tagihan Piutang)
 */
export function generateBillingReminderWAMessage(
  partyName: string,
  trxNumber: string,
  itemName: string,
  totalAmount: number,
  paidAmount: number,
  remainingAmount: number,
  dueDate: string | undefined,
  company: CompanyProfile
): string {
  return `*${company.name.toUpperCase()}*
*PEMBERITAHUAN TAGIHAN PIUTANG*
━━━━━━━━━━━━━━━━━━━━
Yth. Bapak/Ibu/Pimpinan *${partyName}*,

Berikut adalah informasi tagihan yang tercatat pada sistem kami:
• No. Transaksi : ${trxNumber}
• Uraian Barang : ${itemName}
• Total Tagihan : ${formatRupiah(totalAmount)}
• Sudah Dibayar : ${formatRupiah(paidAmount)}
• *Sisa Tagihan : ${formatRupiah(remainingAmount)}*
• Jatuh Tempo   : ${dueDate || 'Segera'}

*Rekening Pembayaran:*
• Bank BCA: 8830192831 a.n PT Gema Abadi Nugraha
• Bank Mandiri: 137001928374 a.n PT Gema Abadi Nugraha

Mohon untuk melakukan konfirmasi apabila pembayaran telah dilakukan. Terima kasih atas kerja sama dan kepercayaannya.
━━━━━━━━━━━━━━━━━━━━
_Divisi Keuangan ${company.name}_`;
}
