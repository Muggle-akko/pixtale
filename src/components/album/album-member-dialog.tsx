"use client"

import { useEffect, useState } from "react"
import { LoaderCircleIcon } from "lucide-react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { albumMemberList, albumMemberSet } from "@/request/album-member"
import { UserStatusEnum } from "@/server/enums/user-enum"
import { type AlbumVo } from "@/server/entity/vo/album"
import { type AlbumMemberVo } from "@/server/entity/vo/album-member"

interface AlbumMemberDialogProps {
  open: boolean
  album: AlbumVo | null
  onOpenChange: (open: boolean) => void
}

// 根据成员名生成头像文字。
function getAvatarFallback(username: string) {
  return username.slice(0, 1).toUpperCase()
}

// 渲染管理员配置单个相册成员权限的弹框。
export function AlbumMemberDialog({ open, album, onOpenChange }: AlbumMemberDialogProps) {
  const t = useTranslations("albums.permissions")
  // members 保存当前相册的全部可授权成员与权限。
  const [members, setMembers] = useState<AlbumMemberVo[]>([])
  // loading 标记首次权限列表是否仍在读取。
  const [loading, setLoading] = useState(true)
  // loadedAlbumId 标记当前列表对应的相册，切换相册时避免短暂显示旧数据。
  const [loadedAlbumId, setLoadedAlbumId] = useState<string | null>(null)
  // savingUserIds 保存正在提交权限的成员，防止重复点击。
  const [savingUserIds, setSavingUserIds] = useState<string[]>([])

  useEffect(() => {
    if (!open || !album) {
      return
    }

    let active = true
    albumMemberList({ albumId: album.albumId })
      .then((data) => {
        if (active) {
          setMembers(data)
          setLoadedAlbumId(album.albumId)
        }
      })
      .catch((error: Error) => {
        if (active) {
          setMembers([])
          setLoadedAlbumId(album.albumId)
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
  }, [album, open])

  // 提交单个成员权限，并在失败时恢复原值。
  function updatePermission(member: AlbumMemberVo, changes: Partial<Pick<AlbumMemberVo, "canView" | "canUpload" | "canDeleteOwn">>) {
    if (!album || savingUserIds.includes(member.userId)) {
      return
    }

    const previous = member
    const merged = { ...member, ...changes }
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

    setMembers((items) => items.map((item) => item.userId === member.userId ? next : item))
    setSavingUserIds((ids) => [...ids, member.userId])

    albumMemberSet({
      albumId: album.albumId,
      userId: member.userId,
      canView: next.canView,
      canUpload: next.canUpload,
      canDeleteOwn: next.canDeleteOwn,
    }).catch((error: Error) => {
      setMembers((items) => items.map((item) => item.userId === member.userId ? previous : item))
      toast.error(error.message)
    }).finally(() => {
      setSavingUserIds((ids) => ids.filter((id) => id !== member.userId))
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[min(80dvh,680px)] grid-rows-[auto_minmax(0,1fr)] gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title", { album: album?.name ?? "" })}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto rounded-lg border">
          <div className="sticky top-0 grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_5rem] items-center gap-2 border-b bg-popover px-3 py-2 text-xs text-muted-foreground">
            <span>{t("member")}</span>
            <span className="text-center">{t("view")}</span>
            <span className="text-center">{t("upload")}</span>
            <span className="text-center">{t("deleteOwn")}</span>
          </div>
          {loading || loadedAlbumId !== album?.albumId ? (
            <div className="flex h-28 items-center justify-center text-muted-foreground">
              <LoaderCircleIcon className="size-5 animate-spin" />
              <span className="sr-only">{t("loading")}</span>
            </div>
          ) : members.length ? (
            <div className="divide-y">
              {members.map((member) => {
                const saving = savingUserIds.includes(member.userId)
                const disabled = member.status === UserStatusEnum.DISABLE

                return (
                  <div key={member.userId} className="grid min-h-14 grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_5rem] items-center gap-2 px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarImage src={member.avatar ? `/api/user/avatar/${member.avatar}` : undefined} alt="" />
                        <AvatarFallback>{getAvatarFallback(member.username)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{member.username}</div>
                        {disabled && <Badge variant="secondary" className="mt-0.5">{t("disabled")}</Badge>}
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={member.canView}
                        disabled={saving || disabled}
                        aria-label={t("viewFor", { user: member.username })}
                        onCheckedChange={(checked) => updatePermission(member, { canView: checked === true })}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={member.canUpload}
                        disabled={saving || disabled}
                        aria-label={t("uploadFor", { user: member.username })}
                        onCheckedChange={(checked) => updatePermission(member, { canUpload: checked === true })}
                      />
                    </div>
                    <div className="flex justify-center">
                      <Checkbox
                        checked={member.canDeleteOwn}
                        disabled={saving || disabled}
                        aria-label={t("deleteOwnFor", { user: member.username })}
                        onCheckedChange={(checked) => updatePermission(member, { canDeleteOwn: checked === true })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex h-28 items-center justify-center px-4 text-center text-sm text-muted-foreground">
              {t("empty")}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
