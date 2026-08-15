import { http } from '@/request/request';
import { type PhotoCommentAddBo, type PhotoCommentDeleteBo, type PhotoCommentListBo, type PhotoCommentUpdateBo } from '@/server/entity/bo/photo-comment';
import { type PhotoCommentVo } from '@/server/entity/vo/photo-comment';

// 这个模块封装照片空间评论接口请求。

export function photoCommentList(params: PhotoCommentListBo) {
  return http.post<PhotoCommentVo[]>('/photo/comment/list', params);
}

export function photoCommentAdd(params: PhotoCommentAddBo) {
  return http.post<PhotoCommentVo>('/photo/comment/add', params);
}

export function photoCommentUpdate(params: PhotoCommentUpdateBo) {
  return http.post<void>('/photo/comment/update', params);
}

export function photoCommentDelete(params: PhotoCommentDeleteBo) {
  return http.post<void>('/photo/comment/delete', params);
}
