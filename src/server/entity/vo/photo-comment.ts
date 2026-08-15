// 这个模块定义空间评论接口返回值。

interface PhotoCommentVo {
  commentId: string;
  photoId: string;
  authorName: string;
  body: string;
  xRatio: number;
  yRatio: number;
  createTime: string;
  updateTime: string;
  isOwn: boolean;
  canDelete: boolean;
  authorDeleted: boolean;
}

export type { PhotoCommentVo };
