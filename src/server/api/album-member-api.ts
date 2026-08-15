import { Context } from 'hono';
import { app } from '../hono/hono';
import { type AlbumMemberBatchSetBo, type AlbumMemberListBo, type AlbumMemberRemoveBo, type AlbumMemberSetBo, type AlbumMemberUserListBo } from '@/server/entity/bo/album-member';
import result from '@/server/model/result';
import { albumPermissionService } from '@/server/service/album-permission-service';
import { getUserId } from '@/server/security/context';

// 这个模块注册管理员使用的相册成员权限接口。

// 查询指定相册的成员权限。
app.post('/album/member/list', async (c: Context) => {
  const body = await c.req.json<AlbumMemberListBo>();
  const data = await albumPermissionService.listMembers(body.albumId, getUserId());
  return c.json(result.ok(data));
});

// 按指定成员查询全部共享相册权限。
app.post('/album/member/userList', async (c: Context) => {
  const body = await c.req.json<AlbumMemberUserListBo>();
  const data = await albumPermissionService.listAlbumsForMember(body.userId, getUserId());
  return c.json(result.ok(data));
});

// 新增或更新成员在指定相册中的权限。
app.post('/album/member/set', async (c: Context) => {
  const body = await c.req.json<AlbumMemberSetBo>();
  await albumPermissionService.setMemberPermission(body, getUserId());
  return c.json(result.ok());
});

// 移除成员在指定相册中的权限。
app.post('/album/member/remove', async (c: Context) => {
  const body = await c.req.json<AlbumMemberRemoveBo>();
  await albumPermissionService.removeMemberPermission(body.albumId, body.userId, getUserId());
  return c.json(result.ok());
});

// 为多个成员批量设置同一组权限。
app.post('/album/member/batchSet', async (c: Context) => {
  const body = await c.req.json<AlbumMemberBatchSetBo>();
  await albumPermissionService.batchSetMemberPermission(body, getUserId());
  return c.json(result.ok());
});
