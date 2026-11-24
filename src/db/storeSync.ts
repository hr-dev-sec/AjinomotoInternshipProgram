import { desc, eq } from 'drizzle-orm';
import { db } from './index.js';
import { ensureMediaAssetsSeeded } from './media.js';
import {
  absensi,
  aiAuditLogs,
  emailLogs,
  evaluasi,
  lowongan,
  mahasiswa,
  pendaftaran,
  systemSettings,
  universitasPks,
} from './schema.js';
import { getOrCreateUser } from './users.js';
import type { DatabaseSchema } from '../../server/store.js';
import { ADMIN_PASSWORD_HASH, ADMIN_USERNAME } from '../middleware/auth.js';

const SETTINGS_KEY = 'default';

export async function ensureAdminUserSeeded(data: DatabaseSchema): Promise<void> {
  try {
    const adminProfile = data.adminProfile;
    await getOrCreateUser(
      'local-hr-mojokerto',
      adminProfile?.email || 'hr.development@ajinomoto.co.id',
      adminProfile?.namaTampilan || 'Rina Kusuma',
      adminProfile?.avatarUrl || '/assets/images/avatar_hr_admin_1794535891951.jpg',
      'password',
      adminProfile?.username || ADMIN_USERNAME,
      adminProfile?.passwordHash || ADMIN_PASSWORD_HASH
    );
  } catch (error) {
    console.error('Database query failed in ensureAdminUserSeeded:', error);
    throw new Error('Gagal melakukan inisialisasi akun admin pada database.', { cause: error });
  }
}

