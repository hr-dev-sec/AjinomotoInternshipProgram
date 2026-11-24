import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock,
  Compass,
  Factory,
  FileCheck2,
  FileClock,
  Filter,
  Globe2,
  GraduationCap,
  Leaf,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  Radar,
  ShieldCheck,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useAppPreferences } from '../contexts/AppPreferencesContext';
import { localizeStatus } from '../lib/localizeData';

export const EcosystemFlowInfographic: React.FC<{
  universities: number;
  divisiOpen: number;
  activeInterns: number;
  pksAktif: number;
}> = ({ universities, divisiOpen, activeInterns, pksAktif }) => {
  const { theme, t } = useAppPreferences();

  const nodes = [
    {
      step: t('Tahap 01', 'Stage 01'),
      title: t('Kemitraan Kampus', 'Campus Partnership'),
      metric: t(`${pksAktif} PKS Aktif`, `${pksAktif} Active MoAs`),
      sub: t(
        `${universities} universitas mitra terhubung`,
        `${universities} connected partner universities`
      ),
      icon: GraduationCap,
      accent: 'text-slate-900 bg-slate-100 dark:text-slate-100 dark:bg-slate-800',
    },
    {
      step: t('Tahap 02', 'Stage 02'),
      title: t('Seleksi & Screening', 'Selection & Screening'),
      metric: t(`${divisiOpen} Divisi Open`, `${divisiOpen} Open Divisions`),
      sub: t('Kurasi kompetensi MBKM & PKL', 'MBKM & PKL competency curation'),
      icon: FileCheck2,
      accent: 'icon-theme-plinth',
    },
    {
      step: t('Tahap 03', 'Stage 03'),
      title: t('Operasional Pabrik', 'Factory Operations'),
      metric: t(`${activeInterns} Peserta Aktif`, `${activeInterns} Active Interns`),
      sub: t('Presensi selfie & geofence 650 m', 'Selfie & 650 m geofence attendance'),
      icon: Factory,
      accent: 'text-slate-900 bg-slate-100 dark:text-slate-100 dark:bg-slate-800',
    },
    {
      step: t('Tahap 04', 'Stage 04'),
      title: t('Evaluasi & Talent Pool', 'Evaluation & Talent Pool'),
      metric: t('4 Pilar Skor', '4-Pillar Score'),
      sub: t('BK · PS · TW · IS terstandar', 'Standardized BK · PS · TW · IS'),
      icon: Award,
      accent: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/50',
    },
  ];

  return (
    <div className="surface-card p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
            <Workflow className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-theme-accent">
              {t('Infografik Siklus Program', 'Program Lifecycle Infographic')}
            </p>
            <h3 className="mt-0.5 font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {t(
                'Ekosistem Talenta Magang PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory',
                'Internship Talent Ecosystem — PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory'
              )}
            </h3>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-200">
          {t(
            'Terintegrasi dari kemitraan universitas hingga pemetaan talent industri',
            'Integrated from university partnerships to industrial talent pool mapping'
          )}
        </p>
      </div>

      <div className="relative mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
        {/* Desktop horizontal connector SVG behind cards */}
        <svg
          className="hidden lg:block absolute top-11 left-[12%] w-[76%] h-6 pointer-events-none"
          viewBox="0 0 600 24"
          preserveAspectRatio="none"
        >
          <line
            x1="0"
            y1="12"
            x2="590"
            y2="12"
            stroke={theme.isDark ? '#334155' : '#CBD5E1'}
            strokeWidth="2"
            strokeDasharray="6 6"
          />
          <polygon points="590,7 600,12 590,17" fill={theme.accentHex} />
        </svg>

        {nodes.map((node) => {
          const Icon = node.icon;
          return (
            <div
              key={node.step}
              className="kpi-tile relative z-10 flex flex-col justify-between p-5"
            >
              <Icon
                className="pointer-events-none absolute -right-2.5 -bottom-2.5 h-20 w-20 text-slate-900/[0.035] dark:text-white/[0.04]"
                strokeWidth={1.4}
                aria-hidden="true"
              />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset ring-slate-900/5 dark:ring-white/10 ${node.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-slate-400 dark:text-slate-300">{node.step}</span>
                </div>
                <h4 className="mt-4 font-display text-sm font-bold text-slate-900 dark:text-slate-100">{node.title}</h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-200 leading-relaxed">{node.sub}</p>
              </div>
              <div className="relative z-10 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-mono font-bold tabular-nums text-theme-accent">
                <span>{node.metric}</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-80 shrink-0" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const MojokertoGlobalMapInfographic: React.FC = () => {
  const { theme, t } = useAppPreferences();

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-theme-showcase text-white shadow-[0_24px_48px_-24px_rgba(15,23,42,0.55)]">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-lg bg-white px-2.5 py-1.5 shadow-xs">
                <img
                  src="/assets/aistudio/Logo_Ajinomoto_641a64fc.png"
                  alt="Logo PT Ajinomoto Indonesia"
                  referrerPolicy="no-referrer"
                  className="h-7 w-auto object-contain"
                />
              </div>
              <img
                src="/assets/aistudio/logo_ajiu_crisp.png"
                alt="Logo Ajinomoto Indonesia University (AJIU)"
                referrerPolicy="no-referrer"
                className="h-12 w-12 object-contain shrink-0 drop-shadow-[0_2px_10px_rgba(251,191,36,0.2)]"
              />
              <div className="rounded-lg bg-white p-1.5 shadow-xs">
                <img
                  src="/assets/aistudio/HSE_8e0164a8.png"
                  alt="Logo Safety First"
                  referrerPolicy="no-referrer"
                  className="h-7 w-auto object-contain"
                />
              </div>
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: theme.accentLightHex }}>
              <Globe2 className="h-4 w-4 shrink-0" />
              <span>PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory</span>
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-balance">
              {t(
                'Dari Jawa Timur Menuju Standar Mutu Dunia',
                'From East Java to Global Quality Standards'
              )}
            </h3>
            <p className="text-xs leading-relaxed text-slate-100/95">
              {t(
                'Beroperasi di Jl. Raya Mlirip, Kec. Jetis, Kab. Mojokerto, kompleks PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory memproduksi produk bumbu masak dan bioteknologi berbasis AminoScience yang terhubung dengan jaringan Ajinomoto Group di lebih dari 36 negara.',
                'Operating on Jl. Raya Mlirip, Jetis District, Mojokerto Regency, the PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory complex manufactures seasoning and AminoScience-based biotechnology products connected to the Ajinomoto Group network across more than 36 countries.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-4 border-t border-white/15">
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3 flex items-start gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-100 shrink-0">
                <Globe2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-lg font-bold font-mono tabular-nums text-white">
                  {t('36 Negara', '36 Countries')}
                </div>
                <div className="text-[11px] text-slate-200">
                  {t('Operasional Grup Global', 'Global Group Operations')}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3 flex items-start gap-2.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: `${theme.accentHex}29`, color: theme.accentLightHex }}
              >
                <Factory className="h-4 w-4" />
              </div>
              <div>
                <div className="text-lg font-bold font-mono tabular-nums" style={{ color: theme.accentLightHex }}>
                  1970
                </div>
                <div className="text-[11px] text-slate-200">
                  {t('Berdiri Pabrik Mojokerto', 'Mojokerto Factory Est.')}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3 flex items-start gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-100 shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="text-lg font-bold font-mono tabular-nums text-white">ISO 22000</div>
                <div className="text-[11px] text-slate-200">
                  {t('Keamanan Pangan & Halal', 'Food Safety & Halal')}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-white/15 bg-white/[0.06] p-3 flex items-start gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-950/80 text-emerald-300 shrink-0">
                <Leaf className="h-4 w-4" />
              </div>
              <div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-300">Eco-Factory</div>
                <div className="text-[11px] text-slate-200">
                  {t('Pengelolaan IPAL Terpadu', 'Integrated WWTP Eco-System')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stylized Vector Global Hub Schematic */}
        <div className="lg:col-span-7 relative bg-slate-950/45 p-6 flex items-center justify-center min-h-[280px] border-t lg:border-t-0 lg:border-l border-white/10">
          <svg
            viewBox="0 0 640 320"
            className="w-full h-full max-h-72"
            aria-label={t(
              'Peta skematik jaringan global Ajinomoto menuju Mojokerto',
              'Schematic global Ajinomoto network map to Mojokerto'
            )}
          >
            <defs>
              <pattern id="grid-map" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="640" height="320" fill="url(#grid-map)" />

            {/* Stylized Continents Silhouettes */}
            <g fill="rgba(148,163,184,0.16)" stroke="rgba(148,163,184,0.25)" strokeWidth="1">
              <path d="M70,55 L145,50 L165,95 L125,135 L155,180 L135,260 L105,255 L95,185 L65,130 Z" />
              <path d="M270,55 L345,50 L360,95 L335,120 L365,175 L335,250 L295,240 L280,170 L255,115 Z" />
              <path d="M355,48 L525,45 L555,105 L515,155 L465,175 L415,155 L370,120 Z" />
              <path
                d="M435,195 L475,202 L515,206 L530,218 L485,222 L440,212 Z"
                fill={`${theme.accentHex}55`}
                stroke={theme.accentLightHex}
              />
              <path d="M485,240 L555,238 L565,280 L515,290 L482,272 Z" />
            </g>

            {/* Connecting Arcs to Mojokerto Hub (472, 212) */}
            <g fill="none" stroke={theme.accentLightHex} strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="4 4">
              <path d="M532,96 Q525,150 472,212" />
              <path d="M446,146 Q455,180 472,212" />
              <path d="M312,78 Q400,115 472,212" />
              <path d="M122,98 Q305,70 472,212" />
            </g>

            {/* Global Nodes */}
            {[
              { x: 532, y: 96, label: 'Tokyo HQ' },
              { x: 446, y: 146, label: 'ASEAN Hub' },
              { x: 312, y: 78, label: 'Europe' },
              { x: 122, y: 98, label: 'Americas' },
            ].map((n) => (
              <g key={n.label}>
                <circle cx={n.x} cy={n.y} r="4" fill="#94A3B8" />
                <text x={n.x + 8} y={n.y + 3} fill="#CBD5E1" fontSize="10" fontFamily="monospace">
                  {n.label}
                </text>
              </g>
            ))}

            {/* Mojokerto Center Hub */}
            <circle cx="472" cy="212" r="18" fill={`${theme.accentHex}38`} />
            <circle cx="472" cy="212" r="8" fill={theme.accentHex} stroke="#FFFFFF" strokeWidth="2" />
            <rect x="294" y="232" width="236" height="28" rx="6" fill="#0F172A" stroke={theme.accentHex} strokeWidth="1" />
            <text x="412" y="250" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontWeight="700" fontFamily="sans-serif">
              Ajinomoto · Ajinex · Mojokerto Factory
            </text>
          </svg>
        </div>
      </div>
    </div>
  );
};

export const GeofenceRadarInfographic: React.FC<{
  coords: string;
  jarakMeter: number | null;
  maxRadiusMeters?: number;
}> = ({ coords, jarakMeter, maxRadiusMeters = 650 }) => {
  const { theme, t } = useAppPreferences();
  const withinRadius = jarakMeter !== null && jarakMeter <= maxRadiusMeters;
  const plotRadius =
    jarakMeter === null ? 0 : Math.min(86, Math.max(8, Math.round((jarakMeter / maxRadiusMeters) * 58)));

  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth">
            <Radar className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {t('Radar Geofence Pabrik', 'Factory Geofence Radar')}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-200">
              {t(`Radius valid presensi: ${maxRadiusMeters} m`, `Valid attendance radius: ${maxRadiusMeters} m`)}
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <Navigation className="h-3 w-3 text-theme-accent shrink-0" />
          {jarakMeter !== null ? `${jarakMeter} m` : t('Menunggu GPS', 'Waiting GPS')}
        </span>
      </div>

      <div className="flex items-center justify-center py-2">
        <svg viewBox="0 0 220 220" className="w-48 h-48">
          <circle
            cx="110"
            cy="110"
            r="92"
            fill={theme.isDark ? '#0B1220' : '#F8FAFC'}
            stroke={theme.isDark ? '#1E293B' : '#E2E8F0'}
            strokeWidth="1"
          />
          <circle
            cx="110"
            cy="110"
            r="58"
            fill="rgba(22, 163, 74, 0.08)"
            stroke="#16A34A"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <circle cx="110" cy="110" r="28" fill="none" stroke={theme.isDark ? '#1E293B' : '#E2E8F0'} strokeWidth="1" />
          <line x1="18" y1="110" x2="202" y2="110" stroke={theme.isDark ? '#1E293B' : '#E2E8F0'} strokeWidth="1" />
          <line x1="110" y1="18" x2="110" y2="202" stroke={theme.isDark ? '#1E293B' : '#E2E8F0'} strokeWidth="1" />

          {/* Factory Pin Center */}
          <circle cx="110" cy="110" r="6" fill={theme.accentHex} />
          <text
            x="110"
            y="126"
            textAnchor="middle"
            fill={theme.isDark ? '#E2E8F0' : '#0F172A'}
            fontSize="9"
            fontWeight="700"
          >
            Mojokerto Factory
          </text>
          <text
            x="110"
            y="47"
            textAnchor="middle"
            fill={theme.isDark ? '#4ADE80' : '#15803D'}
            fontSize="8.5"
            fontFamily="monospace"
          >
            {t(`Batas ${maxRadiusMeters} m`, `Limit ${maxRadiusMeters} m`)}
          </text>

          {/* Plotted User Pin */}
          {jarakMeter !== null && (
            <g>
              <line
                x1="110"
                y1="110"
                x2={110 + plotRadius * 0.72}
                y2={110 - plotRadius * 0.68}
                stroke={withinRadius ? '#16A34A' : '#D97706'}
                strokeWidth="1.5"
              />
              <circle
                cx={110 + plotRadius * 0.72}
                cy={110 - plotRadius * 0.68}
                r="6"
                fill={withinRadius ? '#16A34A' : '#D97706'}
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      <div className="surface-inset p-3 text-[11px] space-y-1.5">
        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5 text-theme-accent" />
            {t('Koordinat Referensi', 'Reference Coordinates')}
          </span>
          <span className="font-mono">-7.45890, 112.46310</span>
        </div>
        <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            {jarakMeter === null ? (
              <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
            ) : withinRadius ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
            )}
            {t('Status Posisi Anda', 'Your Position Status')}
          </span>
          <span
            className={`font-semibold ${
              jarakMeter === null
                ? 'text-slate-500 dark:text-slate-200'
                : withinRadius
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
            }`}
          >
            {jarakMeter === null
              ? t('Belum Terdeteksi', 'Not Detected')
              : withinRadius
                ? t('Dalam Radius Pabrik', 'Inside Factory Radius')
                : t(`Di Luar Radius (>${maxRadiusMeters} m)`, `Outside Radius (>${maxRadiusMeters} m)`)}
          </span>
        </div>
        {coords && (
          <div className="inline-flex items-center gap-1 font-mono text-[10px] text-slate-400 dark:text-slate-300 pt-0.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>GPS: {coords}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const KpiSparkline: React.FC<{
  values: number[];
  color?: string;
}> = ({ values, color }) => {
  const { theme } = useAppPreferences();
  const strokeColor = color || theme.accentHex;
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const width = 96;
  const height = 28;
  const pts = values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-24 h-7 overflow-visible" aria-hidden="true">
      <polyline fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
};

export const AttendanceCompositionBar: React.FC<{
  pulang: number;
  masuk: number;
  izin: number;
  belumAbsen: number;
  total: number;
}> = ({ pulang, masuk, izin, belumAbsen, total }) => {
  const { t } = useAppPreferences();
  const safeTotal = Math.max(1, total);
  const pPulang = (pulang / safeTotal) * 100;
  const pMasuk = (masuk / safeTotal) * 100;
  const pIzin = (izin / safeTotal) * 100;
  const pBelum = (belumAbsen / safeTotal) * 100;

  return (
    <div className="space-y-2.5">
      <div className="flex h-3 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
        {pulang > 0 && (
          <div style={{ width: `${pPulang}%` }} className="bg-emerald-600" title={`${t('Pulang', 'Check-Out')}: ${pulang}`} />
        )}
        {masuk > 0 && (
          <div style={{ width: `${pMasuk}%` }} className="bg-theme-accent" title={`${t('Masuk', 'Check-In')}: ${masuk}`} />
        )}
        {izin > 0 && (
          <div style={{ width: `${pIzin}%` }} className="bg-amber-500" title={`${t('Izin', 'Leave')}: ${izin}`} />
        )}
        {belumAbsen > 0 && (
          <div
            style={{ width: `${pBelum}%` }}
            className="bg-slate-300 dark:bg-slate-700"
            title={`${t('Belum Absen', 'Absent')}: ${belumAbsen}`}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-slate-600 dark:text-slate-200">
        <span className="inline-flex items-center gap-1.5">
          <LogOut className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
          {t('Pulang', 'Check-Out')}: <strong className="font-mono text-slate-900 dark:text-slate-100">{pulang}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <LogIn className="h-3.5 w-3.5 text-theme-accent" />
          {t('Masuk', 'Check-In')}: <strong className="font-mono text-slate-900 dark:text-slate-100">{masuk}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <FileClock className="h-3.5 w-3.5 text-amber-500" />
          {t('Izin', 'Leave')}: <strong className="font-mono text-slate-900 dark:text-slate-100">{izin}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-300" />
          {t('Belum Absen', 'Absent')}: <strong className="font-mono text-slate-900 dark:text-slate-100">{belumAbsen}</strong>
        </span>
      </div>
    </div>
  );
};

export interface CohortPin {
  nim: string;
  nama: string;
  statusFinal: string;
  jarakMeter?: number;
  lokasi?: string;
  anomaliFlag?: string;
}

export const GeofenceCohortRadar: React.FC<{
  records: CohortPin[];
  maxRadiusMeters: number;
  onSelectRecord: (pin: CohortPin) => void;
}> = ({ records, maxRadiusMeters, onSelectRecord }) => {
  const { theme, lang, t } = useAppPreferences();
  const located = records.filter((r) => typeof r.jarakMeter === 'number' && r.lokasi);
  const insideCount = located.filter((r) => (r.jarakMeter ?? 0) <= maxRadiusMeters && !r.anomaliFlag).length;
  const outsideCount = located.length - insideCount;

  return (
    <div className="surface-card p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth">
            <Radar className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t(
                `Peta Sebaran Geofence Harian (${maxRadiusMeters} m)`,
                `Daily Geofence Distribution Map (${maxRadiusMeters} m)`
              )}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-200">
              {t(
                'Klik titik peserta pada radar untuk melihat detail bukti & jarak GPS',
                'Click an intern pin on the radar to inspect proof details & GPS distance'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {insideCount} {t('Dalam Radius', 'Inside Radius')}
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-300 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {outsideCount} {t('Luar Radius / Izin', 'Outside / Leave')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        <div className="md:col-span-5 flex justify-center">
          <svg viewBox="0 0 240 240" className="w-52 h-52">
            <circle cx="120" cy="120" r="106" className="fill-slate-50 stroke-slate-200 dark:fill-slate-950 dark:stroke-slate-800" strokeWidth="1" />
            <circle
              cx="120"
              cy="120"
              r="68"
              fill="rgba(22, 163, 74, 0.08)"
              stroke="#16A34A"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <circle cx="120" cy="120" r="34" fill="none" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
            <line x1="14" y1="120" x2="226" y2="120" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
            <line x1="120" y1="14" x2="120" y2="226" className="stroke-slate-200 dark:stroke-slate-800" strokeWidth="1" />
            <circle cx="120" cy="120" r="5" fill={theme.accentHex} />
            <text x="120" y="45" textAnchor="middle" fill={theme.isDark ? '#4ADE80' : '#15803D'} fontSize="8.5" fontFamily="monospace">
              Perimeter {maxRadiusMeters} m
            </text>

            {located.map((pin, idx) => {
              const dist = pin.jarakMeter ?? 0;
              const isAlert = Boolean(pin.anomaliFlag) || dist > maxRadiusMeters;
              const ratio = Math.min(1.45, Math.max(0.14, dist / Math.max(1, maxRadiusMeters)));
              const rPx = ratio * 68;
              const angle = ((idx * 137.5) % 360) * (Math.PI / 180);
              const cx = 120 + Math.cos(angle) * rPx;
              const cy = 120 + Math.sin(angle) * rPx;
              const initials = pin.nama
                .split(' ')
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase();
              const statusLabel = localizeStatus(pin.statusFinal, lang);
              return (
                <g
                  key={pin.nim}
                  onClick={() => onSelectRecord(pin)}
                  className="cursor-pointer"
                >
                  <title>{`${pin.nama} · ${dist} m (${statusLabel})`}</title>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="10"
                    fill={isAlert ? '#D97706' : '#16A34A'}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <text
                    x={cx}
                    y={cy + 3}
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="7"
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {initials}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="md:col-span-7 divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto text-xs">
          {located.length === 0 ? (
            <div className="py-8 text-center text-slate-500 dark:text-slate-200">
              {t('Belum ada titik GPS presensi pada tanggal ini.', 'No attendance GPS points recorded for this date.')}
            </div>
          ) : (
            located.map((pin) => {
              const isAlert = Boolean(pin.anomaliFlag) || (pin.jarakMeter ?? 0) > maxRadiusMeters;
              return (
                <button
                  key={pin.nim}
                  type="button"
                  onClick={() => onSelectRecord(pin)}
                  className="w-full py-2.5 px-2 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{pin.nama}</div>
                    <div className="font-mono text-[10px] text-slate-500 dark:text-slate-200 truncate">{pin.lokasi}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={`font-mono font-bold tabular-nums ${isAlert ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                      {pin.jarakMeter} m
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-200">{localizeStatus(pin.statusFinal, lang)}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export const DepartmentCapacityChart: React.FC<{
  data: Array<{
    department: string;
    aktifCount: number;
    mbkmCount: number;
    pklCount: number;
    avgSkor: number;
  }>;
}> = ({ data }) => {
  const { t } = useAppPreferences();

  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-200">
        {t('Belum ada distribusi departemen aktif.', 'No active department distribution yet.')}
      </div>
    );
  }
  const maxCount = Math.max(...data.map((d) => d.aktifCount), 1);

  return (
    <div className="space-y-3.5">
      {data.map((d) => {
        const totalPct = Math.round((d.aktifCount / maxCount) * 100);
        const mbkmRatio = d.aktifCount > 0 ? Math.round((d.mbkmCount / d.aktifCount) * 100) : 0;
        return (
          <div key={d.department} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 truncate">
                <Building2 className="h-3.5 w-3.5 text-theme-accent shrink-0" />
                <span className="truncate">{d.department}</span>
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-200 shrink-0">
                <strong className="text-slate-900 dark:text-slate-100">{d.aktifCount}</strong>{' '}
                {t('aktif', 'active')} ({d.mbkmCount} MBKM / {d.pklCount} PKL)
                {d.avgSkor > 0 ? ` · ${t('Skor', 'Score')} ${d.avgSkor}` : ''}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full flex" style={{ width: `${totalPct}%` }}>
                <div style={{ width: `${mbkmRatio}%` }} className="bg-theme-accent h-full" />
                <div style={{ width: `${100 - mbkmRatio}%` }} className="bg-slate-700 dark:bg-slate-400 h-full" />
              </div>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-200">
        <span className="inline-flex items-center gap-1.5">
          <GraduationCap className="h-3.5 w-3.5 text-theme-accent" />
          MBKM
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-slate-700 dark:text-slate-300" />
          {t('PKL Mandiri', 'Independent PKL')}
        </span>
      </div>
    </div>
  );
};

export const RecruitmentFunnelBar: React.FC<{
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
}> = ({ total, pending, accepted, rejected }) => {
  const { t } = useAppPreferences();
  const safeTotal = Math.max(1, total);
  const acceptRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  return (
    <div className="surface-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl icon-theme-plinth shrink-0">
            <Filter className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {t('Pipeline Seleksi Pelamar', 'Applicant Selection Pipeline')}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-200">
              {t('Rasio penerimaan saat ini:', 'Current acceptance rate:')}{' '}
              <strong className="font-mono text-emerald-600 dark:text-emerald-300">{acceptRate}%</strong>{' '}
              {t(`dari total ${total} pendaftar`, `out of ${total} total applicants`)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-300 font-semibold">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {t('Pending', 'Pending')}: {pending}
          </span>
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-300 font-semibold">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {t('Diterima', 'Accepted')}: {accepted}
          </span>
          <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-300 font-semibold">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            {t('Ditolak', 'Rejected')}: {rejected}
          </span>
        </div>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-sm bg-slate-100 dark:bg-slate-800">
        {accepted > 0 && <div style={{ width: `${(accepted / safeTotal) * 100}%` }} className="bg-emerald-600" />}
        {pending > 0 && <div style={{ width: `${(pending / safeTotal) * 100}%` }} className="bg-amber-500" />}
        {rejected > 0 && <div style={{ width: `${(rejected / safeTotal) * 100}%` }} className="bg-red-600" />}
      </div>
    </div>
  );
};
