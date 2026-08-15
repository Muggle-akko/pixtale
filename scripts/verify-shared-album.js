const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createJiti } = require('jiti')

const projectRoot = path.resolve(__dirname, '..')
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixtale-shared-album-'))
const jiti = createJiti(__filename, { tsconfigPaths: true })

async function main() {
  process.chdir(testDir)
  process.env.VERCEL = '1'
  process.env.JWT_SECRET = 'shared-album-verification-secret'

  const [
    { migrate },
    { db, orm },
    { userTab },
    { albumTab },
    { photoTab },
    { albumPhotoTab },
    { albumMemberTab },
    { photoFavoriteTab },
    { fileTab },
    { UserTypeEnum },
    { albumPermissionService },
    { albumService },
    { photoFavoriteService },
    { photoService },
    { photoCommentService },
    { userService },
    { auditLogService },
    { loginService },
    { createLoginToken },
    { media },
    { screenPointToPhotoRatio },
  ] = await Promise.all([
    jiti.import(path.join(projectRoot, 'src/server/infra/migrate.ts')),
    jiti.import(path.join(projectRoot, 'src/server/infra/db.ts')),
    jiti.import(path.join(projectRoot, 'src/server/entity/user.ts')),
    jiti.import(path.join(projectRoot, 'src/server/entity/album.ts')),
    jiti.import(path.join(projectRoot, 'src/server/entity/photo.ts')),
    jiti.import(path.join(projectRoot, 'src/server/entity/album-photo.ts')),
    jiti.import(path.join(projectRoot, 'src/server/entity/album-member.ts')),
    jiti.import(path.join(projectRoot, 'src/server/entity/photo-favorite.ts')),
    jiti.import(path.join(projectRoot, 'src/server/entity/file.ts')),
    jiti.import(path.join(projectRoot, 'src/server/enums/user-enum.ts')),
    jiti.import(path.join(projectRoot, 'src/server/service/album-permission-service.ts')),
    jiti.import(path.join(projectRoot, 'src/server/service/album-service.ts')),
    jiti.import(path.join(projectRoot, 'src/server/service/photo-favorite-service.ts')),
    jiti.import(path.join(projectRoot, 'src/server/service/photo-service.ts')),
    jiti.import(path.join(projectRoot, 'src/server/service/photo-comment-service.ts')),
    jiti.import(path.join(projectRoot, 'src/server/service/user-service.ts')),
    jiti.import(path.join(projectRoot, 'src/server/service/audit-log-service.ts')),
    jiti.import(path.join(projectRoot, 'src/server/service/login-service.ts')),
    jiti.import(path.join(projectRoot, 'src/server/lib/jwt.ts')),
    jiti.import(path.join(projectRoot, 'src/server/hono/media.ts')),
    jiti.import(path.join(projectRoot, 'src/lib/photo-comment-position.ts')),
  ])

  try {
    await migrate()
    const now = new Date().toISOString()
    const users = [
      { userId: 'admin', username: 'admin', type: UserTypeEnum.ADMIN },
      { userId: 'member-a', username: 'member-a', type: UserTypeEnum.NORMAL },
      { userId: 'member-b', username: 'member-b', type: UserTypeEnum.NORMAL },
    ]
    await orm.insert(userTab).values(users.map((user) => ({
      ...user,
      password: 'test-password-hash',
      salt: 'test-salt',
      avatar: '',
      status: 1,
      createTime: now,
    })))
    await orm.insert(albumTab).values([
      { albumId: 'album-visible', name: 'Visible', userId: 'admin', sort: 0, createTime: now, updateTime: now },
      { albumId: 'album-hidden', name: 'Hidden', userId: 'admin', sort: 0, createTime: now, updateTime: now },
    ])
    await orm.insert(photoTab).values([
      { photoId: 'photo-own', name: 'own.jpg', type: 'image/jpeg', typeDesc: 'JPEG', size: 10, width: 100, height: 80, userId: 'member-a', status: 1, favorite: 1, createTime: now },
      { photoId: 'photo-admin', name: 'admin.jpg', type: 'image/jpeg', typeDesc: 'JPEG', size: 10, width: 100, height: 80, userId: 'admin', status: 1, favorite: 1, storageId: 'local', createTime: now },
      { photoId: 'photo-orphan', name: 'orphan.jpg', type: 'image/jpeg', typeDesc: 'JPEG', size: 10, width: 100, height: 80, userId: 'member-a', status: 1, favorite: 1, createTime: now },
    ])
    await orm.insert(albumPhotoTab).values([
      { id: 'link-own', albumId: 'album-visible', photoId: 'photo-own' },
      { id: 'link-admin', albumId: 'album-hidden', photoId: 'photo-admin' },
      { id: 'link-orphan', albumId: 'album-visible', photoId: 'photo-orphan' },
    ])
    await orm.insert(fileTab).values({
      fileId: 'media-file',
      photoId: 'photo-admin',
      key: 'photos/admin/media.jpg',
      type: 1,
      fileType: 'image/jpeg',
      size: 4,
    })
    fs.mkdirSync(path.join(testDir, 'data/photos/admin'), { recursive: true })
    fs.writeFileSync(path.join(testDir, 'data/photos/admin/media.jpg'), Buffer.from('test'))

    await albumPermissionService.setMemberPermission({
      albumId: 'album-visible',
      userId: 'member-a',
      canView: true,
      canUpload: true,
      canDeleteOwn: true,
    }, 'admin')
    await albumPermissionService.setMemberPermission({
      albumId: 'album-visible',
      userId: 'member-b',
      canView: true,
      canUpload: false,
      canDeleteOwn: false,
    }, 'admin')

    assert.deepEqual((await albumPermissionService.listVisibleAlbumIds('member-a')).sort(), ['album-visible'])
    assert.deepEqual((await albumPermissionService.listVisibleAlbumIds('admin')).sort(), ['album-hidden', 'album-visible'])
    assert.equal(await albumPermissionService.canViewPhoto('member-a', 'photo-admin'), false)
    await assert.rejects(
      () => albumPermissionService.assertCanViewAlbum('member-a', 'album-hidden'),
      (error) => error.code === 404,
    )

    const memberUuid = await loginService.saveAuthInfo({ userId: 'member-a', username: 'member-a', avatar: '', type: UserTypeEnum.NORMAL })
    const adminUuid = await loginService.saveAuthInfo({ userId: 'admin', username: 'admin', avatar: '', type: UserTypeEnum.ADMIN })
    const memberToken = await createLoginToken('member-a', memberUuid)
    const adminToken = await createLoginToken('admin', adminUuid)
    const unauthorizedMedia = await media.request('/media/photos/admin/media.jpg', {
      headers: { cookie: `token=${memberToken}` },
    })
    const authorizedMedia = await media.request('/media/photos/admin/media.jpg', {
      headers: { cookie: `token=${adminToken}` },
    })
    assert.equal(unauthorizedMedia.status, 404)
    assert.equal(authorizedMedia.status, 200)
    assert.deepEqual(screenPointToPhotoRatio(0.25, 0.75, 0), { xRatio: 0.25, yRatio: 0.75 })
    assert.deepEqual(screenPointToPhotoRatio(0.25, 0.25, 90), { xRatio: 0.25, yRatio: 0.75 })
    assert.deepEqual(screenPointToPhotoRatio(0.75, 0.25, 180), { xRatio: 0.25, yRatio: 0.75 })
    assert.deepEqual(screenPointToPhotoRatio(0.75, 0.75, 270), { xRatio: 0.25, yRatio: 0.75 })
    await albumPermissionService.assertCanUploadToAlbum('member-a', 'album-visible')
    await assert.rejects(
      () => albumPermissionService.assertCanUploadToAlbum('member-b', 'album-visible'),
      (error) => error.code === 403,
    )
    await albumPermissionService.assertCanRemoveOwnPhoto('member-a', 'album-visible', 'photo-own')
    await assert.rejects(
      () => albumPermissionService.assertCanRemoveOwnPhoto('member-a', 'album-visible', 'photo-admin'),
      (error) => error.code === 404,
    )

    await photoFavoriteService.set({ photoIds: ['photo-own'], favorite: 2 }, 'member-a')
    assert.deepEqual(await photoFavoriteService.listPhotoIds('member-a'), ['photo-own'])
    assert.deepEqual(await photoFavoriteService.listPhotoIds('member-b'), [])

    const comment = await photoCommentService.add({
      photoId: 'photo-own',
      body: '<b>plain text only</b>',
      xRatio: 0.25,
      yRatio: 0.75,
    }, 'member-a')
    assert.equal((await photoCommentService.list('photo-own', 'member-b'))[0].body, '<b>plain text only</b>')
    await assert.rejects(
      () => photoCommentService.update({ commentId: comment.commentId, body: 'not mine' }, 'member-b'),
      (error) => error.code === 404,
    )
    await assert.rejects(
      () => photoCommentService.add({ photoId: 'photo-own', body: 'x'.repeat(201), xRatio: 0.5, yRatio: 0.5 }, 'member-a'),
    )
    await assert.rejects(
      () => photoCommentService.add({ photoId: 'photo-own', body: 'bad position', xRatio: 1.1, yRatio: 0.5 }, 'member-a'),
    )

    await albumService.removePhoto({ albumId: 'album-visible', photoIds: ['photo-orphan'] }, 'member-a')
    const orphan = await orm.select({ status: photoTab.status }).from(photoTab).where(require('drizzle-orm').eq(photoTab.photoId, 'photo-orphan')).limit(1)
    assert.equal(orphan[0].status, 2)

    await userService.delete('member-a', 'admin')
    const retainedComment = (await photoCommentService.list('photo-own', 'admin')).find((item) => item.commentId === comment.commentId)
    assert.equal(retainedComment.authorDeleted, true)
    assert.equal(retainedComment.authorName, 'member-a')
    assert.equal((await orm.select().from(albumMemberTab)).some((item) => item.userId === 'member-a'), false)
    assert.equal((await orm.select().from(photoFavoriteTab)).some((item) => item.userId === 'member-a'), false)

    const auditLogs = await auditLogService.list('admin')
    assert.equal(auditLogs.some((item) => item.action === 'album.permission.set'), true)
    assert.equal(auditLogs.some((item) => item.action === 'album.photo.remove'), true)
    assert.equal(auditLogs.some((item) => item.action === 'user.delete'), true)

    // 强制让相册关联写入失败，确认已上传对象和半成品数据库行会被补偿清理。
    const originalAddPhoto = albumService.addPhoto
    albumService.addPhoto = async () => {
      throw new Error('forced album link failure')
    }
    const png = fs.readFileSync(path.join(projectRoot, 'public/logo.png'))
    const uploadForm = new FormData()
    uploadForm.set('file', new File([png], 'compensation.png', { type: 'image/png' }))
    uploadForm.set('storageId', 'local')
    uploadForm.set('albumId', 'album-visible')
    uploadForm.set('lastModified', String(Date.now()))

    try {
      await assert.rejects(() => photoService.add(uploadForm, 'admin'), /forced album link failure/)
    } finally {
      albumService.addPhoto = originalAddPhoto
    }

    const partialPhotos = await orm.select().from(photoTab)
    assert.equal(partialPhotos.some((item) => item.name === 'compensation.png'), false)
    const dataRoot = path.join(testDir, 'data')
    const storedFiles = fs.readdirSync(dataRoot, { recursive: true, withFileTypes: true }).filter((item) => item.isFile())
    assert.equal(storedFiles.some((item) => item.name.includes('compensation')), false)

    console.log(`Shared album verification passed (${auditLogs.length} audit events).`)
  } finally {
    db.close()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    process.chdir(projectRoot)
    fs.rmSync(testDir, { recursive: true, force: true })
  })
