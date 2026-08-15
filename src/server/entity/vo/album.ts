import { type Album } from '@/server/entity/album';

// 这个模块定义相册接口返回对象。

interface AlbumVo extends Album {
  ownerName: string | null;
  thumbnail: string | null;
  thumbHash: string | null;
  photoTotal: number;
  canUpload: boolean;
  canDeleteOwn: boolean;
}

export type { AlbumVo };
