import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAppPreferences } from '../../contexts/AppPreferencesContext';
import { apiRequest } from '../../lib/api';
import { localizeAccountRole, localizeApiMessage } from '../../lib/localizeData';
import { useRealtimeSync } from '../../lib/realtime';
import type { AdminUser } from '../AdminLogin';

export interface ManagedUserAccount {
  id: number;
  uid: string;
  username: string;
  namaTampilan: string;
  role: string;
  departemen: string;
  email: string;
  noTelepon: string;
  avatarUrl: string;
  authProvider: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

interface UserAuditLogItem {
  id: number;
  userId: number;
  targetUsername: string;
  changedFields: string;
  passwordChanged: boolean;
  changedBy: string;
  createdAt: string;
}

interface UsersApiResponse {
  users: ManagedUserAccount[];
  auditLogs: UserAuditLogItem[];
  allowedRoles: string[];
}

const ROLE_OPTIONS = [
  {
    value: 'HR Development Admin',
    badgeClass: 'bg-theme-soft text-theme-accent ring-1 ring-inset ring-current/20',
    icon: ShieldCheck,
    descId: 'Akses penuh seluruh modul, konfigurasi sistem, dan manajemen akun pengguna.',
    descEn: 'Full access to all modules, system settings, and user account management.',
    defaultDept: 'HR Development Section',
  },
  {
    value: 'Admin Operasional',
    badgeClass:
      'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
    icon: Shield,
    descId: 'Kelola lowongan, seleksi pelamar, peserta magang, absensi harian, dan PKS.',
    descEn: 'Manage vacancies, applicant selection, interns, daily attendance, and MoAs.',
    defaultDept: 'HR Development Section',
  },
  {
    value: 'Pimpinan Perusahaan',
    badgeClass:
      'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
    icon: Crown,
    descId: 'Plant Director / Factory Manager — pantau KPI eksekutif, analitik, dan laporan.',
    descEn: 'Plant Director / Factory Manager — monitor executive KPIs, analytics, and reports.',
    defaultDept: 'Executive Management (Plant Director)',
  },
  {
    value: 'Pimpinan Departemen / Seksi',
    badgeClass:
      'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
    icon: Building2,
    descId: 'Kepala Departemen / Seksi — pantau kehadiran, performa, dan evaluasi peserta unit.',
    descEn: 'Department / Section Head — monitor attendance, performance, and unit intern evaluations.',
    defaultDept: 'Production & Fermentation Dept.',
  },
] as const;

const DEPARTMENT_PRESETS = [
  'Executive Management (Plant Director)',
  'HR Development Section',
  'Production & Fermentation Dept.',
  'Quality Assurance (QA) Dept.',
  'Engineering & Maintenance Dept.',
  'Utility & Environment Dept.',
  'Supply Chain & Warehouse Dept.',
  'R&D / Food Technology Dept.',
  'Finance & Accounting Dept.',
  'IT & Digitalization Section',
  'General Affairs & Safety Section',
];

function generateSecurePassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*';
  const all = upper + lower + digits + symbols;
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  const chars = [
    upper[array[0] % upper.length],
    lower[array[1] % lower.length],
    digits[array[2] % digits.length],
    symbols[array[3] % symbols.length],
  ];
  for (let i = 4; i < length; i++) {
    chars.push(all[array[i] % all.length]);
  }
  return chars.join('');
}

function suggestUsername(fullName: string): string {
  return fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, '')
    .replace(/\s+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 28);
}

