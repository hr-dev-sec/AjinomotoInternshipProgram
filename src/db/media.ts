import { desc, eq } from 'drizzle-orm';
import { db } from './index.js';
import { mediaAssets, mediaEditHistory } from './schema.js';

export interface MediaAssetItem {
  assetKey: string;
  label: string;
  placement: string;
  currentUrl: string;
  altText: string;
  objectPosition: string;
  mimeType: string;
  sourceType: string;
}

export const DEFAULT_MEDIA_ASSETS: MediaAssetItem[] = [
  {
    assetKey: 'landing_hero',
    label: 'Hero Banner Gedung Pabrik PT Ajinomoto Indonesia',
    placement: 'Landing Page Hero Section',
    currentUrl: '/assets/aistudio/grup_ajinomoto_indonesia-dmQw_large_0e1fe3a6.jpeg',
    altText: 'Gedung Pabrik PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory',
    objectPosition: 'center',
    mimeType: 'image/jpeg',
    sourceType: 'user_upload',
  },
  {
    assetKey: 'portal_mbkm_card',
    label: 'Kartu Jalur Program MBKM (Karyawan Lab R&D Ajinomoto)',
    placement: 'Portal Utama – Kartu Program MBKM',
    currentUrl: '/assets/images/ajinomoto_mbkm_lab_real.png',
    altText: 'Karyawan R&D dan Quality Control PT Ajinomoto Indonesia bekerja di laboratorium',
    objectPosition: 'center 20%',
    mimeType: 'image/png',
    sourceType: 'official_ajinomoto',
  },
  {
    assetKey: 'portal_pkl_card',
    label: 'Kartu Jalur PKL Mandiri (Operator Produksi Pabrik Mojokerto)',
    placement: 'Portal Utama – Kartu PKL Mandiri',
    currentUrl: '/assets/images/ajinomoto_pkl_production_real.webp',
    altText: 'Karyawan produksi Pabrik PT Ajinomoto Indonesia Mojokerto di lini pengemasan',
    objectPosition: 'center 25%',
    mimeType: 'image/webp',
    sourceType: 'official_documentation',
  },
  {
    assetKey: 'info_poster_pendaftaran',
    label: 'Poster / Brosur Informasi Pendaftaran Magang MBKM & PKL',
    placement: 'Landing Page – Seksi Pengumuman & Brosur Pendaftaran',
    currentUrl: '',
    altText: 'Informasi Resmi Pendaftaran Program Magang MBKM & PKL PT Ajinomoto Indonesia Mojokerto Factory',
    objectPosition: 'center',
    mimeType: 'image/png',
    sourceType: 'optional_empty',
  },
  {
    assetKey: 'form_mbkm_banner',
    label: 'Banner / Panduan Visual Pendaftaran Program MBKM',
    placement: 'Halaman Formulir Pendaftaran MBKM',
    currentUrl: '',
    altText: 'Panduan & Persyaratan Pendaftaran Program MBKM PT Ajinomoto Indonesia',
    objectPosition: 'center',
    mimeType: 'image/png',
    sourceType: 'optional_empty',
  },
  {
    assetKey: 'form_pkl_banner',
    label: 'Banner / Panduan Visual Pendaftaran PKL Mandiri',
    placement: 'Halaman Formulir Pendaftaran PKL Mandiri',
    currentUrl: '',
    altText: 'Panduan & Persyaratan Pendaftaran PKL Mandiri PT Ajinomoto Indonesia',
    objectPosition: 'center',
    mimeType: 'image/png',
    sourceType: 'optional_empty',
  },
  {
    assetKey: 'login_showcase_bg',
    label: 'Latar Halaman Login Admin & Pimpinan',
    placement: 'Admin Login Showcase Panel',
    currentUrl: '/assets/images/hero_ajinomoto_factory_1794535892664.jpg',
    altText: 'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory',
    objectPosition: 'center',
    mimeType: 'image/jpeg',
    sourceType: 'system_asset',
  },
  {
    assetKey: 'brand_logo_ajinomoto',
    label: 'Logo Resmi PT Ajinomoto Indonesia',
    placement: 'Header Global, Login, Portal & Dashboard',
    currentUrl: '/assets/aistudio/Logo_Ajinomoto_641a64fc.png',
    altText: 'Logo Ajinomoto Indonesia',
    objectPosition: 'center',
    mimeType: 'image/png',
    sourceType: 'user_upload',
  },
  {
    assetKey: 'brand_logo_ajiu',
    label: 'Logo Crisp AJIU (Ajinomoto Indonesia University)',
    placement: 'Header Global, Kartu MBKM, Login & Sidebar',
    currentUrl: '/assets/aistudio/logo_ajiu_crisp.png',
    altText: 'Logo AJIU Ajinomoto Indonesia University',
    objectPosition: 'center',
    mimeType: 'image/png',
    sourceType: 'processed_hd',
  },
  {
    assetKey: 'brand_logo_safety',
    label: 'Logo Safety First PT Ajinomoto Indonesia',
    placement: 'Hero Strip, Portal Index, Login & Footer',
    currentUrl: '/assets/aistudio/HSE_8e0164a8.png',
    altText: 'Logo Safety First',
    objectPosition: 'center',
    mimeType: 'image/png',
    sourceType: 'user_upload',
  },
  {
    assetKey: 'admin_default_avatar',
    label: 'Avatar Default HR Development Admin',
    placement: 'Sidebar Dashboard & Profil Admin',
    currentUrl: '/assets/images/avatar_hr_admin_1794535891951.jpg',
    altText: 'Avatar Default HR Admin',
    objectPosition: 'center',
    mimeType: 'image/jpeg',
    sourceType: 'system_asset',
  },
];

