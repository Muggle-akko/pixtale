import { Context } from 'hono';
import { app } from '../hono/hono';
import { type PhotoCommentAddBo, type PhotoCommentDeleteBo, type PhotoCommentListBo, type PhotoCommentUpdateBo } from '@/server/entity/bo/photo-comment';
import result from '@/server/model/result';
import { getUserId } from '@/server/security/context';
import { photoCommentService } from '@/server/service/photo-comment-service';

// 这个模块注册照片空间评论接口。

app.post('/photo/comment/list', async (c: Context) => {
  const body = await c.req.json<PhotoCommentListBo>();
  const data = await photoCommentService.list(body.photoId, getUserId());
  return c.json(result.ok(data));
});

app.post('/photo/comment/add', async (c: Context) => {
  const body = await c.req.json<PhotoCommentAddBo>();
  const data = await photoCommentService.add(body, getUserId());
  return c.json(result.ok(data));
});

app.post('/photo/comment/update', async (c: Context) => {
  const body = await c.req.json<PhotoCommentUpdateBo>();
  await photoCommentService.update(body, getUserId());
  return c.json(result.ok());
});

app.post('/photo/comment/delete', async (c: Context) => {
  const body = await c.req.json<PhotoCommentDeleteBo>();
  await photoCommentService.delete(body.commentId, getUserId());
  return c.json(result.ok());
});
