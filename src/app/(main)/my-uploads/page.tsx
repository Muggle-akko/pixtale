"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { useTranslations } from "next-intl"

import { AppSidebar } from "@/components/layout/app-sidebar"
import { AlertDialogDestructive } from "@/components/common/alert-destructive"
import { PhotoDateDrawer } from "@/components/photo/photo-date-drawer"
import { PhotoMasonry } from "@/components/photo/photo-masonry"
import { PhotoMasonrySkeleton } from "@/components/photo/photo-masonry-skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { useApp } from "@/app/(main)/provider"
import { usePhotoList } from "@/hooks/use-photo-list"
import { photoFavorite, photoRecycle } from "@/request/photo"
import { PHOTO_LIST_PAGE_SIZE } from "@/server/const/global"
import { PhotoFavoriteEnum } from "@/server/enums/photo-enum"
import { useMyUploadsContext } from "./provider"

const PhotoViewer = dynamic(
  () => import("@/components/photo/photo-viewer").then((mod) => mod.PhotoViewer),
  { ssr: false },
)

// 渲染当前用户上传照片的虚拟筛选页面。
export default function Page() {
  const t = useTranslations("myUploads")
  const { initialPhotos } = useMyUploadsContext()
  const { sidebarOpen, setSidebarOpen } = useApp()
  // isBrowser 标记当前是否在浏览器环境，SSR 阶段显示骨架屏。
  const [isBrowser, setIsBrowser] = useState(false)
  const {
    photos,
    masonryKey,
    loadMorePhotos,
    refreshPhotoList,
    removePhotos,
  } = usePhotoList({ mine: true }, PHOTO_LIST_PAGE_SIZE, initialPhotos)
  // modelPhotoIndex 保存当前查看照片在列表中的位置。
  const [modelPhotoIndex, setModelPhotoIndex] = useState(0)
  // showPhotoViewer 控制照片详情查看器。
  const [showPhotoViewer, setShowPhotoViewer] = useState(false)
  // deletePhotoIds 保存等待确认全局删除的本人照片。
  const [deletePhotoIds, setDeletePhotoIds] = useState<string[]>([])

  useLayoutEffect(() => {
    setIsBrowser(true)
  }, [])

  useEffect(() => {
    // 刷新本人上传页时禁用浏览器滚动恢复，并回到列表顶部。
    const previousScrollRestoration = window.history.scrollRestoration

    window.history.scrollRestoration = "manual"
    window.scrollTo(0, 0)

    return () => {
      window.history.scrollRestoration = previousScrollRestoration
    }
  }, [])

  // 打开照片详情查看器。
  const openPhoto = useCallback((index: number) => {
    setModelPhotoIndex(index)
    setShowPhotoViewer(true)
  }, [])

  // 关闭照片详情查看器。
  function closePhoto() {
    setShowPhotoViewer(false)
  }

  // 根据照片下标切换单张照片收藏状态。
  const changePhotoFavorite = useCallback((index: number, setFavorite: (favorite: boolean) => void) => {
    const photo = photos[index]
    const favorite = photo.favorite === PhotoFavoriteEnum.YES
      ? PhotoFavoriteEnum.NO
      : PhotoFavoriteEnum.YES

    photoFavorite({ photoIds: [photo.photoId], favorite }).then(() => {
      setFavorite(favorite === PhotoFavoriteEnum.YES)
      photo.favorite = favorite
    })
  }, [photos])

  // 打开全局删除确认，明确告知会从全部共享相册移入回收站。
  const requestDeletePhotos = useCallback((photoIds: string[]) => {
    setDeletePhotoIds(photoIds)
  }, [])

  // 确认后把本人照片移动到回收站，并从当前虚拟筛选结果移除。
  function confirmDeletePhotos() {
    if (!deletePhotoIds.length) {
      return
    }

    const photoIds = deletePhotoIds
    setDeletePhotoIds([])
    photoRecycle({ photoIds }).then(() => {
      removePhotos(photoIds)
    })
  }

  // 保存当前选择的照片时间范围，并触发列表按拍摄时间筛选。
  function changePhotoTime(range: { startDate: Date, endDate: Date }) {
    refreshPhotoList({
      mine: true,
      startTakenTime: range.startDate.toISOString(),
      endTakenTime: range.endDate.toISOString(),
    })
  }

  return (
    <>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center justify-between gap-2 bg-background transition-[width,height] ease-linear">
            <div className="flex min-w-0 items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem>
                    <BreadcrumbPage>{t("title")}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="fixed left-[calc(100vw-3.5rem)] top-0 flex h-12 items-center gap-1 px-4 md:left-[calc(100vw-4rem)]">
              <PhotoDateDrawer mine onRangeChange={changePhotoTime} />
            </div>
          </header>
          <div className="px-1 md:pl-1 md:pr-0">
            {isBrowser ? (
              <PhotoMasonry
                photos={photos}
                resetKey={masonryKey}
                onReachBottom={loadMorePhotos}
                onPhotoOpen={openPhoto}
                onPhotoFavorite={changePhotoFavorite}
                onPhotoDelete={requestDeletePhotos}
              />
            ) : (
              <PhotoMasonrySkeleton photos={initialPhotos} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
      <PhotoViewer
        open={showPhotoViewer}
        index={modelPhotoIndex}
        photos={photos}
        onBack={closePhoto}
        onBrowserBack={closePhoto}
      />
      <AlertDialogDestructive
        open={deletePhotoIds.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setDeletePhotoIds([])
          }
        }}
        title={t("deleteTitle")}
        description={t("deleteDescription")}
        onConfirm={confirmDeletePhotos}
      />
    </>
  )
}
