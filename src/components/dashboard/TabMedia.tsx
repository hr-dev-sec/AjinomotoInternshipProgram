import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FileText,
  History,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest } from '../../lib/api';
import { localizeApiMessage } from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';

interface MediaAssetRecord {
  id: number;
  assetKey: string;
  label: string;
  placement: string;
  currentUrl: string;
  altText: string;
  objectPosition: string;
  mimeType: string;
  sourceType: string;
  updatedAt?: string;
}

interface MediaEditHistoryRecord {
  id: number;
  mediaAssetId: number;
  assetKey: string;
  previousUrl: string | null;
  newUrl: string;
  previousObjectPosition: string | null;
  newObjectPosition: string | null;
  changeNote: string;
  editedBy: string;
  createdAt: string;
}

interface MediaApiResponse {
  assets: MediaAssetRecord[];
  history: MediaEditHistoryRecord[];
}

type MediaCategory = 'all' | 'landing' | 'registration' | 'branding';

const OPTIONAL_KEYS = new Set([
  'info_poster_pendaftaran',
  'form_mbkm_banner',
  'form_pkl_banner',
]);

const POSITION_PRESETS = [
  { value: 'center top', idLabel: 'Atas (Top)', enLabel: 'Top' },
  { value: 'center 20%', idLabel: 'Atas 20% (Potret)', enLabel: 'Upper 20% (Portrait)' },
  { value: 'center', idLabel: 'Tengah (Center)', enLabel: 'Center' },
  { value: 'center 75%', idLabel: 'Bawah 75%', enLabel: 'Lower 75%' },
  { value: 'center bottom', idLabel: 'Bawah (Bottom)', enLabel: 'Bottom' },
];

function getAssetCategory(assetKey: string): Exclude<MediaCategory, 'all'> {
  if (['landing_hero', 'portal_mbkm_card', 'portal_pkl_card'].includes(assetKey)) {
    return 'landing';
  }
  if (OPTIONAL_KEYS.has(assetKey)) {
    return 'registration';
  }
  return 'branding';
}

function isPdfDataUrl(url?: string | null, mimeType?: string): boolean {
  if (!url) return false;
  return url.startsWith('data:application/pdf') || mimeType === 'application/pdf';
}

