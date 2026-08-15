import { and, count, desc, eq, inArray, max } from 'drizzle-orm';
import { createId } from '@/server/lib/id';
import { type Album, albumTab } from '@/server/entity/album';
import { albumPhotoTab } from '@/server/entity/album-photo';
import { photoTab } from '@/server/entity/photo';
import { orm } from '@/server/infra/db';
import BizError from '@/server/error/biz-error';
import { type AlbumAddBo, type AlbumAddPhotoBo, type AlbumDeleteBo, type AlbumRemovePhotoBo, type AlbumSetNameBo, type AlbumSetTopBo } from '@/server/entity/bo/album';
import { PhotoStatusEnum } from '@/server/enums/photo-enum';
import { type AlbumVo } from '@/server/entity/vo/album';
import { storageService } from '@/server/service/storage-service';
import { formatHttpUrl, toMediaUrl } from '@/lib/url';
import { fileService } from '@/server/service/file-service';
import { FileTypeEnum } from '@/server/enums/file-enum';
import { type File } from '@/server/entity/file';
import { albumPermissionService } from '@/server/service/album-permission-service';
import { auditLogService } from '@/server/service/audit-log-service';
import { userTab } from '@/server/entity/user';
import { AlbumKindEnum } from '@/server/enums/album-enum';

// 这个模块处理相册数据写入相关业务。

