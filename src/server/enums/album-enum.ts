// 这个模块定义相册类型，区分共享相册和系统个人相册。

const AlbumKindEnum = {
  SHARED: 1,
  PERSONAL: 2,
} as const;

export { AlbumKindEnum };
