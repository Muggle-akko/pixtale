// 这个模块定义相册成员权限接口返回对象。

interface AlbumPermission {
  albumId: string;
  canView: boolean;
  canUpload: boolean;
  canDeleteOwn: boolean;
  isAdmin: boolean;
}

interface AlbumMemberVo {
  userId: string;
  username: string;
  avatar: string;
  status: number;
  canView: boolean;
  canUpload: boolean;
  canDeleteOwn: boolean;
}

export type { AlbumMemberVo, AlbumPermission };
