import { http } from '@/request/request';
import { type AlbumMemberBatchSetBo, type AlbumMemberListBo, type AlbumMemberRemoveBo, type AlbumMemberSetBo, type AlbumMemberUserListBo } from '@/server/entity/bo/album-member';
import { type AlbumMemberVo, type UserAlbumPermissionVo } from '@/server/entity/vo/album-member';

// 这个模块封装管理员使用的相册成员权限接口。

// 查询指定相册的成员权限。
export function albumMemberList(params: AlbumMemberListBo) {
  return http.post<AlbumMemberVo[]>('/album/member/list', params);
}

// 按成员查询全部共享相册权限。
export function albumMemberUserList(params: AlbumMemberUserListBo) {
  return http.post<UserAlbumPermissionVo[]>('/album/member/userList', params);
}

// 新增或更新成员在指定相册中的权限。
export function albumMemberSet(params: AlbumMemberSetBo) {
  return http.post<void>('/album/member/set', params);
}

// 移除成员在指定相册中的全部权限。
export function albumMemberRemove(params: AlbumMemberRemoveBo) {
  return http.post<void>('/album/member/remove', params);
}

// 为多个成员批量设置同一组权限。
export function albumMemberBatchSet(params: AlbumMemberBatchSetBo) {
  return http.post<void>('/album/member/batchSet', params);
}