export const TabMedia: React.FC = () => {
  const { lang, t } = useAppPreferences();
  const [assets, setAssets] = useState<MediaAssetRecord[]>([]);
  const [history, setHistory] = useState<MediaEditHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [category, setCategory] = useState<MediaCategory>('all');

  // Upload / Edit Modal
  const [editingAsset, setEditingAsset] = useState<MediaAssetRecord | null>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'url'>('upload');
  const [draftUrl, setDraftUrl] = useState('');
  const [draftFileName, setDraftFileName] = useState('');
  const [draftAltText, setDraftAltText] = useState('');
  const [draftPosition, setDraftPosition] = useState('center');
  const [draftNote, setDraftNote] = useState('');
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [resettingKey, setResettingKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<{ url: string; title: string; isPdf: boolean } | null>(null);
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadMedia = async (silentArg?: unknown) => {
    const silent = silentArg === true;
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await apiRequest<MediaApiResponse>('/api/system/media');
      setAssets(res.assets || []);
      setHistory(res.history || []);
      setBrokenImages({});
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat daftar media & gambar portal.', 'Failed to load portal media & images.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, []);

  useRealtimeSync(['media', 'all'], () => {
    void loadMedia(true);
  });

  // Filter out user-specific avatar keys from the portal gallery unless desired
  const portalAssets = useMemo(
    () => assets.filter((a) => !a.assetKey.startsWith('user_avatar_')),
    [assets]
  );

  const filteredAssets = useMemo(() => {
    if (category === 'all') return portalAssets;
    return portalAssets.filter((a) => getAssetCategory(a.assetKey) === category);
  }, [portalAssets, category]);

  const counts = useMemo(() => {
    const landing = portalAssets.filter((a) => getAssetCategory(a.assetKey) === 'landing').length;
    const registration = portalAssets.filter((a) => getAssetCategory(a.assetKey) === 'registration').length;
    const registrationUploaded = portalAssets.filter(
      (a) => getAssetCategory(a.assetKey) === 'registration' && Boolean(a.currentUrl)
    ).length;
    const branding = portalAssets.filter((a) => getAssetCategory(a.assetKey) === 'branding').length;
    return { total: portalAssets.length, landing, registration, registrationUploaded, branding };
  }, [portalAssets]);

  const openEditor = (asset: MediaAssetRecord) => {
    setEditingAsset(asset);
    setInputMode('upload');
    setDraftUrl(asset.currentUrl || '');
    setDraftFileName('');
    setDraftAltText(asset.altText || asset.label);
    setDraftPosition(asset.objectPosition || 'center');
    setDraftNote('');
    setModalError('');
    setDragging(false);
  };

  const processSelectedFile = (file: File) => {
    if (!editingAsset) return;
    setModalError('');
    const allowsPdf = OPTIONAL_KEYS.has(editingAsset.assetKey);
    const validImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const isImage = validImageTypes.includes(file.type);
    const isPdf = allowsPdf && file.type === 'application/pdf';

    if (!isImage && !isPdf) {
      setModalError(
        allowsPdf
          ? t(
              'Format file harus gambar (PNG, JPG, WEBP) atau dokumen PDF.',
              'File must be an image (PNG, JPG, WEBP) or a PDF document.'
            )
          : t(
              'Format file harus gambar PNG, JPG, atau WEBP.',
              'File must be a PNG, JPG, or WEBP image.'
            )
      );
      return;
    }

    if (file.size > 4.5 * 1024 * 1024) {
      setModalError(
        t('Ukuran file maksimal 4,5 MB.', 'Maximum file size is 4.5 MB.')
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setDraftUrl(dataUrl);
      setDraftFileName(file.name);
      if (!draftNote.trim()) {
        setDraftNote(
          t(
            `Upload dokumen baru: ${file.name}`,
            `Uploaded new file: ${file.name}`
          )
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset) return;
    setModalError('');
    setNotice('');

    const isOptional = OPTIONAL_KEYS.has(editingAsset.assetKey);
    if (!draftUrl.trim() && !isOptional) {
      setModalError(
        t(
          'Unggah gambar terlebih dahulu atau masukkan URL gambar yang valid.',
          'Please upload an image first or enter a valid image URL.'
        )
      );
      return;
    }

    setSaving(true);
    try {
      await apiRequest(`/api/system/media/${encodeURIComponent(editingAsset.assetKey)}`, {
        method: 'PUT',
        body: JSON.stringify({
          currentUrl: draftUrl.trim(),
          altText: draftAltText.trim(),
          objectPosition: draftPosition,
          changeNote:
            draftNote.trim() ||
            t(
              `Pembaruan media pada ${editingAsset.label}`,
              `Updated media for ${editingAsset.label}`
            ),
          sourceType: draftUrl.startsWith('data:') ? 'user_upload' : 'custom_url',
        }),
      });
      setNotice(
        t(
          `"${editingAsset.label}" berhasil diperbarui dan langsung tampil di portal tanpa perlu ubah kode.`,
          `"${editingAsset.label}" updated and live across the portal with zero code changes.`
        )
      );
      setEditingAsset(null);
      await loadMedia();
    } catch (err) {
      setModalError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyimpan perubahan media.', 'Failed to save media update.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefault = async (asset: MediaAssetRecord) => {
    setResettingKey(asset.assetKey);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/system/media/${encodeURIComponent(asset.assetKey)}/reset`, {
        method: 'POST',
      });
      const isOptional = OPTIONAL_KEYS.has(asset.assetKey);
      setNotice(
        isOptional
          ? t(
              `Dokumen pada "${asset.label}" berhasil dihapus/disembunyikan dari portal.`,
              `Document for "${asset.label}" cleared/hidden from the portal.`
            )
          : t(
              `"${asset.label}" berhasil dikembalikan ke gambar standar bawaan.`,
              `"${asset.label}" restored to its default corporate image.`
            )
      );
      await loadMedia();
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal mereset media.', 'Failed to reset media asset.')
      );
    } finally {
      setResettingKey(null);
    }
  };

  const handleRestoreHistoryVersion = async (item: MediaEditHistoryRecord) => {
    if (!item.newUrl) return;
    setResettingKey(item.assetKey);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/system/media/${encodeURIComponent(item.assetKey)}`, {
        method: 'PUT',
        body: JSON.stringify({
          currentUrl: item.newUrl,
          objectPosition: item.newObjectPosition || 'center',
          changeNote: t(
            `Pulihkan versi riwayat #${item.id}`,
            `Restored revision #${item.id}`
          ),
          sourceType: item.newUrl.startsWith('data:') ? 'user_upload' : 'restored_history',
        }),
      });
      setNotice(
        t(
          `Versi sebelumnya untuk slot "${item.assetKey}" berhasil dipulihkan.`,
          `Previous version for slot "${item.assetKey}" restored successfully.`
        )
      );
      await loadMedia();
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal memulihkan versi riwayat.', 'Failed to restore history version.')
      );
    } finally {
      setResettingKey(null);
    }
  };

  const localizeSlotLabel = (asset: MediaAssetRecord) => {
    if (lang === 'id') return asset.label;
    const enMap: Record<string, string> = {
      landing_hero: 'Landing Page Hero — PT Ajinomoto Indonesia Factory',
      portal_mbkm_card: 'MBKM Program Track Card (R&D Lab Photo)',
      portal_pkl_card: 'Independent PKL Track Card (Production Line Photo)',
      info_poster_pendaftaran: 'Official Internship & PKL Registration Poster / Brochure',
      form_mbkm_banner: 'MBKM Registration Form Visual Guide / Banner',
      form_pkl_banner: 'Independent PKL Registration Form Visual Guide / Banner',
      login_showcase_bg: 'Admin & Leadership Login Showcase Background',
      brand_logo_ajinomoto: 'Official PT Ajinomoto Indonesia Logo',
      brand_logo_ajiu: 'AJIU Crisp Crest (Ajinomoto Indonesia University)',
      brand_logo_safety: 'Safety First Corporate Emblem',
      admin_default_avatar: 'Default HR Development Admin Avatar',
    };
    return enMap[asset.assetKey] || asset.label;
  };

  const localizePlacement = (asset: MediaAssetRecord) => {
    if (lang === 'id') return asset.placement;
    const enMap: Record<string, string> = {
      landing_hero: 'Landing Page — Hero Showcase',
      portal_mbkm_card: 'Main Portal — MBKM Program Card',
      portal_pkl_card: 'Main Portal — Independent PKL Card',
      info_poster_pendaftaran: 'Landing Page — Official Registration Announcement & Brochure',
      form_mbkm_banner: 'MBKM Registration Form — Info Panel',
      form_pkl_banner: 'PKL Registration Form — Info Panel',
      login_showcase_bg: 'Admin & Leadership Login — Left Panel',
      brand_logo_ajinomoto: 'Global Header, Login, Portal & Dashboard',
      brand_logo_ajiu: 'Global Header, MBKM Card, Login & Sidebar',
      brand_logo_safety: 'Hero Strip, Portal Index, Login & Footer',
      admin_default_avatar: 'Dashboard Sidebar & Admin Profile',
    };
    return enMap[asset.assetKey] || asset.placement;
  };

  const formatTimestamp = (iso?: string) => {
    if (!iso) return '-';
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="surface-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-theme-accent">
            <ImageIcon className="h-4 w-4" />
            {t('CMS Visual Tanpa Edit Kode', 'No-Code Visual CMS')}
          </div>
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
            {t(
              'Manajemen Media, Gambar Landing Page & Poster Informasi Magang / PKL',
              'Media Manager — Landing Page Images & Internship / PKL Info Posters'
            )}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-200 max-w-3xl leading-relaxed">
            {t(
              'Ganti foto hero gedung pabrik, kartu program MBKM/PKL, poster/brosur pengumuman pendaftaran (Gambar atau PDF), banner panduan formulir, hingga logo korporat cukup dengan mengunggah file — perubahan langsung tersimpan di Cloud SQL dan tampil seketika di portal publik.',
              'Replace the factory hero photo, MBKM/PKL cards, official internship registration posters/brochures (Image or PDF), form guide banners, and corporate logos simply by uploading files — updates persist in Cloud SQL and go live instantly.'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={loadMedia}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {t('Muat Ulang Aset', 'Refresh Assets')}
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: 'all', label: t('Semua Media', 'All Media'), count: counts.total },
            { id: 'landing', label: t('Landing Page & Kartu Program', 'Landing & Program Cards'), count: counts.landing },
            {
              id: 'registration',
              label: t('Poster & Panduan Daftar Magang / PKL', 'Internship & PKL Posters / Guides'),
              count: `${counts.registrationUploaded}/${counts.registration}`,
            },
            { id: 'branding', label: t('Logo Korporat & Latar Login', 'Corporate Logos & Login'), count: counts.branding },
          ] as Array<{ id: MediaCategory; label: string; count: number | string }>
        ).map((tab) => {
          const active = category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                active
                  ? 'btn-theme-primary'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`font-mono text-[11px] ${
                  active ? 'text-white/90' : 'text-slate-400 dark:text-slate-300'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-300 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Asset Cards Grid */}
      {loading ? (
        <div className="surface-card p-10 text-center text-xs text-slate-500 dark:text-slate-200">
          {t('Memuat seluruh slot gambar & dokumen portal...', 'Loading portal image & document slots...')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          {filteredAssets.map((asset) => {
            const isOptional = OPTIONAL_KEYS.has(asset.assetKey);
            const hasContent = Boolean(asset.currentUrl && asset.currentUrl.trim().length > 0);
            const isPdf = isPdfDataUrl(asset.currentUrl, asset.mimeType);
            const isLogo = asset.assetKey.startsWith('brand_logo_');

            return (
              <div
                key={asset.assetKey}
                className="surface-card overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  {/* Visual Preview Area */}
                  <div
                    className={`relative h-48 w-full overflow-hidden border-b border-slate-200/80 dark:border-slate-800 ${
                      isLogo
                        ? 'bg-slate-100/90 dark:bg-slate-800/80 flex items-center justify-center p-6'
                        : 'bg-slate-100 dark:bg-slate-900'
                    }`}
                  >
                    {!hasContent || brokenImages[asset.assetKey] ? (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-2 p-5 text-center border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-200/70 text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-100">
                          {brokenImages[asset.assetKey]
                            ? t('Gambar Belum Tersedia — Silakan Unggah Ulang', 'Image Unavailable — Please Re-Upload')
                            : t('Belum Ada Poster / Dokumen', 'No Poster / Document Uploaded')}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-300 max-w-[240px]">
                          {t(
                            'Opsional · Unggah gambar (JPG/PNG/WEBP) atau brosur PDF untuk menampilkan informasi ini di portal.',
                            'Optional · Upload an image (JPG/PNG/WEBP) or PDF brochure to display this info on the portal.'
                          )}
                        </p>
                      </div>
                    ) : isPdf ? (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-2.5 p-5 bg-gradient-to-br from-red-50 to-slate-100 dark:from-red-950/30 dark:to-slate-900">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-white shadow-sm">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {t('Dokumen PDF Aktif di Portal', 'PDF Document Live on Portal')}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewUrl({
                              url: asset.currentUrl,
                              title: localizeSlotLabel(asset),
                              isPdf: true,
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-800 shadow-2xs ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {t('Pratinjau PDF', 'Preview PDF')}
                        </button>
                      </div>
                    ) : (
                      <>
                        <img
                          src={asset.currentUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setBrokenImages((prev) => ({ ...prev, [asset.assetKey]: true }))
                          }
                          style={!isLogo ? { objectPosition: asset.objectPosition || 'center' } : undefined}
                          className={
                            isLogo
                              ? 'max-h-28 max-w-[80%] object-contain drop-shadow-xs'
                              : 'h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]'
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewUrl({
                              url: asset.currentUrl,
                              title: localizeSlotLabel(asset),
                              isPdf: false,
                            })
                          }
                          className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-slate-950/80 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-xs hover:bg-slate-950"
                        >
                          <Eye className="h-3 w-3" />
                          {t('Lihat', 'View')}
                        </button>
                      </>
                    )}

                    {/* Slot Status Indicator */}
                    <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                      {isOptional ? (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold backdrop-blur-xs ${
                            hasContent
                              ? 'bg-emerald-600/90 text-white'
                              : 'bg-slate-800/80 text-slate-200'
                          }`}
                        >
                          {hasContent ? t('Tampil di Portal', 'Live on Portal') : t('Tersembunyi', 'Hidden')}
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-950/75 px-2 py-0.5 text-[10px] font-mono font-semibold text-white backdrop-blur-xs">
                          {asset.objectPosition || 'center'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {localizeSlotLabel(asset)}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-theme-accent font-semibold">
                      <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{localizePlacement(asset)}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-200 line-clamp-2">
                      {asset.altText || '-'}
                    </p>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="border-t border-slate-100 dark:border-slate-800 px-4 py-3 flex items-center justify-between gap-2 bg-slate-50/50 dark:bg-slate-900/40">
                  <button
                    type="button"
                    onClick={() => openEditor(asset)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg btn-theme-primary px-3 py-2 text-xs font-semibold"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {hasContent
                      ? t('Upload / Ganti', 'Upload / Replace')
                      : t('Upload Poster / File', 'Upload Poster / File')}
                  </button>

                  {hasContent && (
                    <button
                      type="button"
                      disabled={resettingKey === asset.assetKey}
                      onClick={() => handleResetDefault(asset)}
                      title={
                        isOptional
                          ? t('Hapus / sembunyikan dari portal', 'Remove / hide from portal')
                          : t('Kembalikan gambar default', 'Restore default image')
                      }
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      {isOptional ? <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-300" /> : <RotateCcw className="h-3.5 w-3.5" />}
                      <span className="hidden sm:inline">
                        {isOptional ? t('Sembunyikan', 'Hide') : t('Default', 'Default')}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Media Edit History & 1-Click Rollback */}
      <div className="surface-card p-5 space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-theme-accent" />
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('Riwayat Pergantian Gambar & Dokumen (1-Klik Pulihkan)', 'Image & Document Revision History (1-Click Restore)')}
            </h3>
          </div>
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-300">
            {history.length} {t('entri terbaru', 'recent entries')}
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {history.length === 0 ? (
            <div className="py-6 text-center text-slate-500 dark:text-slate-200">
              {t('Belum ada riwayat perubahan media.', 'No media revision history recorded yet.')}
            </div>
          ) : (
            history.map((item) => {
              const isPdf = isPdfDataUrl(item.newUrl);
              return (
                <div
                  key={item.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {item.newUrl ? (
                      isPdf ? (
                        <div className="h-11 w-14 rounded-lg bg-red-50 text-red-600 dark:text-red-300 border border-red-200 flex items-center justify-center shrink-0 dark:bg-red-950/40 dark:border-red-900/50">
                          <FileText className="h-5 w-5" />
                        </div>
                      ) : (
                        <img
                          src={item.newUrl}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                          className="h-11 w-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800"
                        />
                      )
                    ) : (
                      <div className="h-11 w-14 rounded-lg bg-slate-100 text-slate-400 dark:text-slate-300 border border-slate-200 flex items-center justify-center shrink-0 dark:bg-slate-800 dark:border-slate-700">
                        <X className="h-4 w-4" />
                      </div>
                    )}
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-theme-accent">
                          {item.assetKey}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-300">
                          {formatTimestamp(item.createdAt)} · {item.editedBy}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 truncate">
                        {item.changeNote}
                      </div>
                    </div>
                  </div>

                  {item.newUrl && (
                    <button
                      type="button"
                      disabled={resettingKey === item.assetKey}
                      onClick={() => handleRestoreHistoryVersion(item)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 shrink-0 self-start sm:self-auto"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t('Pulihkan', 'Restore')}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Upload / Edit Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-theme-header px-5 py-4 backdrop-blur-md dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
                  <Upload className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {localizeSlotLabel(editingAsset)}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-200 truncate">
                    {localizePlacement(editingAsset)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAsset(null)}
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAsset} className="p-5 space-y-5">
              {modalError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-200">
                  {modalError}
                </div>
              )}

              {/* Source Mode Switcher */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode('upload')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    inputMode === 'upload'
                      ? 'btn-theme-primary'
                      : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" />
                  {t('Upload Dokumen / Gambar', 'Upload Document / Image')}
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('url')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    inputMode === 'url'
                      ? 'btn-theme-primary'
                      : 'border border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {t('Gunakan Tautan URL', 'Use Image URL')}
                </button>
              </div>

              {inputMode === 'upload' ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processSelectedFile(file);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                    dragging
                      ? 'border-theme-accent bg-theme-soft'
                      : 'border-slate-300 bg-slate-50/70 hover:border-theme-accent dark:border-slate-700 dark:bg-slate-900/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={
                      OPTIONAL_KEYS.has(editingAsset.assetKey)
                        ? 'image/png,image/jpeg,image/webp,application/pdf'
                        : 'image/png,image/jpeg,image/webp'
                    }
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) processSelectedFile(file);
                    }}
                  />
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl icon-theme-plinth mb-3">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {t(
                      'Klik untuk memilih file atau seret dokumen ke area ini',
                      'Click to choose a file or drag & drop here'
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-200">
                    {OPTIONAL_KEYS.has(editingAsset.assetKey)
                      ? t(
                          'Mendukung Gambar (PNG, JPG, WEBP) atau Dokumen Brosur PDF · Maks. 4,5 MB',
                          'Supports Images (PNG, JPG, WEBP) or PDF Brochures · Max 4.5 MB'
                        )
                      : t(
                          'Mendukung Gambar PNG, JPG, atau WEBP resolusi tinggi · Maks. 4,5 MB',
                          'Supports high-resolution PNG, JPG, or WEBP images · Max 4.5 MB'
                        )}
                  </p>
                  {draftFileName && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60">
                      <Sparkles className="h-3.5 w-3.5" />
                      {draftFileName}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('URL Gambar (HTTPS atau path /assets/...)', 'Image URL (HTTPS or /assets/... path)')}
                  </label>
                  <input
                    type="text"
                    value={draftUrl}
                    onChange={(e) => setDraftUrl(e.target.value)}
                    placeholder="https://... atau /assets/..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              )}

              {/* Live Preview Box */}
              {draftUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>{t('Pratinjau Langsung', 'Live Preview')}</span>
                    <span className="font-mono text-[11px] text-slate-400 dark:text-slate-300">
                      {isPdfDataUrl(draftUrl) ? 'PDF Document' : `Focus: ${draftPosition}`}
                    </span>
                  </div>
                  <div className="relative h-52 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900 flex items-center justify-center">
                    {isPdfDataUrl(draftUrl) ? (
                      <iframe
                        src={draftUrl}
                        title="PDF Preview"
                        className="h-full w-full"
                      />
                    ) : (
                      <img
                        src={draftUrl}
                        alt={draftAltText || editingAsset.label}
                        referrerPolicy="no-referrer"
                        style={
                          !editingAsset.assetKey.startsWith('brand_logo_')
                            ? { objectPosition: draftPosition }
                            : undefined
                        }
                        className={
                          editingAsset.assetKey.startsWith('brand_logo_')
                            ? 'max-h-36 max-w-[80%] object-contain'
                            : 'h-full w-full object-cover'
                        }
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Crop / Focal Point Presets (for non-logo, non-PDF images) */}
              {draftUrl && !isPdfDataUrl(draftUrl) && !editingAsset.assetKey.startsWith('brand_logo_') && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('Titik Fokus Potongan Gambar (Object Position)', 'Image Focal Point (Object Position)')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {POSITION_PRESETS.map((pos) => (
                      <button
                        key={pos.value}
                        type="button"
                        onClick={() => setDraftPosition(pos.value)}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                          draftPosition === pos.value
                            ? 'border-theme-accent bg-theme-soft text-theme-accent'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                      >
                        {t(pos.idLabel, pos.enLabel)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Caption / Alt Text & Change Note */}
              <div className="grid grid-cols-1 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('Judul / Keterangan Gambar (Alt Text & Caption)', 'Image Title / Caption (Alt Text)')}
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={draftAltText}
                    onChange={(e) => setDraftAltText(e.target.value)}
                    placeholder={t('Keterangan singkat gambar atau pengumuman...', 'Short description of the image or notice...')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('Catatan Perubahan (Opsional — untuk Riwayat Audit)', 'Change Note (Optional — for Audit History)')}
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={draftNote}
                    onChange={(e) => setDraftNote(e.target.value)}
                    placeholder={t(
                      'Contoh: Update poster rekrutmen MBKM Batch 2 Tahun 2026',
                      'e.g., Updated MBKM Batch 2 2026 recruitment poster'
                    )}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-200">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                  {t('Langsung aktif di Portal Publik setelah disimpan', 'Published immediately to Public Portal on save')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingAsset(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    {t('Batal', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    {saving ? t('Menyimpan...', 'Saving...') : t('Simpan & Terbitkan', 'Save & Publish')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="surface-card w-full max-w-4xl max-h-[90dvh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <div className="font-display text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {previewUrl.title}
              </div>
              <button
                type="button"
                onClick={() => setPreviewUrl(null)}
                className="rounded-lg p-1 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-950/90 p-4 flex items-center justify-center min-h-[360px]">
              {previewUrl.isPdf ? (
                <iframe
                  src={previewUrl.url}
                  title={previewUrl.title}
                  className="h-[72dvh] w-full rounded-lg bg-white"
                />
              ) : (
                <img
                  src={previewUrl.url}
                  alt={previewUrl.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[75dvh] max-w-full object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
