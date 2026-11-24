import React, { useEffect, useState } from 'react';
import {
  Building2,
  Camera,
  CheckCircle2,
  KeyRound,
  Mail,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest } from '../../lib/api';
import { localizeApiMessage } from '../../lib/localizeData';
import type { AdminUser } from '../AdminLogin';

const DEFAULT_AVATAR = '/assets/images/avatar_hr_admin_1794535891951.jpg';

export const EditProfileModal: React.FC<{
  open: boolean;
  user: AdminUser;
  onClose: () => void;
  onSaved: (updated: AdminUser) => void;
}> = ({ open, user, onClose, onSaved }) => {
  const { lang, t } = useAppPreferences();
  const [namaTampilan, setNamaTampilan] = useState(user.namaTampilan || '');
  const [role, setRole] = useState(user.role || '');
  const [departemen, setDepartemen] = useState(user.departemen || 'HR Development Section');
  const [email, setEmail] = useState(user.email || 'hr.development@ajinomoto.co.id');
  const [noTelepon, setNoTelepon] = useState(user.noTelepon || '+62 321-361-000');
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || DEFAULT_AVATAR);

  const [changePassword, setChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    setNamaTampilan(user.namaTampilan || '');
    setRole(user.role || '');
    setDepartemen(user.departemen || 'HR Development Section');
    setEmail(user.email || 'hr.development@ajinomoto.co.id');
    setNoTelepon(user.noTelepon || '+62 321-361-000');
    setAvatarUrl(user.avatarUrl || DEFAULT_AVATAR);
    setChangePassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setNotice('');
  }, [open, user]);

  if (!open) return null;

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError(t('Format foto profil harus JPG, PNG, atau WEBP.', 'Profile photo must be JPG, PNG, or WEBP.'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError(t('Ukuran foto profil maksimal 2 MB.', 'Profile photo maximum size is 2 MB.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result || DEFAULT_AVATAR));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');

    if (changePassword) {
      if (!currentPassword) {
        setError(t('Masukkan password saat ini terlebih dahulu.', 'Please enter your current password first.'));
        return;
      }
      if (newPassword.length < 6) {
        setError(t('Password baru minimal 6 karakter.', 'New password must be at least 6 characters.'));
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t('Konfirmasi password baru tidak cocok.', 'New password confirmation does not match.'));
        return;
      }
    }

    setSaving(true);
    try {
      const res = await apiRequest<{ message: string; user: AdminUser }>('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          namaTampilan: namaTampilan.trim(),
          role: role.trim(),
          departemen: departemen.trim(),
          email: email.trim(),
          noTelepon: noTelepon.trim(),
          avatarUrl,
          ...(changePassword ? { currentPassword, newPassword } : {}),
        }),
      });
      onSaved(res.user);
      setNotice(localizeApiMessage(res.message, lang));
      setChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
      }, 650);
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal memperbarui profil.', 'Failed to update profile.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
      <div className="surface-card w-full max-w-xl p-5 sm:p-6 space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-theme-accent">
                {t('Pengaturan Akun Administrator', 'Administrator Account Settings')}
              </p>
              <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                {t('Edit Profil HR Development', 'Edit HR Development Profile')}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={t('Tutup modal edit profil', 'Close edit profile modal')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Row */}
          <div className="surface-inset flex flex-wrap items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-4">
              <img
                src={avatarUrl || DEFAULT_AVATAR}
                alt={namaTampilan || user.username}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
                className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--theme-accent-soft-border)] border border-slate-200 dark:border-slate-700 shrink-0"
              />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {t('Foto Profil Admin', 'Admin Profile Photo')}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-200">
                  {t('JPG, PNG, atau WEBP maksimal 2 MB.', 'JPG, PNG, or WEBP max 2 MB.')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap">
                <Camera className="h-3.5 w-3.5 text-theme-accent" />
                <span>{t('Ganti Foto', 'Change Photo')}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={handleAvatarUpload}
                />
              </label>
              {avatarUrl !== DEFAULT_AVATAR && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(DEFAULT_AVATAR)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
                >
                  <RotateCcw className="h-3 w-3" />
                  Default
                </button>
              )}
            </div>
          </div>

          {/* Profile Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-100 mb-1">
                {t('Username Login', 'Login Username')}
              </label>
              <input
                type="text"
                disabled
                value={user.username}
                className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 font-mono text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 cursor-not-allowed"
              />
            </div>
            <div>
              <label htmlFor="prof-nama" className="block font-semibold text-slate-700 dark:text-slate-100 mb-1">
                {t('Nama Tampilan', 'Display Name')}
              </label>
              <input
                id="prof-nama"
                type="text"
                required
                value={namaTampilan}
                onChange={(e) => setNamaTampilan(e.target.value)}
                placeholder={t('Nama lengkap HR Admin', 'HR Admin full name')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 input-theme-focus dark:border-slate-600 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="prof-role" className="block font-semibold text-slate-700 dark:text-slate-100 mb-1">
                {t('Jabatan / Role', 'Title / Role')}
              </label>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
                <input
                  id="prof-role"
                  type="text"
                  required
                  disabled={!(user.role || '').toLowerCase().includes('hr development admin') && (user.role || '').toLowerCase() !== 'super admin'}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={t('Contoh: HR Development Admin', 'e.g., HR Development Admin')}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-slate-900 input-theme-focus disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-950 dark:text-white dark:disabled:bg-slate-900/70 dark:disabled:text-slate-200"
                />
              </div>
            </div>
            <div>
              <label htmlFor="prof-dept" className="block font-semibold text-slate-700 dark:text-slate-100 mb-1">
                {t('Departemen / Section', 'Department / Section')}
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
                <input
                  id="prof-dept"
                  type="text"
                  required
                  value={departemen}
                  onChange={(e) => setDepartemen(e.target.value)}
                  placeholder={t('Contoh: HR Development Section', 'e.g., HR Development Section')}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-slate-900 input-theme-focus dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label htmlFor="prof-email" className="block font-semibold text-slate-700 dark:text-slate-100 mb-1">
                {t('Email Korporat', 'Corporate Email')}
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
                <input
                  id="prof-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="hr@ajinomoto.co.id"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 text-slate-900 input-theme-focus dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
            <div>
              <label htmlFor="prof-phone" className="block font-semibold text-slate-700 dark:text-slate-100 mb-1">
                {t('No. Telepon / Ext', 'Phone / Ext')}
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
                <input
                  id="prof-phone"
                  type="text"
                  value={noTelepon}
                  onChange={(e) => setNoTelepon(e.target.value)}
                  placeholder="+62 321-361-000"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-2 font-mono text-slate-900 input-theme-focus dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Optional Password Change */}
          <div className="border-t border-slate-100 pt-3 dark:border-slate-800 space-y-3">
            <button
              type="button"
              onClick={() => setChangePassword((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-theme-accent hover:underline"
            >
              <KeyRound className="h-3.5 w-3.5" />
              {changePassword ? t('Batalkan Ubah Password', 'Cancel Password Change') : t('Ubah Password Akun', 'Change Account Password')}
            </button>

            {changePassword && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Password Saat Ini', 'Current Password')}
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Password Baru', 'New Password')}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={t('Min. 6 karakter', 'Min. 6 chars')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('Konfirmasi Baru', 'Confirm New')}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('Ulangi password', 'Repeat password')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {t('Batal', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? t('Menyimpan...', 'Saving...') : t('Simpan Perubahan', 'Save Changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
