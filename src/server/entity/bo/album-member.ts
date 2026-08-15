// 这个模块定义相册成员权限接口入参。

interface AlbumMemberListBo {
  albumId: string;
}

interface AlbumMemberSetBo {
  albumId: string;
  userId: string;
  canView: boolean;
  canUpload: boolean;
  canDeleteOwn: boolean;
}

interface AlbumMemberRemoveBo {
  albumId: string;
  userId: string;
}

interface AlbumMemberBatchSetBo {
  albumId: string;
  userIds: string[];
  canView: boolean;
  canUpload: boolean;
  canDeleteOwn: boolean;
}

export type { AlbumMemberBatchSetBo, AlbumMemberListBo, AlbumMemberRemoveBo, AlbumMemberSetBo };
