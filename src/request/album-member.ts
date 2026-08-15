import { http } from '@/request/request';
import { type AlbumMemberListBo, type AlbumMemberRemoveBo, type AlbumMemberSetBo } from '@/server/entity/bo/album-member';
import { type AlbumMemberVo } from '@/server/entity/vo/album-member';

// 这个模块封装管理员使用的相册成员权限接口。

// 查询指定相册的成员权限。
export function albumMemberList(params: AlbumMemberListBo) {
  return http.post<AlbumMemberVo[]>('/album/member/list', params);
}

// 新增或更新成员在指定相册中的权限。
export function albumMemberSet(params: AlbumMemberSetBo) {
  return http.post<void>('/album/member/set', params);
}

// 移除成员在指定相册中的全部权限。
export function albumMemberRemove(params: AlbumMemberRemoveBo) {
  return http.post<void>('/album/member/remove', params);
}
