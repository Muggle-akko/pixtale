import { and, eq, inArray } from 'drizzle-orm';
import BizError from '@/server/error/biz-error';
import { type PhotoFavoriteBo } from '@/server/entity/bo/photo';
import { photoFavoriteTab } from '@/server/entity/photo-favorite';
import { PhotoFavoriteEnum } from '@/server/enums/photo-enum';
import { orm } from '@/server/infra/db';
import { createId } from '@/server/lib/id';
import { albumPermissionService } from '@/server/service/album-permission-service';

// 这个模块处理每个用户独立的照片收藏关系。

const photoFavoriteService = {

  // 列出当前用户收藏的全部照片 id。
  async listPhotoIds(userId: string): Promise<string[]> {
    const rows = await orm
      .select({ photoId: photoFavoriteTab.photoId })
      .from(photoFavoriteTab)
      .where(eq(photoFavoriteTab.userId, userId));

    return rows.map((row) => row.photoId);
  },

  // 设置当前用户指定照片的收藏状态。
  async set(params: PhotoFavoriteBo, userId: string): Promise<void> {
    if (!params.photoIds?.length) {
      throw new BizError('photo.selectRequired');
    }

    if (!params.favorite) {
      throw new BizError('photo.favoriteRequired');
    }

    const uniquePhotoIds = Array.from(new Set(params.photoIds));
    const accessList = await Promise.all(uniquePhotoIds.map(async (photoId) => ({
      photoId,
      canView: await albumPermissionService.canViewPhoto(userId, photoId),
    })));
    const photoIds = accessList.filter((item) => item.canView).map((item) => item.photoId);

    if (photoIds.length !== uniquePhotoIds.length) {
      throw new BizError('auth.notFound', 404);
    }

    if (params.favorite === PhotoFavoriteEnum.YES) {
      const now = new Date().toISOString();
      await orm.insert(photoFavoriteTab).values(photoIds.map((photoId) => ({
        id: createId(),
        photoId,
        userId,
        createTime: now,
      }))).onConflictDoNothing();
      return;
    }

    await orm.delete(photoFavoriteTab).where(and(
      eq(photoFavoriteTab.userId, userId),
      inArray(photoFavoriteTab.photoId, photoIds),
    ));
  },
};

export { photoFavoriteService };
