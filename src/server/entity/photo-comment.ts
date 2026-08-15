import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// 这个模块定义照片上的空间评论。

export const photoCommentTab = sqliteTable('photo_comment', {
  commentId: text('comment_id').primaryKey(),
  photoId: text('photo_id').notNull(),
  userId: text('user_id'),
  authorName: text('author_name').notNull(),
  body: text('body').notNull(),
  xRatio: real('x_ratio').notNull(),
  yRatio: real('y_ratio').notNull(),
  status: integer('status').default(1).notNull(),
  createTime: text('create_time').notNull(),
  updateTime: text('update_time').notNull(),
}, (table) => [
  index('idx_photo_comment_photo_status_time').on(table.photoId, table.status, table.createTime),
  index('idx_photo_comment_user').on(table.userId),
]);

export type PhotoComment = typeof photoCommentTab.$inferSelect;
export type PhotoCommentInto = typeof photoCommentTab.$inferInsert;
