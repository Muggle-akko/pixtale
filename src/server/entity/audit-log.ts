import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// 这个模块定义管理员可查看的关键操作记录。

export const auditLogTab = sqliteTable('audit_log', {
  auditId: text('audit_id').primaryKey(),
  actorUserId: text('actor_user_id'),
  actorName: text('actor_name').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id'),
  targetName: text('target_name'),
  details: text('details'),
  createTime: text('create_time').notNull(),
}, (table) => [
  index('idx_audit_log_create_time').on(table.createTime),
  index('idx_audit_log_actor_time').on(table.actorUserId, table.createTime),
]);

export type AuditLog = typeof auditLogTab.$inferSelect;
