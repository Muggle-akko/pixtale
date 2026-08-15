// 这个模块定义空间评论接口入参。

interface PhotoCommentListBo {
  photoId: string;
}

interface PhotoCommentAddBo {
  photoId: string;
  body: string;
  xRatio: number;
  yRatio: number;
}

interface PhotoCommentUpdateBo {
  commentId: string;
  body: string;
}

interface PhotoCommentDeleteBo {
  commentId: string;
}

export type { PhotoCommentAddBo, PhotoCommentDeleteBo, PhotoCommentListBo, PhotoCommentUpdateBo };
