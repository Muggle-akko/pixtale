import { Context } from 'hono';
import { app } from '../hono/hono';
import { type AlbumMemberListBo, type AlbumMemberRemoveBo, type AlbumMemberSetBo } from '@/server/entity/bo/album-member';
import result from '@/server/model/result';
import { albumPermissionService } from '@/server/service/album-permission-service';

// 这个模块注册管理员使用的相册成员权限接口。

// 查询指定相册的成员权限。
app.post('/album/member/list', async (c: Context) => {
  const body = await c.req.json<AlbumMemberListBo>();
  const data = await albumPermissionService.listMembers(body.albumId);
  return c.json(result.ok(data));
});

// 新增或更新成员在指定相册中的权限。
app.post('/album/member/set', async (c: Context) => {
  const body = await c.req.json<AlbumMemberSetBo>();
  await albumPermissionService.setMemberPermission(body);
  return c.json(result.ok());
});

// 移除成员在指定相册中的权限。
app.post('/album/member/remove', async (c: Context) => {
  const body = await c.req.json<AlbumMemberRemoveBo>();
  await albumPermissionService.removeMemberPermission(body.albumId, body.userId);
  return c.json(result.ok());
});
