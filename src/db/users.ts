import crypto from 'node:crypto';
import { desc, eq } from 'drizzle-orm';
import { db } from './index.js';
import {
  mediaAssets,
  mediaEditHistory,
  profileChangeLogs,
  userProfiles,
  users,
} from './schema.js';

export interface HydratedAdminUser {
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

export interface UserAuditLogItem {
  id: number;
  userId: number;
  targetUsername: string;
  changedFields: string;
  passwordChanged: boolean;
  changedBy: string;
  createdAt: string;
}

const DEFAULT_AVATAR = '/assets/images/avatar_hr_admin_1794535891951.jpg';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string,
  avatarUrl?: string,
  authProvider: 'firebase_google' | 'password' = 'firebase_google',
  preferredUsername?: string,
  passwordHash?: string
): Promise<HydratedAdminUser> {
  try {
    const cleanEmail = (email || 'hr.development@ajinomoto.co.id').trim().toLowerCase();
    const baseUsername =
      preferredUsername ||
      cleanEmail.split('@')[0]?.replace(/[^a-zA-Z0-9._-]/g, '') ||
      `user_${uid.slice(0, 8)}`;

    const upsertedUsers = await db
      .insert(users)
      .values({
        uid,
        username: baseUsername,
        email: cleanEmail,
        passwordHash: passwordHash ?? null,
        role: 'HR Development Admin',
        authProvider,
        isActive: true,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();

    const userRow = upsertedUsers[0];
    if (!userRow) {
      throw new Error('Failed to upsert user record.');
    }

    const existingProfiles = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userRow.id));

    let profileRow = existingProfiles[0];
    if (!profileRow) {
      const insertedProfiles = await db
        .insert(userProfiles)
        .values({
          userId: userRow.id,
          namaTampilan: displayName?.trim() || 'Rina Kusuma',
          role: userRow.role || 'HR Development Admin',
          departemen: 'HR Development Section',
          emailKorporat: cleanEmail,
          noTelepon: '+62 321-361-000',
          avatarUrl: avatarUrl?.trim() || DEFAULT_AVATAR,
        })
        .onConflictDoNothing({ target: userProfiles.userId })
        .returning();

      if (insertedProfiles[0]) {
        profileRow = insertedProfiles[0];
      } else {
        const refetch = await db
          .select()
          .from(userProfiles)
          .where(eq(userProfiles.userId, userRow.id));
        profileRow = refetch[0];
      }
    }

    return {
      id: userRow.id,
      uid: userRow.uid,
      username: userRow.username,
      namaTampilan: profileRow.namaTampilan,
      role: profileRow.role,
      departemen: profileRow.departemen,
      email: profileRow.emailKorporat,
      noTelepon: profileRow.noTelepon,
      avatarUrl: profileRow.avatarUrl,
      authProvider: userRow.authProvider,
      isActive: userRow.isActive,
      lastLoginAt: userRow.lastLoginAt ? userRow.lastLoginAt.toISOString() : null,
      createdAt: userRow.createdAt ? userRow.createdAt.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Gagal memproses data akun pengguna pada database.', { cause: error });
  }
}

export async function touchUserLastLogin(userId: number): Promise<void> {
  try {
    const now = new Date();
    await db
      .update(users)
      .set({ lastLoginAt: now, updatedAt: now })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error('Failed updating lastLoginAt:', error);
  }
}

export async function getUserWithPasswordByUsername(username: string) {
  try {
    const clean = username.trim().toLowerCase();
    const rows = await db
      .select({
        user: users,
        profile: userProfiles,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.username, clean))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    return {
      user: row.user,
      profile: row.profile || null,
    };
  } catch (error) {
    console.error('Database query failed in getUserWithPasswordByUsername:', error);
    throw new Error('Gagal membaca data kredensial pengguna dari database.', { cause: error });
  }
}

export async function getUserWithProfileByUid(uid: string): Promise<HydratedAdminUser | null> {
  try {
    const rows = await db
      .select({
        user: users,
        profile: userProfiles,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
      .where(eq(users.uid, uid))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const { user: userRow, profile: profileRow } = row;
    return {
      id: userRow.id,
      uid: userRow.uid,
      username: userRow.username,
      namaTampilan: profileRow?.namaTampilan || userRow.username,
      role: profileRow?.role || userRow.role,
      departemen: profileRow?.departemen || 'HR Development Section',
      email: profileRow?.emailKorporat || userRow.email,
      noTelepon: profileRow?.noTelepon || '+62 321-361-000',
      avatarUrl: profileRow?.avatarUrl || DEFAULT_AVATAR,
      authProvider: userRow.authProvider,
      isActive: userRow.isActive,
      lastLoginAt: userRow.lastLoginAt ? userRow.lastLoginAt.toISOString() : null,
      createdAt: userRow.createdAt ? userRow.createdAt.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Database query failed in getUserWithProfileByUid:', error);
    throw new Error('Gagal memuat profil pengguna dari database.', { cause: error });
  }
}

export async function getUserById(id: number): Promise<HydratedAdminUser | null> {
  try {
    const rows = await db.select().from(users).where(eq(users.id, id));
    const userRow = rows[0];
    if (!userRow) return null;
    const profiles = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userRow.id));
    const profileRow = profiles[0];

    return {
      id: userRow.id,
      uid: userRow.uid,
      username: userRow.username,
      namaTampilan: profileRow?.namaTampilan || userRow.username,
      role: profileRow?.role || userRow.role,
      departemen: profileRow?.departemen || 'HR Development Section',
      email: profileRow?.emailKorporat || userRow.email,
      noTelepon: profileRow?.noTelepon || '',
      avatarUrl: profileRow?.avatarUrl || DEFAULT_AVATAR,
      authProvider: userRow.authProvider,
      isActive: userRow.isActive,
      lastLoginAt: userRow.lastLoginAt ? userRow.lastLoginAt.toISOString() : null,
      createdAt: userRow.createdAt ? userRow.createdAt.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Database query failed in getUserById:', error);
    throw new Error('Gagal memuat detail pengguna dari database.', { cause: error });
  }
}

export async function listAllUsers(): Promise<HydratedAdminUser[]> {
  try {
    const userRows = await db.select().from(users).orderBy(desc(users.createdAt));
    const profileRows = await db.select().from(userProfiles);
    const profileMap = new Map(profileRows.map((p) => [p.userId, p]));

    return userRows.map((u) => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        uid: u.uid,
        username: u.username,
        namaTampilan: p?.namaTampilan || u.username,
        role: p?.role || u.role,
        departemen: p?.departemen || 'HR Development Section',
        email: p?.emailKorporat || u.email,
        noTelepon: p?.noTelepon || '',
        avatarUrl: p?.avatarUrl || DEFAULT_AVATAR,
        authProvider: u.authProvider,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        createdAt: u.createdAt ? u.createdAt.toISOString() : undefined,
      };
    });
  } catch (error) {
    console.error('Database query failed in listAllUsers:', error);
    throw new Error('Gagal memuat daftar akun pengguna dari database.', { cause: error });
  }
}

export async function createManagedUser(
  input: {
    username: string;
    passwordHash: string;
    namaTampilan: string;
    role: string;
    departemen: string;
    email: string;
    noTelepon?: string;
    isActive?: boolean;
  },
  createdBy: string
): Promise<HydratedAdminUser> {
  try {
    const cleanUsername = input.username.trim().toLowerCase();
    const cleanEmail = input.email.trim().toLowerCase();
    const existing = await db.select().from(users).where(eq(users.username, cleanUsername));
    if (existing.length > 0) {
      throw new Error('USERNAME_EXISTS');
    }

    const uid = `usr-${crypto.randomBytes(8).toString('hex')}`;
    const insertedUsers = await db
      .insert(users)
      .values({
        uid,
        username: cleanUsername,
        email: cleanEmail,
        passwordHash: input.passwordHash,
        role: input.role.trim(),
        authProvider: 'password',
        isActive: input.isActive !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const userRow = insertedUsers[0];
    if (!userRow) {
      throw new Error('Gagal membuat record akun baru.');
    }

    const insertedProfiles = await db
      .insert(userProfiles)
      .values({
        userId: userRow.id,
        namaTampilan: input.namaTampilan.trim(),
        role: input.role.trim(),
        departemen: input.departemen.trim(),
        emailKorporat: cleanEmail,
        noTelepon: (input.noTelepon || '').trim(),
        avatarUrl: DEFAULT_AVATAR,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    const profileRow = insertedProfiles[0];

    await db.insert(profileChangeLogs).values({
      userId: userRow.id,
      changedFields: `account_created:${input.role.trim()}:${input.departemen.trim()}`,
      passwordChanged: true,
      changedBy: createdBy,
    });

    return {
      id: userRow.id,
      uid: userRow.uid,
      username: userRow.username,
      namaTampilan: profileRow.namaTampilan,
      role: profileRow.role,
      departemen: profileRow.departemen,
      email: profileRow.emailKorporat,
      noTelepon: profileRow.noTelepon,
      avatarUrl: profileRow.avatarUrl,
      authProvider: userRow.authProvider,
      isActive: userRow.isActive,
      lastLoginAt: null,
      createdAt: userRow.createdAt ? userRow.createdAt.toISOString() : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'USERNAME_EXISTS') {
      throw error;
    }
    console.error('Database query failed in createManagedUser:', error);
    throw new Error('Gagal membuat akun pengguna baru di database.', { cause: error });
  }
}

export async function updateManagedUser(
  userId: number,
  patch: {
    namaTampilan?: string;
    role?: string;
    departemen?: string;
    email?: string;
    noTelepon?: string;
    isActive?: boolean;
  },
  nextPasswordHash: string | undefined,
  updatedBy: string
): Promise<HydratedAdminUser> {
  try {
    const rows = await db.select().from(users).where(eq(users.id, userId));
    const userRow = rows[0];
    if (!userRow) {
      throw new Error('USER_NOT_FOUND');
    }

    const profiles = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userRow.id));
    const currentProfile = profiles[0];

    const nextRole = patch.role?.trim() || currentProfile?.role || userRow.role;
    const nextEmail = patch.email?.trim().toLowerCase() || currentProfile?.emailKorporat || userRow.email;
    const nextNama = patch.namaTampilan?.trim() || currentProfile?.namaTampilan || userRow.username;
    const nextDept = patch.departemen?.trim() || currentProfile?.departemen || 'HR Development Section';
    const nextPhone = patch.noTelepon !== undefined ? patch.noTelepon.trim() : (currentProfile?.noTelepon || '');
    const nextIsActive = patch.isActive !== undefined ? patch.isActive : userRow.isActive;

    const [updatedUser] = await db
      .update(users)
      .set({
        email: nextEmail,
        role: nextRole,
        isActive: nextIsActive,
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userRow.id))
      .returning();

    const [updatedProfile] = await db
      .insert(userProfiles)
      .values({
        userId: userRow.id,
        namaTampilan: nextNama,
        role: nextRole,
        departemen: nextDept,
        emailKorporat: nextEmail,
        noTelepon: nextPhone,
        avatarUrl: currentProfile?.avatarUrl || DEFAULT_AVATAR,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          namaTampilan: nextNama,
          role: nextRole,
          departemen: nextDept,
          emailKorporat: nextEmail,
          noTelepon: nextPhone,
          updatedAt: new Date(),
        },
      })
      .returning();

    const changedFields: string[] = [];
    if (!currentProfile || currentProfile.namaTampilan !== nextNama) changedFields.push('namaTampilan');
    if (userRow.role !== nextRole) changedFields.push('role');
    if (!currentProfile || currentProfile.departemen !== nextDept) changedFields.push('departemen');
    if (userRow.email !== nextEmail) changedFields.push('email');
    if ((currentProfile?.noTelepon || '') !== nextPhone) changedFields.push('noTelepon');
    if (userRow.isActive !== nextIsActive) changedFields.push(nextIsActive ? 'activated' : 'deactivated');
    if (nextPasswordHash) changedFields.push('passwordReset');

    await db.insert(profileChangeLogs).values({
      userId: userRow.id,
      changedFields: changedFields.join(',') || 'account_updated',
      passwordChanged: Boolean(nextPasswordHash),
      changedBy: updatedBy,
    });

    return {
      id: updatedUser.id,
      uid: updatedUser.uid,
      username: updatedUser.username,
      namaTampilan: updatedProfile.namaTampilan,
      role: updatedProfile.role,
      departemen: updatedProfile.departemen,
      email: updatedProfile.emailKorporat,
      noTelepon: updatedProfile.noTelepon,
      avatarUrl: updatedProfile.avatarUrl,
      authProvider: updatedUser.authProvider,
      isActive: updatedUser.isActive,
      lastLoginAt: updatedUser.lastLoginAt ? updatedUser.lastLoginAt.toISOString() : null,
      createdAt: updatedUser.createdAt ? updatedUser.createdAt.toISOString() : undefined,
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      throw error;
    }
    console.error('Database query failed in updateManagedUser:', error);
    throw new Error('Gagal memperbarui data akun pengguna di database.', { cause: error });
  }
}

export async function deleteManagedUser(userId: number): Promise<boolean> {
  try {
    const deleted = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteManagedUser:', error);
    throw new Error('Gagal menghapus akun pengguna dari database.', { cause: error });
  }
}

export async function getRecentUserAuditLogs(limit = 25): Promise<UserAuditLogItem[]> {
  try {
    const logs = await db
      .select()
      .from(profileChangeLogs)
      .orderBy(desc(profileChangeLogs.createdAt))
      .limit(limit);
    const allUsers = await db.select({ id: users.id, username: users.username }).from(users);
    const userMap = new Map(allUsers.map((u) => [u.id, u.username]));

    return logs.map((l) => ({
      id: l.id,
      userId: l.userId,
      targetUsername: userMap.get(l.userId) || `user#${l.userId}`,
      changedFields: l.changedFields,
      passwordChanged: l.passwordChanged,
      changedBy: l.changedBy,
      createdAt: l.createdAt ? l.createdAt.toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed in getRecentUserAuditLogs:', error);
    return [];
  }
}

export async function updateUserProfileAndAudit(
  uid: string,
  patch: {
    namaTampilan: string;
    role: string;
    departemen: string;
    email: string;
    noTelepon: string;
    avatarUrl?: string;
  },
  nextPasswordHash?: string,
  changedBy?: string
): Promise<HydratedAdminUser> {
  try {
    const userRows = await db.select().from(users).where(eq(users.uid, uid));
    const userRow = userRows[0];
    if (!userRow) {
      throw new Error('Akun pengguna tidak ditemukan.');
    }

    const existingProfiles = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userRow.id));
    const currentProfile = existingProfiles[0];

    const previousAvatar = currentProfile?.avatarUrl || DEFAULT_AVATAR;
    const nextAvatar = patch.avatarUrl?.trim() ? patch.avatarUrl.trim() : previousAvatar;

    await db
      .update(users)
      .set({
        email: patch.email.trim(),
        role: patch.role.trim(),
        ...(nextPasswordHash ? { passwordHash: nextPasswordHash } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userRow.id));

    const updatedProfiles = await db
      .insert(userProfiles)
      .values({
        userId: userRow.id,
        namaTampilan: patch.namaTampilan.trim(),
        role: patch.role.trim(),
        departemen: patch.departemen.trim(),
        emailKorporat: patch.email.trim(),
        noTelepon: patch.noTelepon.trim(),
        avatarUrl: nextAvatar,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          namaTampilan: patch.namaTampilan.trim(),
          role: patch.role.trim(),
          departemen: patch.departemen.trim(),
          emailKorporat: patch.email.trim(),
          noTelepon: patch.noTelepon.trim(),
          avatarUrl: nextAvatar,
          updatedAt: new Date(),
        },
      })
      .returning();

    const changedFields: string[] = [];
    if (!currentProfile || currentProfile.namaTampilan !== patch.namaTampilan.trim()) changedFields.push('namaTampilan');
    if (!currentProfile || currentProfile.role !== patch.role.trim()) changedFields.push('role');
    if (!currentProfile || currentProfile.departemen !== patch.departemen.trim()) changedFields.push('departemen');
    if (!currentProfile || currentProfile.emailKorporat !== patch.email.trim()) changedFields.push('email');
    if (!currentProfile || currentProfile.noTelepon !== patch.noTelepon.trim()) changedFields.push('noTelepon');
    if (previousAvatar !== nextAvatar) changedFields.push('avatarUrl');
    if (nextPasswordHash) changedFields.push('passwordHash');

    await db.insert(profileChangeLogs).values({
      userId: userRow.id,
      changedFields: changedFields.join(',') || 'no_field_delta',
      previousAvatarUrl: previousAvatar !== nextAvatar ? previousAvatar : null,
      newAvatarUrl: previousAvatar !== nextAvatar ? nextAvatar : null,
      passwordChanged: Boolean(nextPasswordHash),
      changedBy: changedBy || userRow.username,
    });

    // Record avatar change in media_assets & media_edit_history if avatar changed
    if (previousAvatar !== nextAvatar) {
      const assetKey = `user_avatar_${userRow.username}`;
      const existingAssets = await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.assetKey, assetKey));

      const mimeType = nextAvatar.startsWith('data:image/png')
        ? 'image/png'
        : nextAvatar.startsWith('data:image/webp')
          ? 'image/webp'
          : 'image/jpeg';

      const upsertedAsset = await db
        .insert(mediaAssets)
        .values({
          assetKey,
          label: `Foto Profil ${patch.namaTampilan.trim()}`,
          placement: 'Sidebar Dashboard & Modal Profil Admin',
          currentUrl: nextAvatar,
          altText: `Foto profil ${patch.namaTampilan.trim()}`,
          objectPosition: 'center',
          mimeType,
          sourceType: nextAvatar.startsWith('data:') ? 'user_upload' : 'system_default',
          updatedByUserId: userRow.id,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: mediaAssets.assetKey,
          set: {
            currentUrl: nextAvatar,
            altText: `Foto profil ${patch.namaTampilan.trim()}`,
            mimeType,
            sourceType: nextAvatar.startsWith('data:') ? 'user_upload' : 'system_default',
            updatedByUserId: userRow.id,
            updatedAt: new Date(),
          },
        })
        .returning();

      const assetId = upsertedAsset[0]?.id || existingAssets[0]?.id;
      if (assetId) {
        await db.insert(mediaEditHistory).values({
          mediaAssetId: assetId,
          assetKey,
          previousUrl: previousAvatar,
          newUrl: nextAvatar,
          previousObjectPosition: 'center',
          newObjectPosition: 'center',
          changeNote: 'Pembaruan foto profil melalui Manajemen Profil Admin',
          editedBy: changedBy || userRow.username,
        });
      }
    }

    const finalProfile = updatedProfiles[0];
    return {
      id: userRow.id,
      uid: userRow.uid,
      username: userRow.username,
      namaTampilan: finalProfile.namaTampilan,
      role: finalProfile.role,
      departemen: finalProfile.departemen,
      email: finalProfile.emailKorporat,
      noTelepon: finalProfile.noTelepon,
      avatarUrl: finalProfile.avatarUrl,
      authProvider: userRow.authProvider,
      isActive: userRow.isActive,
      lastLoginAt: userRow.lastLoginAt ? userRow.lastLoginAt.toISOString() : null,
      createdAt: userRow.createdAt ? userRow.createdAt.toISOString() : undefined,
    };
  } catch (error) {
    console.error('Database query failed in updateUserProfileAndAudit:', error);
    throw new Error('Gagal menyimpan pembaruan profil ke database.', { cause: error });
  }
}
