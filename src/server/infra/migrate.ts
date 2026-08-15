import { SETTING_KEY } from '@/server/const/global';
import { type Setting } from '@/server/entity/setting';
import { SettingPhotoDedupEnum, SettingSyncDeleteEnum } from '@/server/enums/setting-enum';
import { db, turso } from '@/server/infra/db';

// 这个模块负责数据库表结构初始化。

// 系统设置默认值，仅用于建表种子数据。
const settingDefaults: Setting = {
  syncDelete: SettingSyncDeleteEnum.ENABLE,
  clearLast: 7,
  photoDedup: SettingPhotoDedupEnum.ENABLE
};

const createTableSqlList = [
  `CREATE TABLE IF NOT EXISTS user (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        salt TEXT NOT NULL,
        avatar TEXT NOT NULL DEFAULT '',
        type INTEGER NOT NULL DEFAULT 2,
        status INTEGER NOT NULL DEFAULT 0,
        create_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )`,

  `CREATE TABLE IF NOT EXISTS avatar_base64 (
        id TEXT PRIMARY KEY,
        base64 TEXT NOT NULL
    )`,

  `CREATE TABLE IF NOT EXISTS album (
        album_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        sort INTEGER NOT NULL DEFAULT 0,
        create_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        update_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        user_id TEXT NOT NULL
    )`,

  `CREATE TABLE IF NOT EXISTS photo (
        photo_id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        thumb_hash TEXT,
        checksum TEXT,
        type TEXT NOT NULL,
        type_desc TEXT NOT NULL,
        size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        taken_time TEXT,
        create_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
        recycle_time TEXT,
        user_id TEXT NOT NULL,
        status INTEGER NOT NULL DEFAULT 1,
        favorite INTEGER NOT NULL DEFAULT 1,
        storage_id TEXT
    )`,
  `CREATE INDEX IF NOT EXISTS idx_photo_user_status_taken_time
        ON photo (user_id, status, taken_time)`,
  `CREATE INDEX IF NOT EXISTS idx_photo_status_recycle_time
        ON photo (status, recycle_time)`,

  `CREATE TABLE IF NOT EXISTS file (
        file_id TEXT PRIMARY KEY NOT NULL,
        photo_id TEXT NOT NULL,
        key TEXT NOT NULL,
        type INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        size INTEGER NOT NULL
    )`,
  `CREATE INDEX IF NOT EXISTS idx_file_photo_id ON file (photo_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_file_key ON file (key)`,

  `CREATE TABLE IF NOT EXISTS exif (
        photo_id TEXT PRIMARY KEY NOT NULL REFERENCES photo(photo_id) ON DELETE CASCADE,
        exif TEXT,
        latitude REAL,
        longitude REAL,
        altitude REAL
    )`,

  `CREATE TABLE IF NOT EXISTS album_photo (
        id TEXT PRIMARY KEY NOT NULL,
        photo_id TEXT NOT NULL,
        album_id TEXT NOT NULL
    )`,

  `CREATE TABLE IF NOT EXISTS storage (
        storage_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type INTEGER NOT NULL,
        domain TEXT,
        bucket TEXT,
        region TEXT,
        endpoint TEXT,
        access_key TEXT,
        secret_key TEXT,
        user_id TEXT,
        sort INTEGER NOT NULL DEFAULT 0,
        status INTEGER DEFAULT 0
    )`,
  `INSERT OR IGNORE INTO storage (storage_id, name, type, sort, status)
        VALUES ('local', 'Local', 1, 0, 0)`,
  `UPDATE storage SET name = 'Local' WHERE storage_id = 'local' AND name = '本地存储'`,

  `INSERT OR IGNORE INTO storage (storage_id, name, type, sort, status)
        VALUES ('blob', 'Blob', 3, 0, 0)`,

  `CREATE TABLE IF NOT EXISTS setting (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )`,
  `INSERT OR IGNORE INTO setting (key, value)
        VALUES ('${SETTING_KEY}', '${JSON.stringify(settingDefaults)}')`,

  `CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expire_time INTEGER
    )`,
];

