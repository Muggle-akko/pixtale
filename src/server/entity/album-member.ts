import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// 这个模块定义成员在单个相册中的权限。

export const albumMemberTab = sqliteTable('album_member', {
  id: text('id').primaryKey(),
  albumId: text('album_id').notNull(),
  userId: text('user_id').notNull(),
  canView: integer('can_view').default(0).notNull(),
  canUpload: integer('can_upload').default(0).notNull(),
  canDeleteOwn: integer('can_delete_own').default(0).notNull(),
  createTime: text('create_time').notNull(),
  updateTime: text('update_time').notNull(),
}, (table) => [
  uniqueIndex('idx_album_member_album_user').on(table.albumId, table.userId),
  index('idx_album_member_user_view_album').on(table.userId, table.canView, table.albumId),
]);

export type AlbumMember = typeof albumMemberTab.$inferSelect;
export type AlbumMemberInto = typeof albumMemberTab.$inferInsert;