export const OPTIONAL_MEDIA_KEYS = new Set([
  'info_poster_pendaftaran',
  'form_mbkm_banner',
  'form_pkl_banner',
]);

const INITIAL_MEDIA_CHANGELOG: Record<
  string,
  { previousUrl: string | null; changeNote: string }
> = {
  landing_hero: {
    previousUrl: '/assets/images/hero_ajinomoto_factory_1794535892664.jpg',
    changeNote: 'Penggantian foto hero landing page ke foto asli gedung pabrik Grup Ajinomoto Indonesia',
  },
  portal_mbkm_card: {
    previousUrl: '/assets/images/portal_mbkm_lab_1794535892679.jpg',
    changeNote: 'Penggantian foto kartu Jalur Program MBKM ke foto asli karyawan R&D/QC Ajinomoto di laboratorium',
  },
  portal_pkl_card: {
    previousUrl: '/assets/images/portal_pkl_production_1794535893794.jpg',
    changeNote: 'Penggantian foto kartu Jalur PKL Mandiri ke foto asli pekerja produksi pabrik Ajinomoto Mojokerto',
  },
  brand_logo_ajiu: {
    previousUrl: '/assets/aistudio/LOGO_AJIU_HD_a159e3b5.png',
    changeNote: 'Peningkatan resolusi dan transparansi emblem AJIU menjadi logo_ajiu_crisp.png agar tajam',
  },
};

function detectMimeType(url: string, fallback = 'image/jpeg'): string {
  if (url.startsWith('data:application/pdf')) return 'application/pdf';
  if (url.startsWith('data:image/png') || url.toLowerCase().endsWith('.png')) return 'image/png';
  if (url.startsWith('data:image/webp') || url.toLowerCase().endsWith('.webp')) return 'image/webp';
  if (url.startsWith('data:image/jpeg') || url.startsWith('data:image/jpg')) return 'image/jpeg';
  return fallback;
}

export async function ensureMediaAssetsSeeded(): Promise<void> {
  try {
    const existing = await db.select().from(mediaAssets);
    const existingKeys = new Set(existing.map((item) => item.assetKey));

    for (const item of DEFAULT_MEDIA_ASSETS) {
      if (existingKeys.has(item.assetKey)) continue;

      const inserted = await db
        .insert(mediaAssets)
        .values({
          assetKey: item.assetKey,
          label: item.label,
          placement: item.placement,
          currentUrl: item.currentUrl,
          altText: item.altText,
          objectPosition: item.objectPosition,
          mimeType: item.mimeType,
          sourceType: item.sourceType,
        })
        .onConflictDoNothing({ target: mediaAssets.assetKey })
        .returning();

      const assetRow = inserted[0];
      if (assetRow && assetRow.currentUrl) {
        const changelog = INITIAL_MEDIA_CHANGELOG[item.assetKey];
        await db.insert(mediaEditHistory).values({
          mediaAssetId: assetRow.id,
          assetKey: assetRow.assetKey,
          previousUrl: changelog?.previousUrl ?? null,
          newUrl: assetRow.currentUrl,
          previousObjectPosition: 'center',
          newObjectPosition: assetRow.objectPosition,
          changeNote: changelog?.changeNote || `Registrasi awal aset gambar: ${item.label}`,
          editedBy: 'system',
        });
      }
    }
  } catch (error) {
    console.error('Database query failed in ensureMediaAssetsSeeded:', error);
    throw new Error('Gagal melakukan inisialisasi tabel aset gambar.', { cause: error });
  }
}