// 版本化迁移记录，避免结构升级在每次启动时重复执行。
const schemaMigrationTableSql = `CREATE TABLE IF NOT EXISTS schema_migration (
    version TEXT PRIMARY KEY,
    applied_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
)`;

const migrationList = [
  {
    version: '2026081501_album_member',
    sqlList: [
      `CREATE TABLE IF NOT EXISTS album_member (
          id TEXT PRIMARY KEY,
          album_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          can_view INTEGER NOT NULL DEFAULT 0,
          can_upload INTEGER NOT NULL DEFAULT 0,
          can_delete_own INTEGER NOT NULL DEFAULT 0,
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL,
          UNIQUE(album_id, user_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_album_member_user_view_album
          ON album_member (user_id, can_view, album_id)`,
      `INSERT OR IGNORE INTO album_member (
          id, album_id, user_id, can_view, can_upload, can_delete_own, create_time, update_time
      )
      SELECT
          'migration-' || album_id || '-' || user_id,
          album_id,
          user_id,
          1,
          1,
          1,
          strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
          strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      FROM album`,
    ],
  },
  {
    version: '2026081502_photo_favorite',
    sqlList: [
      `CREATE TABLE IF NOT EXISTS photo_favorite (
          id TEXT PRIMARY KEY,
          photo_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          create_time TEXT NOT NULL,
          UNIQUE(photo_id, user_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_photo_favorite_user_time
          ON photo_favorite (user_id, create_time)`,
      `INSERT OR IGNORE INTO photo_favorite (id, photo_id, user_id, create_time)
      SELECT
          'migration-' || photo_id || '-' || user_id,
          photo_id,
          user_id,
          strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      FROM photo
      WHERE favorite = 2`,
    ],
  },
  {
    version: '2026081503_photo_comment',
    sqlList: [
      `CREATE TABLE IF NOT EXISTS photo_comment (
          comment_id TEXT PRIMARY KEY,
          photo_id TEXT NOT NULL,
          user_id TEXT,
          author_name TEXT NOT NULL,
          body TEXT NOT NULL,
          x_ratio REAL NOT NULL,
          y_ratio REAL NOT NULL,
          status INTEGER NOT NULL DEFAULT 1,
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_photo_comment_photo_status_time
          ON photo_comment (photo_id, status, create_time)`,
      `CREATE INDEX IF NOT EXISTS idx_photo_comment_user
          ON photo_comment (user_id)`,
    ],
  },
];

// 在 Turso 上顺序执行尚未应用的版本化迁移。
async function migrateTurso(): Promise<void> {
  await turso!.batch([
    ...createTableSqlList.map((sql) => ({ sql })),
    { sql: schemaMigrationTableSql },
  ], 'write');

  const appliedResult = await turso!.execute('SELECT version FROM schema_migration');
  const appliedVersions = new Set(appliedResult.rows.map((row) => String(row.version)));

  for (const migration of migrationList) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    await turso!.batch([
      ...migration.sqlList.map((sql) => ({ sql })),
      {
        sql: 'INSERT INTO schema_migration (version) VALUES (?)',
        args: [migration.version],
      },
    ], 'write');
  }
}

// 在本地 SQLite 事务中执行尚未应用的版本化迁移。
function migrateSqlite(): void {
  const runBatch = db!.transaction(() => {
    for (const sql of createTableSqlList) {
      db!.exec(sql);
    }

    db!.exec(schemaMigrationTableSql);
    const appliedRows = db!.prepare('SELECT version FROM schema_migration').all() as { version: string }[];
    const appliedVersions = new Set(appliedRows.map((row) => row.version));

    for (const migration of migrationList) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      for (const sql of migration.sqlList) {
        db!.exec(sql);
      }

      db!.prepare('INSERT INTO schema_migration (version) VALUES (?)').run(migration.version);
    }
  });

  runBatch();
}

// 执行全部建表语句，已存在的表会自动跳过。
async function migrate(): Promise<void> {

  if (process.env.TURSO_DATABASE_URL) {
    await migrateTurso();
    return;
  }

  migrateSqlite();
}

export { migrate };