const albumService = {

  // 查询当前用户有查看权限的全部相册列表。
  async list(userId: string): Promise<AlbumVo[]> {

    const visibleAlbumIds = await albumPermissionService.listVisibleAlbumIds(userId);

    if (!visibleAlbumIds.length) {
      return [];
    }

    const albumList = await orm
      .select()
      .from(albumTab)
      .where(and(
        inArray(albumTab.albumId, visibleAlbumIds),
        eq(albumTab.kind, AlbumKindEnum.SHARED),
      ))
      .orderBy(desc(albumTab.sort));

    if (!albumList.length) {
      return [];
    }

    const fileStorageList = await storageService.list();
    const owners = await orm
      .select({ userId: userTab.userId, username: userTab.username })
      .from(userTab)
      .where(inArray(userTab.userId, Array.from(new Set(albumList.map((album) => album.userId)))));
    const ownerMap = new Map(owners.map((owner) => [owner.userId, owner.username]));

    const photoStatList = await orm
      .select({
        albumId: albumPhotoTab.albumId,
        photoId: photoTab.photoId,
        thumbHash: photoTab.thumbHash,
        storageId: photoTab.storageId,
        photoTotal: count(photoTab.photoId),
        takenTime: max(photoTab.takenTime)
      })
      .from(albumPhotoTab)
      .innerJoin(photoTab, eq(albumPhotoTab.photoId, photoTab.photoId))
      .where(and(
        eq(photoTab.status, PhotoStatusEnum.NORMAL),
        inArray(albumPhotoTab.albumId, visibleAlbumIds)
      ))
      .groupBy(albumPhotoTab.albumId)
      .orderBy(desc(photoTab.takenTime), desc(photoTab.photoId));

    const fileMap = await fileService.listByPhotoIds(
      photoStatList.map((stat) => stat.photoId).filter(Boolean)
    );

    const permissionMap = await albumPermissionService.listPermissions(userId, visibleAlbumIds);
    const list = albumList.map((album) => {
      const photoStat = photoStatList.find((stat) => stat.albumId === album.albumId);
      const permission = permissionMap.get(album.albumId);
      const fileStorage = fileStorageList.list.find((item) => item.storageId === photoStat?.storageId);
      const domain = formatHttpUrl(fileStorage?.domain);

      let thumbnail: string | null = null;

      if (photoStat?.photoId) {
        const file = (fileMap.get(photoStat.photoId) ?? []).find((item) => item.type === FileTypeEnum.THUMBNAIL);
        thumbnail = file?.key ?? null;
      }

      return {
        ...album,
        ownerName: ownerMap.get(album.userId) ?? null,
        thumbnail: thumbnail ? toMediaUrl(thumbnail, domain, fileStorage?.type) : null,
        thumbHash: photoStat?.thumbHash ?? null,
        photoTotal: Number(photoStat?.photoTotal ?? 0),
        canUpload: permission?.canUpload ?? false,
        canDeleteOwn: permission?.canDeleteOwn ?? false,
      };
    });

    return list;
  },

  // 添加当前用户的相册，并阻止同一用户创建重复名称的相册。
  async add(params: AlbumAddBo, userId: string): Promise<Album> {

    await albumPermissionService.assertAdmin(userId);

    const name = params.name?.trim();

    if (!name) {
      throw new BizError('album.nameRequired');
    }

    const [existsAlbum] = await orm
      .select()
      .from(albumTab)
      .where(and(
        eq(albumTab.userId, userId),
        eq(albumTab.name, name)
      ))
      .limit(1);

    if (existsAlbum) {
      throw new BizError('album.nameExists');
    }

    const now = new Date().toISOString();

    const [album] = await orm.insert(albumTab).values({
      albumId: createId(),
      name,
      userId,
      kind: AlbumKindEnum.SHARED,
      sort: 0,
      createTime: now,
      updateTime: now,
    }).returning();

    return album;
  },

  // 给当前用户指定相册新增照片关联，并跳过已经存在的关联。
  async addPhoto(params: AlbumAddPhotoBo, userId: string): Promise<void> {

    if (!params.photoIds?.length) {
      throw new BizError('photo.selectRequired');
    }

    if (!params.albumIds?.length) {
      throw new BizError('album.selectRequired');
    }

    const albumIds = Array.from(new Set(params.albumIds));
    await Promise.all(albumIds.map((albumId) => (
      albumPermissionService.assertCanUploadToAlbum(userId, albumId)
    )));

    const isAdmin = await albumPermissionService.isAdmin(userId);
    const photos = await orm
      .select({ photoId: photoTab.photoId })
      .from(photoTab)
      .where(isAdmin
        ? inArray(photoTab.photoId, params.photoIds)
        : and(
            eq(photoTab.userId, userId),
            inArray(photoTab.photoId, params.photoIds),
          ));
    const photoIds = Array.from(new Set(photos.map((photo) => photo.photoId)));

    if (!photoIds.length) {
      return;
    }

    const existsRows = await orm
      .select({
        albumId: albumPhotoTab.albumId,
        photoId: albumPhotoTab.photoId
      })
      .from(albumPhotoTab)
      .where(and(
        inArray(albumPhotoTab.albumId, albumIds),
        inArray(albumPhotoTab.photoId, photoIds)
      ));
    const existsKeys = new Set(existsRows.map((row) => `${row.albumId}:${row.photoId}`));
    const rows = albumIds.flatMap((albumId) => (
      photoIds
        .filter((photoId) => !existsKeys.has(`${albumId}:${photoId}`))
        .map((photoId) => ({
          id: createId(),
          photoId,
          albumId
        }))
    ));

    if (rows.length) {
      await orm.insert(albumPhotoTab).values(rows);
    }
  },

  // 把当前用户指定相册中的照片关联移除。
  async removePhoto(params: AlbumRemovePhotoBo, userId: string): Promise<void> {

    if (!params.albumId) {
      throw new BizError('album.selectRequired');
    }

    if (!params.photoIds?.length) {
      throw new BizError('photo.selectRequired');
    }

    await Promise.all(params.photoIds.map((photoId) => (
      albumPermissionService.assertCanRemoveOwnPhoto(userId, params.albumId, photoId)
    )));

    await orm.delete(albumPhotoTab)
      .where(and(
        eq(albumPhotoTab.albumId, params.albumId),
        inArray(albumPhotoTab.photoId, params.photoIds)
      ));

    const remainingRows = await orm
      .select({ photoId: albumPhotoTab.photoId })
      .from(albumPhotoTab)
      .where(inArray(albumPhotoTab.photoId, params.photoIds));
    const remainingPhotoIds = new Set(remainingRows.map((row) => row.photoId));
    const orphanPhotoIds = params.photoIds.filter((photoId) => !remainingPhotoIds.has(photoId));

    if (orphanPhotoIds.length) {
      await orm.update(photoTab)
        .set({
          status: PhotoStatusEnum.DELETE,
          recycleTime: new Date().toISOString(),
        })
        .where(inArray(photoTab.photoId, orphanPhotoIds));
    }

    await auditLogService.record({
      actorUserId: userId,
      action: 'album.photo.remove',
      targetType: 'album',
      targetId: params.albumId,
      details: {
        photoIds: params.photoIds,
        orphanPhotoIds,
      },
    });
  },

  // 修改当前用户指定相册的名称。
  async setName(params: AlbumSetNameBo, userId: string): Promise<void> {
    await albumPermissionService.assertAdmin(userId);
    const name = params.name?.trim();

    if (!name) {
      throw new BizError('album.nameRequired');
    }

    const [album] = await orm
      .select({ kind: albumTab.kind })
      .from(albumTab)
      .where(eq(albumTab.albumId, params.albumId))
      .limit(1);

    if (album?.kind === AlbumKindEnum.PERSONAL) {
      throw new BizError('album.personalProtected');
    }

    await orm.update(albumTab)
      .set({
        name,
        updateTime: new Date().toISOString()
      })
      .where(eq(albumTab.albumId, params.albumId));
  },

  // 把当前用户指定相册置顶。
  async setTop(params: AlbumSetTopBo, userId: string): Promise<void> {
    await albumPermissionService.assertAdmin(userId);
    const [album] = await orm
      .select({ kind: albumTab.kind })
      .from(albumTab)
      .where(eq(albumTab.albumId, params.albumId))
      .limit(1);

    if (album?.kind === AlbumKindEnum.PERSONAL) {
      throw new BizError('album.personalProtected');
    }

    await orm.update(albumTab)
      .set({
        sort: Date.now(),
        updateTime: new Date().toISOString()
      })
      .where(eq(albumTab.albumId, params.albumId));
  },

  // 删除当前用户指定相册，并清理相册照片关联。
  async delete(params: AlbumDeleteBo, userId: string): Promise<void> {

    await albumPermissionService.assertAdmin(userId);
    const [album] = await orm
      .select({ name: albumTab.name, kind: albumTab.kind })
      .from(albumTab)
      .where(eq(albumTab.albumId, params.albumId))
      .limit(1);

    if (album?.kind === AlbumKindEnum.PERSONAL) {
      throw new BizError('album.personalProtected');
    }

    await orm.delete(albumPhotoTab)
      .where(eq(albumPhotoTab.albumId, params.albumId));

    await orm.delete(albumTab)
      .where(eq(albumTab.albumId, params.albumId));

    await auditLogService.record({
      actorUserId: userId,
      action: 'album.delete',
      targetType: 'album',
      targetId: params.albumId,
      targetName: album?.name ?? null,
    });

  },

  // 删除指定用户的全部相册，并清理这些相册的照片关联。
  async deleteByUserId(userId: string): Promise<void> {

    const albumList = await orm
      .select({
        albumId: albumTab.albumId
      })
      .from(albumTab)
      .where(eq(albumTab.userId, userId));

    const albumIds = albumList.map((album) => album.albumId);

    for (let index = 0; index < albumIds.length; index += 95) {

      const deleteAlbumIds = albumIds.slice(index, index + 95);
      await orm.delete(albumPhotoTab)
        .where(inArray(albumPhotoTab.albumId, deleteAlbumIds));
    }

    await orm.delete(albumTab)
      .where(eq(albumTab.userId, userId));
  },

  // 查询当前用户回收站虚拟相册，并统计已回收照片数量和最新回收封面。
  async trash(userId: string): Promise<AlbumVo> {
    await albumPermissionService.assertAdmin(userId);
    const fileStorageList = await storageService.list();
    const photoList = await orm
      .select()
      .from(photoTab)
      .where(eq(photoTab.status, PhotoStatusEnum.DELETE))
      .orderBy(desc(photoTab.recycleTime))
    const coverPhoto = photoList[0];
    const fileStorage = fileStorageList.list.find((item) => item.storageId === coverPhoto?.storageId);
    const domain = formatHttpUrl(fileStorage?.domain);

    const fileMap = coverPhoto
      ? await fileService.listByPhotoIds([coverPhoto.photoId])
      : new Map<string, File[]>();

    const thumbnail = coverPhoto
      ? (fileMap.get(coverPhoto.photoId) ?? []).find((file) => file.type === FileTypeEnum.THUMBNAIL)?.key ?? null
      : null;

    const now = new Date().toISOString();

    return {
      albumId: 'trash',
      name: 'trash.title',
      description: '',
      kind: AlbumKindEnum.SHARED,
      sort: 0,
      createTime: now,
      updateTime: now,
      userId,
      ownerName: null,
      thumbnail: thumbnail ? toMediaUrl(thumbnail, domain, fileStorage?.type) : null,
      thumbHash: coverPhoto?.thumbHash ?? null,
      photoTotal: photoList.length,
      canUpload: false,
      canDeleteOwn: false,
    };
  }
}

export { albumService };