export const TabUsers: React.FC<{
  currentUser: AdminUser;
}> = ({ currentUser }) => {
  const { lang, t } = useAppPreferences();
  const [users, setUsers] = useState<ManagedUserAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<UserAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUserAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [customDeptMode, setCustomDeptMode] = useState(false);

  const [form, setForm] = useState({
    namaTampilan: '',
    username: '',
    email: '',
    noTelepon: '',
    role: 'Pimpinan Departemen / Seksi',
    departemen: 'Production & Fermentation Dept.',
    password: '',
    isActive: true,
  });

  // Newly created credentials banner
  const [createdBanner, setCreatedBanner] = useState<{
    username: string;
    password: string;
    role: string;
    departemen: string;
    namaTampilan: string;
  } | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<ManagedUserAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadUsers = async (silentArg?: unknown) => {
    const silent = silentArg === true;
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await apiRequest<UsersApiResponse>('/api/users');
      setUsers(res.users || []);
      setAuditLogs(res.auditLogs || []);
    } catch (err) {
      if (!silent) {
        setError(
          err instanceof Error
            ? localizeApiMessage(err.message, lang)
            : t('Gagal memuat daftar pengguna.', 'Failed to load user accounts.')
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  useRealtimeSync(['users', 'all'], () => {
    void loadUsers(true);
  });

  const kpi = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role.toLowerCase().includes('admin')).length;
    const leaders = users.filter((u) => u.role.toLowerCase().includes('pimpinan')).length;
    const active = users.filter((u) => u.isActive).length;
    return { total, admins, leaders, active };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && !u.isActive) return false;
      if (statusFilter === 'INACTIVE' && u.isActive) return false;
      if (q) {
        const hay = `${u.namaTampilan} ${u.username} ${u.email} ${u.role} ${u.departemen}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormError('');
    setShowPassword(true);
    setUsernameTouched(false);
    setCustomDeptMode(false);
    setForm({
      namaTampilan: '',
      username: '',
      email: '',
      noTelepon: '',
      role: 'Pimpinan Departemen / Seksi',
      departemen: 'Production & Fermentation Dept.',
      password: generateSecurePassword(12),
      isActive: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (account: ManagedUserAccount) => {
    setEditingUser(account);
    setFormError('');
    setShowPassword(false);
    setUsernameTouched(true);
    const isPreset = DEPARTMENT_PRESETS.includes(account.departemen);
    setCustomDeptMode(!isPreset);
    setForm({
      namaTampilan: account.namaTampilan,
      username: account.username,
      email: account.email,
      noTelepon: account.noTelepon || '',
      role: ROLE_OPTIONS.some((r) => r.value === account.role) ? account.role : 'HR Development Admin',
      departemen: account.departemen || 'HR Development Section',
      password: '',
      isActive: account.isActive,
    });
    setModalOpen(true);
  };

  const handleSelectRole = (nextRole: string) => {
    const meta = ROLE_OPTIONS.find((r) => r.value === nextRole);
    setForm((prev) => ({
      ...prev,
      role: nextRole,
      departemen: !editingUser && !customDeptMode && meta ? meta.defaultDept : prev.departemen,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setNotice('');
    setSaving(true);

    try {
      if (editingUser) {
        const payload: Record<string, unknown> = {
          namaTampilan: form.namaTampilan.trim(),
          role: form.role,
          departemen: form.departemen.trim(),
          email: form.email.trim(),
          noTelepon: form.noTelepon.trim(),
          isActive: form.isActive,
        };
        if (form.password.trim().length > 0) {
          payload.newPassword = form.password;
        }
        const res = await apiRequest<{ message: string; user: ManagedUserAccount }>(
          `/api/users/${editingUser.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        setNotice(
          t(
            res.message || `Akun @${editingUser.username} berhasil diperbarui.`,
            `Account @${editingUser.username} updated successfully.`
          )
        );
        setModalOpen(false);
        await loadUsers();
      } else {
        const res = await apiRequest<{ message: string; user: ManagedUserAccount }>('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            username: form.username.trim().toLowerCase(),
            password: form.password,
            namaTampilan: form.namaTampilan.trim(),
            role: form.role,
            departemen: form.departemen.trim(),
            email: form.email.trim(),
            noTelepon: form.noTelepon.trim(),
            isActive: form.isActive,
          }),
        });
        setCreatedBanner({
          username: res.user.username,
          password: form.password,
          role: res.user.role,
          departemen: res.user.departemen,
          namaTampilan: res.user.namaTampilan,
        });
        setCopiedCreds(false);
        setNotice(
          t(
            res.message || `Akun @${res.user.username} berhasil dibuat.`,
            `Account @${res.user.username} created successfully.`
          )
        );
        setModalOpen(false);
        await loadUsers();
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menyimpan data akun.', 'Failed to save account data.')
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (account: ManagedUserAccount) => {
    setTogglingId(account.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/users/${account.id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      setNotice(
        !account.isActive
          ? t(`Akun @${account.username} berhasil diaktifkan kembali.`, `Account @${account.username} reactivated.`)
          : t(`Akun @${account.username} berhasil dinonaktifkan.`, `Account @${account.username} deactivated.`)
      );
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal mengubah status akun.', 'Failed to update account status.')
      );
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });
      setNotice(
        t(
          `Akun @${deleteTarget.username} telah dihapus secara permanen.`,
          `Account @${deleteTarget.username} has been permanently removed.`
        )
      );
      setDeleteTarget(null);
      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error
          ? localizeApiMessage(err.message, lang)
          : t('Gagal menghapus akun pengguna.', 'Failed to delete user account.')
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdBanner) return;
    const text = [
      `PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory`,
      `${t('Nama', 'Name')}: ${createdBanner.namaTampilan}`,
      `${t('Role', 'Role')}: ${localizeAccountRole(createdBanner.role, lang)}`,
      `${t('Departemen / Seksi', 'Department / Section')}: ${createdBanner.departemen}`,
      `Username: ${createdBanner.username}`,
      `Password: ${createdBanner.password}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
    } catch {
      // clipboard fallback ignored
    }
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return t('Belum pernah login', 'Never signed in');
    try {
      return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  const getRoleBadge = (role: string) => {
    const found = ROLE_OPTIONS.find((r) => r.value === role);
    return (
      found?.badgeClass ||
      'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="surface-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-theme-accent">
            <ShieldCheck className="h-4 w-4" />
            {t('Kontrol Akses Korporat · RBAC', 'Corporate Access Control · RBAC')}
          </div>
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100">
            {t(
              'Manajemen Pengguna — Admin & Pimpinan Perusahaan / Dept. / Seksi',
              'User Management — Admins & Company / Dept. / Section Leaders'
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-200 max-w-2xl">
            {t(
              'Buat dan kelola akun login untuk HR Development Admin, Admin Operasional, Pimpinan Perusahaan (Plant Director / Factory Manager), serta Pimpinan Departemen atau Seksi.',
              'Create and manage login accounts for HR Development Admins, Operational Admins, Company Leadership (Plant Director / Factory Manager), and Department or Section Heads.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadUsers}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('Muat Ulang', 'Refresh')}
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold whitespace-nowrap"
          >
            <UserPlus className="h-4 w-4" />
            {t('Buat Akun Baru', 'Create New Account')}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[
          {
            label: t('Total Akun Terdaftar', 'Total Registered Accounts'),
            value: kpi.total,
            sub: t('Tersimpan di Cloud SQL', 'Stored in Cloud SQL'),
            icon: Users,
            tone: 'icon-theme-plinth',
          },
          {
            label: t('Akun Admin HRD', 'HRD Admin Accounts'),
            value: kpi.admins,
            sub: t('HR Dev & Operasional', 'HR Dev & Operational'),
            icon: ShieldCheck,
            tone: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900/60',
          },
          {
            label: t('Pimpinan Perusahaan / Dept.', 'Company / Dept. Leaders'),
            value: kpi.leaders,
            sub: t('Direksi, Dept. & Seksi', 'Executives, Dept. & Sections'),
            icon: Crown,
            tone: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900/60',
          },
          {
            label: t('Akun Aktif', 'Active Accounts'),
            value: kpi.active,
            sub: `${kpi.total - kpi.active} ${t('nonaktif', 'inactive')}`,
            icon: UserCheck,
            tone: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900/60',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="kpi-tile p-4 flex flex-col justify-between gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                  {card.label}
                </span>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${card.tone}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                {card.value}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-200">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* One-time Created Account Credentials Banner */}
      {createdBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 sm:p-5 dark:border-emerald-900/60 dark:bg-emerald-950/35 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shrink-0">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  {t(
                    'Akun Baru Siap Digunakan — Simpan Kredensial Awal',
                    'New Account Ready — Save Initial Credentials'
                  )}
                </h3>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-200/80">
                  {t(
                    'Password terenkripsi satu arah di server dan hanya ditampilkan sekali di sini. Serahkan kredensial ini secara aman kepada pemegang akun.',
                    'The password is one-way hashed on the server and displayed only once here. Share these credentials securely with the account holder.'
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreatedBanner(null)}
              className="rounded-lg p-1 text-emerald-700 hover:bg-emerald-100 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
              aria-label={t('Tutup banner', 'Dismiss banner')}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 rounded-xl bg-white/90 p-3.5 border border-emerald-200/80 dark:bg-slate-950/70 dark:border-emerald-900/50 text-xs">
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-300">{t('Nama & Unit', 'Name & Unit')}</div>
              <div className="font-bold text-slate-900 dark:text-slate-100">{createdBanner.namaTampilan}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-200">{createdBanner.departemen}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-300">{t('Hak Akses', 'Role')}</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {localizeAccountRole(createdBanner.role, lang)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-300">Username</div>
              <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{createdBanner.username}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase text-slate-400 dark:text-slate-300">{t('Password Awal', 'Initial Password')}</div>
              <div className="font-mono font-bold text-emerald-700 dark:text-emerald-300">{createdBanner.password}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              {copiedCreds ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCreds
                ? t('Kredensial Tersalin', 'Credentials Copied')
                : t('Salin Kredensial Login', 'Copy Login Credentials')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}
      {notice && !createdBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
          {notice}
        </div>
      )}

      {/* Search & Filter Toolbar + User Table */}
      <div className="surface-card overflow-hidden">
        <div className="border-b border-slate-200/80 p-4 dark:border-slate-800 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                'Cari nama, username, email, atau departemen/seksi...',
                'Search name, username, email, or department/section...'
              )}
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium input-theme-focus dark:border-slate-700 dark:bg-slate-950"
              aria-label={t('Filter berdasarkan role', 'Filter by role')}
            >
              <option value="ALL">{t('Semua Role', 'All Roles')}</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {localizeAccountRole(r.value, lang)}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium input-theme-focus dark:border-slate-700 dark:bg-slate-950"
              aria-label={t('Filter berdasarkan status', 'Filter by status')}
            >
              <option value="ALL">{t('Semua Status', 'All Statuses')}</option>
              <option value="ACTIVE">{t('Aktif', 'Active')}</option>
              <option value="INACTIVE">{t('Nonaktif', 'Inactive')}</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-200">
            {t('Memuat daftar akun pengguna...', 'Loading user accounts...')}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t('Tidak ada akun yang cocok dengan filter pencarian.', 'No accounts match the current search filter.')}
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-3.5 py-2 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('Tambah Akun Baru', 'Add New Account')}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
                <tr>
                  <th className="px-4 py-3">{t('Pengguna', 'User')}</th>
                  <th className="px-4 py-3">{t('Role & Hak Akses', 'Role & Access')}</th>
                  <th className="px-4 py-3">{t('Departemen / Seksi', 'Department / Section')}</th>
                  <th className="px-4 py-3">{t('Kontak & Login Terakhir', 'Contact & Last Sign-In')}</th>
                  <th className="px-4 py-3">{t('Status', 'Status')}</th>
                  <th className="px-4 py-3 text-right">{t('Aksi', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredUsers.map((account) => {
                  const isSelf = account.username === currentUser.username;
                  const isPrimaryAdmin = account.username === 'hr.mojokerto' || account.uid === 'local-hr-mojokerto';
                  return (
                    <tr
                      key={account.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3 min-w-[180px]">
                          <img
                            src={account.avatarUrl || '/assets/images/avatar_hr_admin_1794535891951.jpg'}
                            alt={account.namaTampilan}
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.currentTarget.src = '/assets/images/avatar_hr_admin_1794535891951.jpg';
                            }}
                            className="h-9 w-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                              <span className="truncate">{account.namaTampilan}</span>
                              {isSelf && (
                                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                                  {t('Anda', 'You')}
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-200 truncate">
                              @{account.username} · {account.authProvider === 'firebase_google' ? 'Google SSO' : 'Password'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold whitespace-nowrap ${getRoleBadge(
                            account.role
                          )}`}
                        >
                          {localizeAccountRole(account.role, lang)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800 dark:text-slate-200 min-w-[160px]">
                          {account.departemen}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-slate-700 dark:text-slate-300">{account.email}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-200">
                          {account.noTelepon ? `${account.noTelepon} · ` : ''}
                          {formatTimestamp(account.lastLoginAt)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          disabled={isSelf || isPrimaryAdmin || togglingId === account.id}
                          onClick={() => handleToggleActive(account)}
                          title={
                            isSelf || isPrimaryAdmin
                              ? t('Akun utama / sesi aktif tidak dapat dinonaktifkan', 'Primary / current session account cannot be deactivated')
                              : t('Klik untuk ubah status aktif/nonaktif', 'Click to toggle active/inactive status')
                          }
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                            account.isActive
                              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60 dark:hover:bg-emerald-900/60'
                              : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              account.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                            }`}
                          />
                          {account.isActive ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')}
                        </button>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(account)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3 w-3" />
                            {t('Edit', 'Edit')}
                          </button>
                          <button
                            type="button"
                            disabled={isSelf || isPrimaryAdmin}
                            onClick={() => setDeleteTarget(account)}
                            title={
                              isSelf || isPrimaryAdmin
                                ? t('Akun ini dilindungi dari penghapusan', 'This account is protected from deletion')
                                : t('Hapus akun', 'Delete account')
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70"
                          >
                            <Trash2 className="h-3 w-3" />
                            {t('Hapus', 'Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Access Matrix + Recent User Audit Trail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 surface-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-theme-accent" />
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('Matriks Peran & Hak Akses Akun', 'Account Role & Permission Matrix')}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROLE_OPTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.value}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50 space-y-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${item.badgeClass}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {localizeAccountRole(item.value, lang)}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-200">
                    {t(item.descId, item.descEn)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 surface-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-theme-accent" />
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('Log Audit Manajemen Akun', 'Account Management Audit Trail')}
            </h3>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {auditLogs.length === 0 ? (
              <div className="py-4 text-slate-500 dark:text-slate-200">
                {t('Belum ada aktivitas perubahan akun.', 'No account change activity recorded yet.')}
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                      @{log.targetUsername}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 dark:text-slate-300">
                      {formatTimestamp(log.createdAt)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-200 break-words">
                    {log.changedFields}
                    {log.passwordChanged ? ` · ${t('Password diperbarui', 'Password updated')}` : ''}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-300">
                    {t('Oleh:', 'By:')} <span className="font-mono">{log.changedBy}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create / Edit Account Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-3 sm:p-4 overflow-y-auto">
          <div className="surface-card w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-theme-header px-5 py-4 backdrop-blur-md dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg icon-theme-plinth">
                  {editingUser ? <Pencil className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                    {editingUser
                      ? t(`Edit Akun @${editingUser.username}`, `Edit Account @${editingUser.username}`)
                      : t(
                          'Buat Akun Baru (Admin / Pimpinan Perusahaan / Dept. / Seksi)',
                          'Create New Account (Admin / Company / Dept. / Section Leader)'
                        )}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-200">
                    {t(
                      'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory',
                      'PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory'
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-200">
                  {formError}
                </div>
              )}

              {/* Step 1: Role Selection Cards */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  {t('1. Pilih Kategori / Role Akun', '1. Select Account Role / Category')} *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ROLE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = form.role === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleSelectRole(option.value)}
                        className={`rounded-xl border p-3 text-left transition-all ${
                          selected
                            ? 'border-theme-accent bg-theme-soft shadow-2xs'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                            <Icon className="h-4 w-4 text-theme-accent shrink-0" />
                            {localizeAccountRole(option.value, lang)}
                          </span>
                          {selected && <Check className="h-4 w-4 text-theme-accent shrink-0" />}
                        </div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-200">
                          {t(option.descId, option.descEn)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Identity & Department / Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('Nama Lengkap / Tampilan', 'Full / Display Name')} *
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={80}
                    value={form.namaTampilan}
                    onChange={(e) => {
                      const val = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        namaTampilan: val,
                        username: !editingUser && !usernameTouched ? suggestUsername(val) : prev.username,
                      }));
                    }}
                    placeholder={t('Contoh: Ir. Budi Santoso', 'e.g., Budi Santoso')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('Username Login', 'Login Username')} *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingUser)}
                    value={form.username}
                    onChange={(e) => {
                      setUsernameTouched(true);
                      setForm((prev) => ({
                        ...prev,
                        username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''),
                      }));
                    }}
                    placeholder="budi.santoso"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono input-theme-focus disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t('Departemen / Seksi / Unit Kerja', 'Department / Section / Unit')} *
                    </label>
                    <button
                      type="button"
                      onClick={() => setCustomDeptMode((v) => !v)}
                      className="text-[11px] font-semibold text-theme-accent hover:underline"
                    >
                      {customDeptMode
                        ? t('Pilih dari Daftar Standar', 'Choose from Standard List')
                        : t('+ Ketik Manual Dept./Seksi', '+ Type Custom Dept./Section')}
                    </button>
                  </div>
                  {customDeptMode ? (
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={80}
                      value={form.departemen}
                      onChange={(e) => setForm((prev) => ({ ...prev, departemen: e.target.value }))}
                      placeholder={t(
                        'Contoh: Seksi Packaging Line 2 / Departemen Produksi MSG',
                        'e.g., Packaging Line 2 Section / MSG Production Dept.'
                      )}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                    />
                  ) : (
                    <select
                      value={DEPARTMENT_PRESETS.includes(form.departemen) ? form.departemen : DEPARTMENT_PRESETS[0]}
                      onChange={(e) => setForm((prev) => ({ ...prev, departemen: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                    >
                      {DEPARTMENT_PRESETS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('Email Korporat', 'Corporate Email')} *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="nama@ajinomoto.co.id"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('No. Telepon / Ext. (Opsional)', 'Phone / Ext. (Optional)')}
                  </label>
                  <input
                    type="text"
                    maxLength={30}
                    value={form.noTelepon}
                    onChange={(e) => setForm((prev) => ({ ...prev, noTelepon: e.target.value }))}
                    placeholder="+62 321-361-000 ext. 214"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
              </div>

              {/* Step 3: Password & Status */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <KeyRound className="h-3.5 w-3.5 text-theme-accent" />
                    {editingUser
                      ? t('Reset Password (Opsional — kosongkan jika tidak diubah)', 'Reset Password (Optional — leave blank to keep current)')
                      : t('Password Awal Akun (Min. 8 Karakter)', 'Initial Account Password (Min. 8 Characters)') + ' *'}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, password: generateSecurePassword(12) }));
                      setShowPassword(true);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-theme-accent hover:underline"
                  >
                    <Sparkles className="h-3 w-3" />
                    {t('Generate Password Aman', 'Generate Strong Password')}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    minLength={editingUser ? undefined : 8}
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={
                      editingUser
                        ? t('Masukkan password baru minimal 8 karakter...', 'Enter new password (min. 8 characters)...')
                        : t('Minimal 8 karakter kombinasi huruf & angka', 'At least 8 characters with letters & numbers')
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white pl-3 pr-10 py-2 text-xs font-mono input-theme-focus dark:border-slate-700 dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={showPassword ? t('Sembunyikan password', 'Hide password') : t('Tampilkan password', 'Show password')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <label className="flex items-center gap-2.5 pt-1 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded accent-theme"
                  />
                  <span>
                    {t(
                      'Aktifkan akun segera (dapat langsung login pada halaman Login Admin / Pimpinan)',
                      'Activate account immediately (can sign in right away on the Admin / Leadership login page)'
                    )}
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {t('Batal', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg btn-theme-primary px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {saving
                    ? t('Menyimpan...', 'Saving...')
                    : editingUser
                      ? t('Simpan Perubahan', 'Save Changes')
                      : t('Buat Akun Sekarang', 'Create Account Now')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center modal-backdrop p-4">
          <div className="surface-card w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  {t('Hapus Akun Pengguna?', 'Delete User Account?')}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-200">
                  {t(
                    `Akun "${deleteTarget.namaTampilan}" (@${deleteTarget.username} — ${deleteTarget.role}) akan dihapus secara permanen dan tidak lagi dapat mengakses sistem.`,
                    `Account "${deleteTarget.namaTampilan}" (@${deleteTarget.username} — ${localizeAccountRole(deleteTarget.role, lang)}) will be permanently removed and will lose system access.`
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {t('Batal', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t('Menghapus...', 'Deleting...') : t('Ya, Hapus Akun', 'Yes, Delete Account')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
