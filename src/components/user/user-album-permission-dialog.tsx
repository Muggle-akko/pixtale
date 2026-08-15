"use client"

import { useEffect, useState } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { albumMemberSet, albumMemberUserList } from "@/request/album-member"
import { UserStatusEnum } from "@/server/enums/user-enum"
import { type UserVo } from "@/server/entity/vo/user"
import { type UserAlbumPermissionVo } from "@/server/entity/vo/album-member"

interface UserAlbumPermissionDialogProps {
  open: boolean
  user: UserVo | null
  onOpenChange: (open: boolean) => void
}

// 渲染管理员按用户配置共享相册权限的弹框。
export function UserAlbumPermissionDialog({ open, user, onOpenChange }: UserAlbumPermissionDialogProps) {
  const t = useTranslations("users.permissions")
  // albums 保存当前成员在所有共享相册中的权限。
  const [albums, setAlbums] = useState<UserAlbumPermissionVo[]>([])
  // loading 标记权限数据是否正在读取。
  const [loading, setLoading] = useState(false)
  // savingAlbumIds 保存正在提交的相册权限，避免重复点击。
  const [savingAlbumIds, setSavingAlbumIds] = useState<string[]>([])

  useEffect(() => {
    if (!open || !user) {
      return
    }

    let active = true
    setLoading(true)
    albumMemberUserList({ userId: user.userId })
      .then((data) => {
        if (active) {
          setAlbums(data)
        }
      })
      .catch((error: Error) => {
        if (active) {
          setAlbums([])
        }
        toast.error(error.message)
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [open, user])

  // 保存单个共享相册的权限，并在失败时恢复原状态。
  function updatePermission(album: UserAlbumPermissionVo, changes: Partial<Pick<UserAlbumPermissionVo, "canView" | "canUpload" | "canDeleteOwn">>) {
    if (!user || savingAlbumIds.includes(album.albumId)) {
      return
    }

    const previous = album
    const merged = { ...album, ...changes }
    const wantsView = merged.canView || merged.canUpload || merged.canDeleteOwn
    const next = {
      ...merged,
      canView: wantsView,
      canUpload: wantsView ? merged.canUpload : false,
      canDeleteOwn: wantsView ? merged.canDeleteOwn : false,
    }

    if (changes.canView === false) {
      next.canView = false
      next.canUpload = false
      next.canDeleteOwn = false
    }

    setAlbums((items) => items.map((item) => item.albumId === album.albumId ? next : item))
    setSavingAlbumIds((ids) => [...ids, album.albumId])
    albumMemberSet({
      albumId: album.albumId,
      userId: user.userId,
      canView: next.canView,
      canUpload: next.canUpload,
      canDeleteOwn: next.canDeleteOwn,
    }).catch((error: Error) => {
      setAlbums((items) => items.map((item) => item.albumId === album.albumId ? previous : item))
      toast.error(error.message)
    }).finally(() => {
      setSavingAlbumIds((ids) => ids.filter((id) => id !== album.albumId))
    })
  }

  const disabled = user?.status === UserStatusEnum.DISABLE

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[min(80dvh,680px)] grid-rows-[auto_minmax(0,1fr)] gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title", { user: user?.username ?? "" })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border">
          <div className="sticky top-0 grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_5rem] items-center gap-2 border-b bg-popover px-3 py-2 text-xs text-muted-foreground">
            <span>{t("album")}</span>
            <span className="text-center">{t("view")}</span>
            <span className="text-center">{t("upload")}</span>
            <span className="text-center">{t("deleteOwn")}</span>
          </div>
          {loading ? (
            <div className="flex h-28 items-center justify-center text-muted-foreground">
              <LoaderCircleIcon className="size-5 animate-spin" />
              <span className="sr-only">{t("loading")}</span>
            </div>
          ) : !albums.length ? (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">{t("empty")}</div>
          ) : (
            <div className="divide-y">
              {albums.map((album) => {
                const saving = savingAlbumIds.includes(album.albumId)
                const controlDisabled = disabled || saving

                return (
                  <div key={album.albumId} className="grid min-h-14 grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_5rem] items-center gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{album.name}</div>
                      <div className="text-xs text-muted-foreground">{t("photoCount", { count: album.photoTotal })}</div>
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={album.canView}
                        disabled={controlDisabled}
                        aria-label={t("viewFor", { album: album.name })}
                        onCheckedChange={(checked) => updatePermission(album, { canView: checked === true })}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={album.canUpload}
                        disabled={controlDisabled}
                        aria-label={t("uploadFor", { album: album.name })}
                        onCheckedChange={(checked) => updatePermission(album, { canUpload: checked === true })}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={album.canDeleteOwn}
                        disabled={controlDisabled}
                        aria-label={t("deleteOwnFor", { album: album.name })}
                        onCheckedChange={(checked) => updatePermission(album, { canDeleteOwn: checked === true })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
