export type EntityType = 'PERUSAHAAN' | 'PERORANGAN' | 'ORGANISASI';

export type RelationType =
  | 'PELANGGAN'
  | 'SUPPLIER'
  | 'KONTRAKTOR'
  | 'MITRA'
  | 'KARYAWAN'
  | 'LAINNYA';

export interface Partner {
  id: string;
  entityType: EntityType;
  name: string;
  picName?: string;
  picTitle?: string;
  npwp?: string;
  phone: string;
  email?: string;
  address?: string;
  relations: RelationType[];

  // Backward compatibility for historical partner documents.
  type?: 'PELANGGAN' | 'SUPPLIER' | 'TOKO_MATERIAL' | 'KONTRAKTOR' | 'BENGKEL' | 'KARYAWAN' | 'MITRA' | 'LAINNYA';
  status: 'AKTIF' | 'NONAKTIF';
  notes?: string;
  createdAt: string;
}
