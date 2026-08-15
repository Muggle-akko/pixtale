import { and, eq } from 'drizzle-orm';
import BizError from '@/server/error/biz-error';
import { type PhotoCommentAddBo, type PhotoCommentUpdateBo } from '@/server/entity/bo/photo-comment';
import { photoCommentTab } from '@/server/entity/photo-comment';
import { type PhotoCommentVo } from '@/server/entity/vo/photo-comment';
import { orm } from '@/server/infra/db';
import { createId } from '@/server/lib/id';
import { albumPermissionService } from '@/server/service/album-permission-service';
import { userTab } from '@/server/entity/user';
import { auditLogService } from '@/server/service/audit-log-service';

const NORMAL_STATUS = 1;
const MAX_COMMENT_LENGTH = 200;

function normalizeBody(body: string): string {
  const value = body.trim();

  if (!value) {
    throw new BizError('comment.bodyRequired');
  }

  if (value.length > MAX_COMMENT_LENGTH) {
    throw new BizError('comment.bodyTooLong');
  }

  return value;
}

function assertRatio(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new BizError('comment.positionInvalid');
  }
}

// 这个模块处理照片空间评论，并在每次操作前校验照片可见性。
const photoCommentService = {

  async list(photoId: string, userId: string): Promise<PhotoCommentVo[]> {
    await albumPermissionService.assertCanViewPhoto(userId, photoId);
    const isAdmin = await albumPermissionService.isAdmin(userId);

    const rows = await orm
      .select()
      .from(photoCommentTab)
      .where(and(
        eq(photoCommentTab.photoId, photoId),
        eq(photoCommentTab.status, NORMAL_STATUS),
      ))
      .orderBy(photoCommentTab.createTime);

    return rows.map((row) => ({
      commentId: row.commentId,
      photoId: row.photoId,
      authorName: row.authorName,
      body: row.body,
      xRatio: row.xRatio,
      yRatio: row.yRatio,
      createTime: row.createTime,
      updateTime: row.updateTime,
      isOwn: row.userId === userId,
      canDelete: isAdmin || row.userId === userId,
      authorDeleted: row.userId === null,
    }));
  },

  async add(params: PhotoCommentAddBo, userId: string): Promise<PhotoCommentVo> {
    await albumPermissionService.assertCanViewPhoto(userId, params.photoId);
    assertRatio(params.xRatio);
    assertRatio(params.yRatio);
    const body = normalizeBody(params.body);

    const [user] = await orm
      .select({ username: userTab.username })
      .from(userTab)
      .where(eq(userTab.userId, userId))
      .limit(1);

    if (!user) {
      throw new BizError('auth.failed', 401);
    }

    const now = new Date().toISOString();
    const commentId = createId();
    await orm.insert(photoCommentTab).values({
      commentId,
      photoId: params.photoId,
      userId,
      authorName: user.username,
      body,
      xRatio: params.xRatio,
      yRatio: params.yRatio,
      status: NORMAL_STATUS,
      createTime: now,
      updateTime: now,
    });

    return {
      commentId,
      photoId: params.photoId,
      authorName: user.username,
      body,
      xRatio: params.xRatio,
      yRatio: params.yRatio,
      createTime: now,
      updateTime: now,
      isOwn: true,
      canDelete: true,
      authorDeleted: false,
    };
  },

  async update(params: PhotoCommentUpdateBo, userId: string): Promise<void> {
    const [comment] = await orm
      .select()
      .from(photoCommentTab)
      .where(and(
        eq(photoCommentTab.commentId, params.commentId),
        eq(photoCommentTab.status, NORMAL_STATUS),
      ))
      .limit(1);

    if (!comment) {
      throw new BizError('auth.notFound', 404);
    }

    await albumPermissionService.assertCanViewPhoto(userId, comment.photoId);
    if (comment.userId !== userId) {
      throw new BizError('auth.notFound', 404);
    }

    await orm.update(photoCommentTab)
      .set({
        body: normalizeBody(params.body),
        updateTime: new Date().toISOString(),
      })
      .where(eq(photoCommentTab.commentId, params.commentId));
  },

  async delete(commentId: string, userId: string): Promise<void> {
    const [comment] = await orm
      .select()
      .from(photoCommentTab)
      .where(and(
        eq(photoCommentTab.commentId, commentId),
        eq(photoCommentTab.status, NORMAL_STATUS),
      ))
      .limit(1);

    if (!comment) {
      throw new BizError('auth.notFound', 404);
    }

    await albumPermissionService.assertCanViewPhoto(userId, comment.photoId);
    const isAdmin = await albumPermissionService.isAdmin(userId);
    if (!isAdmin && comment.userId !== userId) {
      throw new BizError('auth.notFound', 404);
    }

    await orm.delete(photoCommentTab).where(eq(photoCommentTab.commentId, commentId));
    await auditLogService.record({
      actorUserId: userId,
      action: 'comment.delete',
      targetType: 'photo-comment',
      targetId: commentId,
      details: { photoId: comment.photoId },
    });
  },
};

export { photoCommentService };