export async function syncDatabaseToPostgres(
  data: DatabaseSchema,
  options: { replaceAll?: boolean } = {}
): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      if (options.replaceAll) {
        await tx.delete(absensi);
        await tx.delete(evaluasi);
        await tx.delete(pendaftaran);
        await tx.delete(mahasiswa);
        await tx.delete(lowongan);
        await tx.delete(universitasPks);
        await tx.delete(aiAuditLogs);
        await tx.delete(emailLogs);
      }

      // 1. lowongan
      for (const l of data.lowongan) {
        await tx
          .insert(lowongan)
          .values({
            id: l.id,
            namaPosisi: l.namaPosisi,
            pendidikan: l.pendidikan,
            prodi: l.prodi,
            skill: l.skill || '',
            tugas: l.tugas || '',
            benefit: l.benefit || '',
            status: l.status || 'Open',
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: lowongan.id,
            set: {
              namaPosisi: l.namaPosisi,
              pendidikan: l.pendidikan,
              prodi: l.prodi,
              skill: l.skill || '',
              tugas: l.tugas || '',
              benefit: l.benefit || '',
              status: l.status || 'Open',
              updatedAt: new Date(),
            },
          });
      }

      // 2. mahasiswa
      const validNims = new Set<string>();
      for (const m of data.mahasiswa) {
        validNims.add(m.nim);
        await tx
          .insert(mahasiswa)
          .values({
            nim: m.nim,
            program: m.program,
            department: m.department,
            nama: m.nama,
            universitas: m.universitas,
            jurusan: m.jurusan,
            tglMasuk: m.tglMasuk,
            tanggalBerakhir: m.tanggalBerakhir,
            gender: m.gender,
            status: m.status,
            talent: m.talent,
            skor: m.skor || 0,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: mahasiswa.nim,
            set: {
              program: m.program,
              department: m.department,
              nama: m.nama,
              universitas: m.universitas,
              jurusan: m.jurusan,
              tglMasuk: m.tglMasuk,
              tanggalBerakhir: m.tanggalBerakhir,
              gender: m.gender,
              status: m.status,
              talent: m.talent,
              skor: m.skor || 0,
              updatedAt: new Date(),
            },
          });
      }

      // 3. pendaftaran
      const lowonganByName = new Map(data.lowongan.map((l) => [l.namaPosisi, l.id]));
      for (const p of data.pendaftaran) {
        const matchedLowonganId = lowonganByName.get(p.lowongan) ?? null;
        await tx
          .insert(pendaftaran)
          .values({
            id: p.id,
            timestamp: p.timestamp,
            jenis: p.jenis,
            nama: p.nama,
            nim: p.nim,
            universitas: p.universitas,
            jurusan: p.jurusan,
            lowonganId: matchedLowonganId,
            lowongan: p.lowongan,
            linkCv: p.linkCv || '-',
            cvFileName: p.cvFileName ?? null,
            cvBase64: p.cvBase64 ?? null,
            cvSummaryText: p.cvSummaryText ?? null,
            status: p.status || 'Pending',
            email: p.email,
            persetujuanPrivacy: p.persetujuanPrivacy !== false,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: pendaftaran.id,
            set: {
              lowonganId: matchedLowonganId,
              status: p.status || 'Pending',
              cvSummaryText: p.cvSummaryText ?? null,
              updatedAt: new Date(),
            },
          });
      }

      // 4. absensi
      for (const a of data.absensi) {
        if (!validNims.has(a.nim)) continue;
        await tx
          .insert(absensi)
          .values({
            id: a.id,
            timestamp: a.timestamp,
            tanggal: a.tanggal,
            nim: a.nim,
            nama: a.nama,
            status: a.status,
            lokasi: a.lokasi,
            jarakMeter: a.jarakMeter || 0,
            linkFoto: a.linkFoto,
            keterangan: a.keterangan ?? null,
            anomaliFlag: a.anomaliFlag ?? null,
          })
          .onConflictDoNothing({ target: absensi.id });
      }

      // 5. evaluasi
      for (const ev of data.evaluasi) {
        if (!validNims.has(ev.nim)) continue;
        await tx
          .insert(evaluasi)
          .values({
            id: ev.id,
            timestamp: ev.timestamp,
            nim: ev.nim,
            nama: ev.nama,
            skorBk: ev.skorBk,
            skorPs: ev.skorPs,
            skorTw: ev.skorTw,
            skorIs: ev.skorIs,
            skor: ev.skor,
            rekomendasi: ev.rekomendasi,
          })
          .onConflictDoNothing({ target: evaluasi.id });
      }

      // 6. universitas_pks
      for (const u of data.universitas) {
        await tx
          .insert(universitasPks)
          .values({
            id: u.id,
            universitas: u.universitas,
            tanggalMulai: u.tanggalMulai,
            tanggalBerakhir: u.tanggalBerakhir,
            durasiHari: u.durasiHari || 0,
            durasiBulan: u.durasiBulan || 0,
            keterangan: u.keterangan || '',
            linkDataPks: u.linkDataPks,
            dokumenNama: u.dokumenNama ?? null,
            status: u.status || 'Active',
            reminderSentAt: u.reminderSentAt ?? null,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: universitasPks.id,
            set: {
              universitas: u.universitas,
              tanggalMulai: u.tanggalMulai,
              tanggalBerakhir: u.tanggalBerakhir,
              durasiHari: u.durasiHari || 0,
              durasiBulan: u.durasiBulan || 0,
              keterangan: u.keterangan || '',
              linkDataPks: u.linkDataPks,
              dokumenNama: u.dokumenNama ?? null,
              status: u.status || 'Active',
              reminderSentAt: u.reminderSentAt ?? null,
              updatedAt: new Date(),
            },
          });
      }

      // 7. ai_audit_logs
      for (const log of data.aiAuditLogs) {
        await tx
          .insert(aiAuditLogs)
          .values({
            id: log.id,
            timestamp: log.timestamp,
            fitur: log.fitur,
            adminUser: log.adminUser,
            ringkasanPrompt: log.ringkasanPrompt,
            status: log.status,
          })
          .onConflictDoNothing({ target: aiAuditLogs.id });
      }

      // 8. email_logs
      for (const mail of data.emailLogs) {
        await tx
          .insert(emailLogs)
          .values({
            id: mail.id,
            timestamp: mail.timestamp,
            kepada: mail.kepada,
            subjek: mail.subjek,
            jenis: mail.jenis,
            isiRingkas: mail.isiRingkas,
          })
          .onConflictDoNothing({ target: emailLogs.id });
      }

      // 9. system_settings
      await tx
        .insert(systemSettings)
        .values({
          key: SETTINGS_KEY,
          gasApiUrl: data.gasApiUrl || '',
          factoryLat: data.factoryCoords?.lat ?? -7.4589,
          factoryLng: data.factoryCoords?.lng ?? 112.4631,
          maxRadiusMeters: data.factoryCoords?.maxRadiusMeters ?? 650,
          timezone: 'Asia/Jakarta',
          updatedBy: data.adminProfile?.username || 'hr.mojokerto',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            gasApiUrl: data.gasApiUrl || '',
            factoryLat: data.factoryCoords?.lat ?? -7.4589,
            factoryLng: data.factoryCoords?.lng ?? 112.4631,
            maxRadiusMeters: data.factoryCoords?.maxRadiusMeters ?? 650,
            updatedBy: data.adminProfile?.username || 'hr.mojokerto',
            updatedAt: new Date(),
          },
        });
    });
  } catch (error) {
    console.error('Database sync failed in syncDatabaseToPostgres:', error);
    throw new Error('Gagal menyimpan data sistem ke database PostgreSQL.', { cause: error });
  }
}

