import { and, count, desc, eq, inArray } from 'drizzle-orm';
import BizError from '@/server/error/biz-error';
import { albumMemberTab } from '@/server/entity/album-member';
import { albumPhotoTab } from '@/server/entity/album-photo';
import { albumTab } from '@/server/entity/album';
import { photoTab } from '@/server/entity/photo';
import { userTab } from '@/server/entity/user';
import { type AlbumMemberBatchSetBo, type AlbumMemberSetBo } from '@/server/entity/bo/album-member';
import { type AlbumMemberVo, type AlbumPermission, type UserAlbumPermissionVo } from '@/server/entity/vo/album-member';
import { UserTypeEnum } from '@/server/enums/user-enum';
import { orm } from '@/server/infra/db';
import { createId } from '@/server/lib/id';
import { auditLogService } from '@/server/service/audit-log-service';
import { AlbumKindEnum } from '@/server/enums/album-enum';

// 这个模块集中处理共享相册的读取和写入权限。

const albumPermissionService = {

  // 判断指定用户是否为全局管理员。
  async isAdmin(userId: string): Promise<boolean> {
    const [user] = await orm
      .select({ type: userTab.type })
      .from(userTab)
      .where(eq(userTab.userId, userId))
      .limit(1);

    return user?.type === UserTypeEnum.ADMIN;
  },

  // 校验指定用户是否为全局管理员。
  async assertAdmin(userId: string): Promise<void> {
    if (!await this.isAdmin(userId)) {
      throw new BizError('auth.forbidden', 403);
    }
  },

  // 列出当前用户可见的全部相册 id，管理员默认拥有全部相册权限。
  async listVisibleAlbumIds(userId: string): Promise<string[]> {
    if (await this.isAdmin(userId)) {
      const albums = await orm.select({ albumId: albumTab.albumId }).from(albumTab);
      return albums.map((album) => album.albumId);
    }

    const rows = await orm
      .select({ albumId: albumMemberTab.albumId })
      .from(albumMemberTab)
      .innerJoin(albumTab, eq(albumMemberTab.albumId, albumTab.albumId))
      .where(and(
        eq(albumMemberTab.userId, userId),
        eq(albumMemberTab.canView, 1),
      ));

    return rows.map((row) => row.albumId);
  },

  // 批量返回当前用户在指定相册中的有效权限。
  async listPermissions(userId: string, albumIds: string[]): Promise<Map<string, AlbumPermission>> {
    const permissionMap = new Map<string, AlbumPermission>();

    if (!albumIds.length) {
      return permissionMap;
    }

    if (await this.isAdmin(userId)) {
      for (const albumId of albumIds) {
        permissionMap.set(albumId, {
          albumId,
          canView: true,
          canUpload: true,
          canDeleteOwn: true,
          isAdmin: true,
        });
      }
      return permissionMap;
    }

    const rows = await orm
      .select()
      .from(albumMemberTab)
      .where(and(
        eq(albumMemberTab.userId, userId),
        eq(albumMemberTab.canView, 1),
        inArray(albumMemberTab.albumId, albumIds),
      ));

    for (const row of rows) {
      permissionMap.set(row.albumId, {
        albumId: row.albumId,
        canView: true,
        canUpload: row.canUpload === 1,
        canDeleteOwn: row.canDeleteOwn === 1,
        isAdmin: false,
      });
    }

    return permissionMap;
  },

  // 查询当前用户在指定相册中的有效权限。
  async getAlbumPermission(userId: string, albumId: string): Promise<AlbumPermission | null> {
    const [album] = await orm
      .select({ albumId: albumTab.albumId })
      .from(albumTab)
      .where(eq(albumTab.albumId, albumId))
      .limit(1);

    if (!album) {
      return null;
    }

    if (await this.isAdmin(userId)) {
      return {
        albumId,
        canView: true,
        canUpload: true,
        canDeleteOwn: true,
        isAdmin: true,
      };
    }

    const [permission] = await orm
      .select()
      .from(albumMemberTab)
      .where(and(
        eq(albumMemberTab.albumId, albumId),
        eq(albumMemberTab.userId, userId),
      ))
      .limit(1);

    if (!permission?.canView) {
      return null;
    }

    return {
      albumId,
      canView: true,
      canUpload: permission.canUpload === 1,
      canDeleteOwn: permission.canDeleteOwn === 1,
      isAdmin: false,
    };
  },

  // 校验当前用户能否查看指定相册。
  async assertCanViewAlbum(userId: string, albumId: string): Promise<AlbumPermission> {
    const permission = await this.getAlbumPermission(userId, albumId);

    if (!permission?.canView) {
      throw new BizError('auth.notFound', 404);
    }

    return permission;
  },

  // 校验当前用户能否上传到指定相册。
  async assertCanUploadToAlbum(userId: string, albumId: string): Promise<AlbumPermission> {
    const permission = await this.assertCanViewAlbum(userId, albumId);

    if (!permission.canUpload) {
      throw new BizError('auth.forbidden', 403);
    }

    return permission;
  },

  // 判断当前用户能否查看指定照片。
  async canViewPhoto(userId: string, photoId: string): Promise<boolean> {
    if (await this.isAdmin(userId)) {
      const [photo] = await orm
        .select({ photoId: photoTab.photoId })
        .from(photoTab)
        .where(eq(photoTab.photoId, photoId))
        .limit(1);
      return Boolean(photo);
    }

    const [row] = await orm
      .select({ photoId: photoTab.photoId })
      .from(photoTab)
      .innerJoin(albumPhotoTab, eq(photoTab.photoId, albumPhotoTab.photoId))
      .innerJoin(albumMemberTab, eq(albumPhotoTab.albumId, albumMemberTab.albumId))
      .where(and(
        eq(photoTab.photoId, photoId),
        eq(albumMemberTab.userId, userId),
        eq(albumMemberTab.canView, 1),
      ))
      .limit(1);

    return Boolean(row);
  },

  // 校验当前用户能否查看指定照片。
  async assertCanViewPhoto(userId: string, photoId: string): Promise<void> {
    if (!await this.canViewPhoto(userId, photoId)) {
      throw new BizError('auth.notFound', 404);
    }
  },

  // 校验当前用户能否从指定相册移除本人上传的照片。
  async assertCanRemoveOwnPhoto(userId: string, albumId: string, photoId: string): Promise<void> {
    const permission = await this.assertCanViewAlbum(userId, albumId);

    if (permission.isAdmin) {
      return;
    }

    if (!permission.canDeleteOwn) {
      throw new BizError('auth.forbidden', 403);
    }

    const [photo] = await orm
      .select({ photoId: photoTab.photoId })
      .from(photoTab)
      .innerJoin(albumPhotoTab, eq(photoTab.photoId, albumPhotoTab.photoId))
      .where(and(
        eq(photoTab.photoId, photoId),
        eq(photoTab.userId, userId),
        eq(albumPhotoTab.albumId, albumId),
      ))
      .limit(1);

    if (!photo) {
      throw new BizError('auth.notFound', 404);
    }
  },

  // 列出指定相册可授权的普通成员及其当前权限。
  async listMembers(albumId: string, actorUserId: string): Promise<AlbumMemberVo[]> {
    await this.assertAdmin(actorUserId);
    const [album] = await orm
      .select({ albumId: albumTab.albumId, kind: albumTab.kind })
      .from(albumTab)
      .where(eq(albumTab.albumId, albumId))
      .limit(1);

    if (!album || album.kind === AlbumKindEnum.PERSONAL) {
      throw new BizError('auth.notFound', 404);
    }

    const users = await orm
      .select({
        userId: userTab.userId,
        username: userTab.username,
        avatar: userTab.avatar,
        status: userTab.status,
      })
      .from(userTab)
      .where(eq(userTab.type, UserTypeEnum.NORMAL));

    if (!users.length) {
      return [];
    }

    const permissions = await orm
      .select()
      .from(albumMemberTab)
      .where(and(
        eq(albumMemberTab.albumId, albumId),
        inArray(albumMemberTab.userId, users.map((user) => user.userId)),
      ));

    return users.map((user) => {
      const permission = permissions.find((item) => item.userId === user.userId);
      return {
        ...user,
        canView: permission?.canView === 1,
        canUpload: permission?.canUpload === 1,
        canDeleteOwn: permission?.canDeleteOwn === 1,
      };
    });
  },

  // 按成员列出全部共享相册及其当前权限，供用户管理页配置。
  async listAlbumsForMember(userId: string, actorUserId: string): Promise<UserAlbumPermissionVo[]> {
    await this.assertAdmin(actorUserId);
    const [target] = await orm
      .select({ userId: userTab.userId, type: userTab.type })
      .from(userTab)
      .where(eq(userTab.userId, userId))
      .limit(1);

    if (!target || target.type !== UserTypeEnum.NORMAL) {
      throw new BizError('user.notFound');
    }

    const albums = await orm
      .select()
      .from(albumTab)
      .where(eq(albumTab.kind, AlbumKindEnum.SHARED))
      .orderBy(desc(albumTab.sort), desc(albumTab.createTime));

    if (!albums.length) {
      return [];
    }

    const albumIds = albums.map((album) => album.albumId);
    const [permissions, photoStats] = await Promise.all([
      orm.select()
        .from(albumMemberTab)
        .where(and(
          eq(albumMemberTab.userId, userId),
          inArray(albumMemberTab.albumId, albumIds),
        )),
      orm.select({ albumId: albumPhotoTab.albumId, photoTotal: count(photoTab.photoId) })
        .from(albumPhotoTab)
        .innerJoin(photoTab, eq(albumPhotoTab.photoId, photoTab.photoId))
        .where(inArray(albumPhotoTab.albumId, albumIds))
        .groupBy(albumPhotoTab.albumId),
    ]);

    return albums.map((album) => {
      const permission = permissions.find((item) => item.albumId === album.albumId);
      const photoStat = photoStats.find((item) => item.albumId === album.albumId);

      return {
        albumId: album.albumId,
        name: album.name,
        photoTotal: Number(photoStat?.photoTotal ?? 0),
        canView: permission?.canView === 1,
        canUpload: permission?.canUpload === 1,
        canDeleteOwn: permission?.canDeleteOwn === 1,
      };
    });
  },

  // 新增或更新成员在指定相册中的权限，关闭查看时删除授权记录。
  async setMemberPermission(params: AlbumMemberSetBo, actorUserId: string): Promise<void> {
    await this.assertAdmin(actorUserId);
    const albumId = params.albumId?.trim();
    const userId = params.userId?.trim();

    if (!albumId) {
      throw new BizError('album.selectRequired');
    }

    if (!userId) {
      throw new BizError('user.selectRequired');
    }

    const [target] = await orm
      .select({ userId: userTab.userId, username: userTab.username, type: userTab.type })
      .from(userTab)
      .where(eq(userTab.userId, userId))
      .limit(1);

    if (!target || target.type === UserTypeEnum.ADMIN) {
      throw new BizError('user.notFound');
    }

    const [album] = await orm
      .select({ albumId: albumTab.albumId, name: albumTab.name, kind: albumTab.kind })
      .from(albumTab)
      .where(eq(albumTab.albumId, albumId))
      .limit(1);

    if (!album || album.kind === AlbumKindEnum.PERSONAL) {
      throw new BizError('auth.notFound', 404);
    }

    const canUpload = params.canUpload;
    const canDeleteOwn = params.canDeleteOwn;
    const canView = params.canView || canUpload || canDeleteOwn;

    if (!canView) {
      await orm.delete(albumMemberTab).where(and(
        eq(albumMemberTab.albumId, albumId),
        eq(albumMemberTab.userId, userId),
      ));
      await auditLogService.record({
        actorUserId,
        action: 'album.permission.remove',
        targetType: 'album-member',
        targetId: `${albumId}:${userId}`,
        targetName: `${album.name} / ${target.username}`,
      });
      return;
    }

    const now = new Date().toISOString();
    await orm.insert(albumMemberTab).values({
      id: createId(),
      albumId,
      userId,
      canView: 1,
      canUpload: canUpload ? 1 : 0,
      canDeleteOwn: canDeleteOwn ? 1 : 0,
      createTime: now,
      updateTime: now,
    }).onConflictDoUpdate({
      target: [albumMemberTab.albumId, albumMemberTab.userId],
      set: {
        canView: 1,
        canUpload: canUpload ? 1 : 0,
        canDeleteOwn: canDeleteOwn ? 1 : 0,
        updateTime: now,
      },
    });
    await auditLogService.record({
      actorUserId,
      action: 'album.permission.set',
      targetType: 'album-member',
      targetId: `${albumId}:${userId}`,
      targetName: `${album.name} / ${target.username}`,
      details: { canView: true, canUpload, canDeleteOwn },
    });
  },

  // 删除成员在指定相册中的全部权限。
  async removeMemberPermission(albumId: string, userId: string, actorUserId: string): Promise<void> {
    await this.assertAdmin(actorUserId);
    const [album] = await orm
      .select({ kind: albumTab.kind })
      .from(albumTab)
      .where(eq(albumTab.albumId, albumId))
      .limit(1);

    if (!album || album.kind === AlbumKindEnum.PERSONAL) {
      throw new BizError('auth.notFound', 404);
    }

    await orm.delete(albumMemberTab).where(and(
      eq(albumMemberTab.albumId, albumId),
      eq(albumMemberTab.userId, userId),
    ));
    await auditLogService.record({
      actorUserId,
      action: 'album.permission.remove',
      targetType: 'album-member',
      targetId: `${albumId}:${userId}`,
    });
  },

  // 为多个成员批量设置同一组相册权限。
  async batchSetMemberPermission(params: AlbumMemberBatchSetBo, actorUserId: string): Promise<void> {
    await this.assertAdmin(actorUserId);
    const userIds = Array.from(new Set(params.userIds.filter(Boolean)));

    if (!userIds.length) {
      throw new BizError('user.selectRequired');
    }

    for (const userId of userIds) {
      await this.setMemberPermission({
        albumId: params.albumId,
        userId,
        canView: params.canView,
        canUpload: params.canUpload,
        canDeleteOwn: params.canDeleteOwn,
      }, actorUserId);
    }
  },
};

export { albumPermissionService };
