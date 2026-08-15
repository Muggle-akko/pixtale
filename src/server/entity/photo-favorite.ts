import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

// 这个模块定义用户自己的照片收藏关系。

export const photoFavoriteTab = sqliteTable('photo_favorite', {
  id: text('id').primaryKey(),
  photoId: text('photo_id').notNull(),
  userId: text('user_id').notNull(),
  createTime: text('create_time').notNull(),
}, (table) => [
  uniqueIndex('idx_photo_favorite_photo_user').on(table.photoId, table.userId),
  index('idx_photo_favorite_user_time').on(table.userId, table.createTime),
]);

export type PhotoFavorite = typeof photoFavoriteTab.$inferSelect;
export type PhotoFavoriteInto = typeof photoFavoriteTab.$inferInsert;