export async function loadOrSeedPostgresData(fallbackSeed: DatabaseSchema): Promise<DatabaseSchema> {
  try {
    await ensureMediaAssetsSeeded();
    await ensureAdminUserSeeded(fallbackSeed);

    const [
      existingSettings,
      lowonganRows,
      mahasiswaRows,
      pendaftaranRows,
      absensiRows,
      evaluasiRows,
      pksRows,
      aiLogRows,
      emailLogRows,
    ] = await Promise.all([
      db.select().from(systemSettings).where(eq(systemSettings.key, SETTINGS_KEY)),
      db.select().from(lowongan).orderBy(desc(lowongan.createdAt)),
      db.select().from(mahasiswa).orderBy(desc(mahasiswa.createdAt)),
      db.select().from(pendaftaran).orderBy(desc(pendaftaran.createdAt)),
      db.select().from(absensi).orderBy(desc(absensi.createdAt)),
      db.select().from(evaluasi).orderBy(desc(evaluasi.createdAt)),
      db.select().from(universitasPks).orderBy(desc(universitasPks.createdAt)),
      db.select().from(aiAuditLogs).orderBy(desc(aiAuditLogs.createdAt)),
      db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)),
    ]);

    const hasExistingPostgresData =
      existingSettings.length > 0 || lowonganRows.length > 0 || mahasiswaRows.length > 0;

    if (!hasExistingPostgresData) {
      await syncDatabaseToPostgres(fallbackSeed);
      return fallbackSeed;
    }

    const setting = existingSettings[0];
    return {
      lowongan: lowonganRows.map((l) => ({
        id: l.id,
        namaPosisi: l.namaPosisi,
        pendidikan: l.pendidikan,
        prodi: l.prodi,
        skill: l.skill,
        tugas: l.tugas,
        benefit: l.benefit,
        status: l.status === 'Closed' ? 'Closed' : 'Open',
      })),
      mahasiswa: mahasiswaRows.map((m) => ({
        nim: m.nim,
        program: m.program === 'PKL' ? 'PKL' : 'MBKM',
        department: m.department,
        nama: m.nama,
        universitas: m.universitas,
        jurusan: m.jurusan,
        tglMasuk: m.tglMasuk,
        tanggalBerakhir: m.tanggalBerakhir,
        gender: m.gender === 'P' ? 'P' : 'L',
        status: m.status === 'Tidak Aktif' ? 'Tidak Aktif' : 'Aktif',
        talent: m.talent as DatabaseSchema['mahasiswa'][number]['talent'],
        skor: m.skor,
      })),
      pendaftaran: pendaftaranRows.map((p) => ({
        id: p.id,
        timestamp: p.timestamp,
        jenis: p.jenis === 'PKL' ? 'PKL' : 'MBKM',
        nama: p.nama,
        nim: p.nim,
        universitas: p.universitas,
        jurusan: p.jurusan,
        lowongan: p.lowongan,
        linkCv: p.linkCv,
        cvFileName: p.cvFileName ?? undefined,
        cvBase64: p.cvBase64 ?? undefined,
        cvSummaryText: p.cvSummaryText ?? undefined,
        status: (p.status as DatabaseSchema['pendaftaran'][number]['status']) || 'Pending',
        email: p.email,
        persetujuanPrivacy: p.persetujuanPrivacy,
      })),
      absensi: absensiRows.map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        tanggal: a.tanggal,
        nim: a.nim,
        nama: a.nama,
        status: (a.status as DatabaseSchema['absensi'][number]['status']) || 'Masuk',
        lokasi: a.lokasi,
        jarakMeter: a.jarakMeter,
        linkFoto: a.linkFoto,
        keterangan: a.keterangan ?? undefined,
        anomaliFlag: a.anomaliFlag ?? undefined,
      })),
      evaluasi: evaluasiRows.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        nim: e.nim,
        nama: e.nama,
        skorBk: e.skorBk,
        skorPs: e.skorPs,
        skorTw: e.skorTw,
        skorIs: e.skorIs,
        skor: e.skor,
        rekomendasi: e.rekomendasi as DatabaseSchema['evaluasi'][number]['rekomendasi'],
      })),
      universitas: pksRows.map((u) => ({
        id: u.id,
        universitas: u.universitas,
        tanggalMulai: u.tanggalMulai,
        tanggalBerakhir: u.tanggalBerakhir,
        durasiHari: u.durasiHari,
        durasiBulan: u.durasiBulan,
        keterangan: u.keterangan,
        linkDataPks: u.linkDataPks,
        dokumenNama: u.dokumenNama ?? undefined,
        status: u.status === 'Expired' ? 'Expired' : 'Active',
        reminderSentAt: u.reminderSentAt ?? undefined,
      })),
      aiAuditLogs: aiLogRows.map((log) => ({
        id: log.id,
        timestamp: log.timestamp,
        fitur: log.fitur,
        adminUser: log.adminUser,
        ringkasanPrompt: log.ringkasanPrompt,
        status: log.status === 'Error' ? 'Error' : 'Sukses',
      })),
      emailLogs: emailLogRows.map((mail) => ({
        id: mail.id,
        timestamp: mail.timestamp,
        kepada: mail.kepada,
        subjek: mail.subjek,
        jenis: mail.jenis as DatabaseSchema['emailLogs'][number]['jenis'],
        isiRingkas: mail.isiRingkas,
      })),
      gasApiUrl: setting?.gasApiUrl ?? fallbackSeed.gasApiUrl,
      factoryCoords: {
        lat: setting?.factoryLat ?? -7.4589,
        lng: setting?.factoryLng ?? 112.4631,
        maxRadiusMeters: setting?.maxRadiusMeters ?? 650,
      },
      adminProfile: fallbackSeed.adminProfile,
    };
  } catch (error) {
    console.error('Database query failed in loadOrSeedPostgresData:', error);
    throw new Error('Gagal memuat data sistem dari database PostgreSQL.', { cause: error });
  }
}
