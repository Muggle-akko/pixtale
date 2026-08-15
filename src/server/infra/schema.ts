import { albumTab } from '@/server/entity/album';
import { albumMemberTab } from '@/server/entity/album-member';
import { albumPhotoTab } from '@/server/entity/album-photo';
import { avatarBase64Tab } from '@/server/entity/avatar-base64';
import { cacheTab } from '@/server/entity/cache';
import { exifTab } from '@/server/entity/exif';
import { fileTab } from '@/server/entity/file';
import { photoTab } from '@/server/entity/photo';
import { photoFavoriteTab } from '@/server/entity/photo-favorite';
import { settingTab } from '@/server/entity/setting';
import { storageTab } from '@/server/entity/storage';
import { userTab } from '@/server/entity/user';

// 这个模块统一导出 Drizzle 数据库表结构。

const schema = {
  albumMemberTab,
  albumPhotoTab,
  albumTab,
  avatarBase64Tab,
  cacheTab,
  exifTab,
  fileTab,
  photoTab,
  photoFavoriteTab,
  settingTab,
  storageTab,
  userTab
};

export { schema };
