import { desc, eq } from 'drizzle-orm';
import { auditLogTab } from '@/server/entity/audit-log';
import { type AuditLogVo } from '@/server/entity/vo/audit-log';
import { userTab } from '@/server/entity/user';
import { orm } from '@/server/infra/db';
import { createId } from '@/server/lib/id';
import { UserTypeEnum } from '@/server/enums/user-enum';
import BizError from '@/server/error/biz-error';

type AuditRecord = {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName?: string | null;
  details?: Record<string, unknown> | null;
}

// 这个模块保存权限变更和删除类关键操作；记录失败不回滚已完成的业务操作。
const auditLogService = {

  async record(params: AuditRecord): Promise<void> {
    try {
      const [actor] = await orm
        .select({ username: userTab.username })
        .from(userTab)
        .where(eq(userTab.userId, params.actorUserId))
        .limit(1);

      await orm.insert(auditLogTab).values({
        auditId: createId(),
        actorUserId: actor ? params.actorUserId : null,
        actorName: actor?.username ?? 'deleted-user',
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        targetName: params.targetName ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
        createTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to write audit log', error);
    }
  },

  async list(userId: string, limit = 200): Promise<AuditLogVo[]> {
    const [user] = await orm
      .select({ type: userTab.type })
      .from(userTab)
      .where(eq(userTab.userId, userId))
      .limit(1);

    if (user?.type !== UserTypeEnum.ADMIN) {
      throw new BizError('auth.forbidden', 403);
    }
    const safeLimit = Math.min(500, Math.max(1, limit));
    const rows = await orm
      .select()
      .from(auditLogTab)
      .orderBy(desc(auditLogTab.createTime))
      .limit(safeLimit);

    return rows.map((row) => {
      let details: Record<string, unknown> | null = null;

      if (row.details) {
        try {
          details = JSON.parse(row.details) as Record<string, unknown>;
        } catch {
          details = null;
        }
      }

      return {
        auditId: row.auditId,
        actorName: row.actorName,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        targetName: row.targetName,
        details,
        createTime: row.createTime,
      };
    });
  },
};

export { auditLogService };