export async function getAllMediaAssets() {
  try {
    await ensureMediaAssetsSeeded();
    const assets = await db.select().from(mediaAssets);
    const history = await db
      .select()
      .from(mediaEditHistory)
      .orderBy(desc(mediaEditHistory.createdAt))
      .limit(40);

    // Keep default ordering consistent for UI presentation
    const orderIndex = new Map(DEFAULT_MEDIA_ASSETS.map((item, idx) => [item.assetKey, idx]));
    const sortedAssets = [...assets].sort((a, b) => {
      const ia = orderIndex.get(a.assetKey) ?? 999;
      const ib = orderIndex.get(b.assetKey) ?? 999;
      return ia - ib;
    });

    return { assets: sortedAssets, history };
  } catch (error) {
    console.error('Database query failed in getAllMediaAssets:', error);
    throw new Error('Gagal mengambil daftar aset gambar sistem.', { cause: error });
  }
}

export async function getPublicMediaMap(): Promise<Record<string, MediaAssetItem>> {
  try {
    await ensureMediaAssetsSeeded();
    const rows = await db.select().from(mediaAssets);
    const map: Record<string, MediaAssetItem> = {};
    for (const def of DEFAULT_MEDIA_ASSETS) {
      map[def.assetKey] = def;
    }
    for (const row of rows) {
      map[row.assetKey] = {
        assetKey: row.assetKey,
        label: row.label,
        placement: row.placement,
        currentUrl: row.currentUrl,
        altText: row.altText,
        objectPosition: row.objectPosition,
        mimeType: row.mimeType,
        sourceType: row.sourceType,
      };
    }
    return map;
  } catch (error) {
    console.error('Database query failed in getPublicMediaMap:', error);
    throw new Error('Gagal mengambil konfigurasi gambar portal.', { cause: error });
  }
}

export async function updateMediaAsset(
  assetKey: string,
  patch: {
    currentUrl: string;
    altText?: string;
    objectPosition?: string;
    changeNote?: string;
    sourceType?: string;
  },
  editedBy: string,
  updatedByUserId?: number
) {
  try {
    await ensureMediaAssetsSeeded();
    const existingRows = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.assetKey, assetKey));
    const current = existingRows[0];
    const def = DEFAULT_MEDIA_ASSETS.find((item) => item.assetKey === assetKey);

    const newUrl = patch.currentUrl.trim();
    const newAlt = patch.altText?.trim() || current?.altText || def?.altText || assetKey;
    const newPos = patch.objectPosition?.trim() || current?.objectPosition || def?.objectPosition || 'center';
    const nextMime = newUrl ? detectMimeType(newUrl, current?.mimeType || 'image/jpeg') : 'image/png';
    const nextSource =
      patch.sourceType ||
      (!newUrl ? 'optional_empty' : newUrl.startsWith('data:') ? 'user_upload' : 'custom_url');

    const upserted = await db
      .insert(mediaAssets)
      .values({
        assetKey,
        label: current?.label || def?.label || assetKey,
        placement: current?.placement || def?.placement || 'Custom System Media',
        currentUrl: newUrl,
        altText: newAlt,
        objectPosition: newPos,
        mimeType: nextMime,
        sourceType: nextSource,
        updatedByUserId: updatedByUserId ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: mediaAssets.assetKey,
        set: {
          currentUrl: newUrl,
          altText: newAlt,
          objectPosition: newPos,
          mimeType: nextMime,
          sourceType: nextSource,
          updatedByUserId: updatedByUserId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();

    const updatedAsset = upserted[0];
    await db.insert(mediaEditHistory).values({
      mediaAssetId: updatedAsset.id,
      assetKey: updatedAsset.assetKey,
      previousUrl: current?.currentUrl ?? null,
      newUrl: updatedAsset.currentUrl,
      previousObjectPosition: current?.objectPosition ?? null,
      newObjectPosition: updatedAsset.objectPosition,
      changeNote:
        patch.changeNote?.trim() ||
        (!newUrl
          ? `Menghapus/menyembunyikan dokumen pada slot ${assetKey}`
          : `Pembaruan gambar/dokumen pada slot ${assetKey}`),
      editedBy,
    });

    return updatedAsset;
  } catch (error) {
    console.error('Database query failed in updateMediaAsset:', error);
    throw new Error('Gagal menyimpan perubahan gambar ke database.', { cause: error });
  }
}

export async function resetMediaAssetToDefault(
  assetKey: string,
  editedBy: string,
  updatedByUserId?: number
) {
  const def = DEFAULT_MEDIA_ASSETS.find((item) => item.assetKey === assetKey);
  if (!def) {
    throw new Error('Slot media bawaan tidak ditemukan.');
  }
  return updateMediaAsset(
    assetKey,
    {
      currentUrl: def.currentUrl,
      altText: def.altText,
      objectPosition: def.objectPosition,
      sourceType: def.sourceType,
      changeNote: def.currentUrl
        ? `Mengembalikan aset ${assetKey} ke gambar standar sistem`
        : `Mengosongkan / menyembunyikan slot opsional ${assetKey}`,
    },
    editedBy,
    updatedByUserId
  );
}
