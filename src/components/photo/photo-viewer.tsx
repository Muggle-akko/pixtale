"use client"

import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Lightbox from "yet-another-react-lightbox"
import { isImageSlide, type SlideImage, useController, useLightboxState } from "yet-another-react-lightbox"
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen"
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import { ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, CircleAlertIcon, CircleIcon, EyeIcon, EyeOffIcon, Menu, LoaderCircleIcon, MessageSquarePlusIcon, PanelRightClose, PanelRightOpen, RotateCcwSquare } from "lucide-react"

import { PhotoInfoSidebar, PhotoViewerBlurBackground } from "@/components/photo/photo-info-sidebar"
import { PhotoCommentComposer, PhotoCommentMarkers, type CommentPosition } from "@/components/photo/photo-comments-overlay"
import { useTapAction } from "@/hooks/use-tap-action"
import { Button } from "@/components/ui/button"
import { getThumbHashUrl } from "@/lib/thumb-hash"
import { photoCommentAdd, photoCommentDelete, photoCommentList, photoCommentUpdate } from "@/request/photo-comment"
import { type PhotoVo } from "@/server/entity/vo/photo"
import { type PhotoCommentVo } from "@/server/entity/vo/photo-comment"
import { usePhotoStore } from "@/store/photo-store"
import { useTranslations } from "next-intl"

interface PhotoViewerProps {
  // 控制查看器是否显示。
  open: boolean
  // 当前打开的照片索引。
  index: number
  // 父组件传入的照片列表。
  photos: PhotoVo[]
  // 关闭查看器时执行。
  onBack: () => void
  // 浏览器返回关闭查看器时执行。
  onBrowserBack: () => void
}

type PhotoSlide = SlideImage & {
  // 当前照片 id。
  photoId: string
  // 当前照片原图。
  key: string
  // 当前照片原图大小。
  originalSize: number
  // 当前照片预览图。
  preview: string
  // 缩图地址。
  thumbnail: string
  // thumbHash 转换后的模糊色背景。
  thumbHashUrl?: string
}

type OriginalPhoto = {
  // 当前已经加载完成的原图 key。
  key: string
}

type OriginalProgress = {
  // 当前已加载字节数。
  loaded: number
  // 当前原图总字节数。
  total: number
}

type PreviewRequestMap = Map<string, () => void>

type LoadOriginalImageParams = {
  // 当前照片 id。
  photoId: string
  // 原图请求地址。
  src: string
  // 原图文件大小，用于没有返回 total 时兜底显示进度。
  totalSize: number
  // 保存已经加载完成的原图。
  setOriginalPhoto: (photo: OriginalPhoto | null) => void
  // 保存原图加载进度。
  setOriginalProgress: (progress: OriginalProgress | null) => void
  // 控制原图加载进度是否显示。
  setShowOriginalProgress: (show: boolean) => void
  // 保存当前原图加载是否异常。
  setOriginalError: (error: boolean) => void
  // 保存当前原图请求的取消方法。
  abortOriginalRef: { current: (() => void) | null }
  // 原图加载进度延迟隐藏定时器。
  hideTimerRef: { current: ReturnType<typeof setTimeout> | null }
  // 保存已经完成加载的照片缓存。
  setPhotoCache: (photoId: string, src: string) => void
}

const photoViewerPortalStyle: CSSProperties & { "--yarl__portal_zindex": number } = {
  "--yarl__portal_zindex": 40,
}

const COMMENTS_VISIBLE_STORAGE_KEY = "pixtale-photo-comments-visible"

// 根据操作按钮显示状态生成淡入淡出样式。
function getActionVisibleClass(showActions: boolean) {
  return showActions ? "opacity-100" : "pointer-events-none opacity-0"
}

// 把字节数格式化成 MB。
function formatMB(size: number) {
  return `${(size / 1024 / 1024).toFixed(1)}MB`
}

// 关闭所有预览图请求，并清空当前请求 Map。
function closePreviewRequests(requests: PreviewRequestMap) {
  const aborts = Array.from(requests.values())

  requests.clear()
  aborts.forEach((abort) => {
    abort()
  })
}

// 加载原图并直接更新查看器原图相关状态。
function loadOriginalImage({
  photoId,
  src,
  totalSize,
  setOriginalPhoto,
  setOriginalProgress,
  setShowOriginalProgress,
  setOriginalError,
  abortOriginalRef,
  hideTimerRef,
  setPhotoCache,
}: LoadOriginalImageParams) {

  const xhr = new XMLHttpRequest()
  const abortOriginal = () => {
    xhr.abort()
  }

  // 请求结束后清理当前请求引用，避免后续切换误取消已完成请求。
  function clearCurrentRequest() {
    if (abortOriginalRef.current === abortOriginal) {
      abortOriginalRef.current = null
    }
  }

  if (hideTimerRef.current) {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = null
  }
  setShowOriginalProgress(true)
  setOriginalError(false)
  setOriginalProgress({
    loaded: 0,
    total: totalSize,
  })

  xhr.open("GET", src)
  xhr.responseType = "arraybuffer"
  xhr.onprogress = (event) => {
    setOriginalProgress({
      loaded: event.loaded,
      total: event.lengthComputable ? event.total : totalSize,
    })
  }
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      setOriginalProgress({
        loaded: xhr.response.byteLength,
        total: xhr.response.byteLength,
      })
      setPhotoCache(photoId, src)
      setOriginalPhoto({
        key: src,
      })

      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null
        setShowOriginalProgress(false)
      }, 800)
    } else {
      setOriginalError(true)
      setShowOriginalProgress(true)
    }
    clearCurrentRequest()
  }
  xhr.onerror = () => {
    setOriginalError(true)
    setShowOriginalProgress(true)
    clearCurrentRequest()
  }
  xhr.onabort = () => {
    clearCurrentRequest()
  }
  xhr.send()

  return abortOriginal
}

// 静默加载预览图，请求完成后替换当前显示图。
function loadPreviewImage(
  src: string,
  photoId: string,
  currentPhotoIdRef: { current: string | null },
  setOriginalPhoto: (photo: OriginalPhoto | null) => void,
  previewRequestsRef: { current: PreviewRequestMap },
  getPhotoCache: (photoId: string) => string | undefined,
  setPhotoCache: (photoId: string, src: string) => void,
  onLoaded?: () => void
) {
  const cachedSrc = getPhotoCache(photoId)

  if (cachedSrc) {
    requestAnimationFrame(() => {
      if (currentPhotoIdRef.current === photoId) {
        setOriginalPhoto({
          key: cachedSrc,
        })
        onLoaded?.()
      }
    })
    return
  }

  const xhr = new XMLHttpRequest()
  const abortPreview = () => {
    xhr.abort()
  }

  previewRequestsRef.current.set(photoId, abortPreview)

  // 请求结束后只清理自己的记录，避免旧请求删掉新请求。
  function clearCurrentRequest() {
    if (previewRequestsRef.current.get(photoId) === abortPreview) {
      previewRequestsRef.current.delete(photoId)
    }
  }

  xhr.open("GET", src)
  xhr.responseType = "arraybuffer"
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      setPhotoCache(photoId, src)

      if (currentPhotoIdRef.current === photoId) {
        setOriginalPhoto({
          key: src,
        })
        onLoaded?.()
      }
    }
    clearCurrentRequest()
  }
  xhr.onerror = () => {
    clearCurrentRequest()
  }
  xhr.onabort = () => {
    clearCurrentRequest()
  }
  xhr.send()
}

// 渲染原图加载进度。
function OriginalProgressButton({ progress, error }: { progress: OriginalProgress | null, error: boolean }) {
  const t = useTranslations("photos.viewer")
  if (!progress) {
    return null
  }

  const percent = Math.round((progress.loaded / progress.total) * 100)

  return (
    <Button
      type="button"
      variant="secondary"
      className={[
        "absolute right-3 md:right-4 bottom-3 md:bottom-4  z-[450] h-auto gap-3 rounded-xl bg-black/80 px-3 py-2 text-white transition-opacity duration-200 hover:bg-black/80"
      ].join(" ")}
    >
      {error ? (
        <CircleAlertIcon className="size-4 text-red-500" />
      ) : (
        <LoaderCircleIcon className="size-4 animate-spin text-white" />
      )}
      <span className="flex flex-col items-start leading-none">
        <span className={["text-xs font-medium", error ? "text-red-500" : "text-white"].join(" ")}>
          <span className="text-xs mr-[1px]"> {error ? t("loadFailed") : t("loading")} </span>
          {!error && <span className="text-white/70"> {percent}%</span>}
        </span>
        <span className="text-xs text-white/70">
          {formatMB(progress.loaded)} / {formatMB(progress.total)}
        </span>
      </span>
    </Button>
  )
}

// 渲染上一张按钮。
function PrevButton({ showActions }: { showActions: boolean }) {
  const { prev } = useController()

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={[
        "absolute top-1/2 left-3 z-40 hidden rounded-full bg-black/40 text-white transition-opacity duration-200 hover:bg-black/50 md:inline-flex",
        getActionVisibleClass(showActions),
      ].join(" ")}
      style={{ transform: "translateY(-50%)" }}
      onClick={() => prev()}
    >
      <ChevronLeftIcon />
      <span className="sr-only">Previous photo</span>
    </Button>
  )
}

// 渲染下一张按钮。
function NextButton({ showActions }: { showActions: boolean }) {
  const { next } = useController()

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={[
        "absolute top-1/2 right-3 z-40 hidden rounded-full bg-black/40 text-white transition-opacity duration-200 hover:bg-black/50 md:inline-flex",
        getActionVisibleClass(showActions),
      ].join(" ")}
      style={{ transform: "translateY(-50%)" }}
      onClick={() => next()}
    >
      <ChevronRightIcon />
      <span className="sr-only">Next photo</span>
    </Button>
  )
}

// 渲染照片信息按钮，点击切换右侧信息侧栏。
function InfoButton({
  showActions,
  open,
  onToggle,
}: {
  showActions: boolean
  open: boolean
  onToggle: () => void
}) {
  const tap = useTapAction(onToggle)

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={[
        "absolute top-2 right-2 md:top-3 md:right-3 z-40 rounded-full text-white transition-opacity duration-200",
        open ? "bg-black/50 hover:bg-black/50" : "bg-black/40 hover:bg-black/50",
        getActionVisibleClass(showActions),
      ].join(" ")}
      {...tap}
    >
      <Menu className="md:hidden" />
      {open
        ? <PanelRightClose className="hidden md:block" />
        : <PanelRightOpen className="hidden md:block" />}
      <span className="sr-only">Photo information</span>
    </Button>
  )
}

// 渲染旋转按钮。
function RotateButton({ showActions, onRotate }: { showActions: boolean, onRotate: (photoId: string) => void }) {
  const { currentSlide } = useLightboxState()
  const photoSlide = currentSlide && isImageSlide(currentSlide) ? currentSlide as PhotoSlide : null

  // 把当前照片 id 交给父组件更新旋转角度。
  function rotatePhoto() {
    if (!photoSlide) {
      return
    }

    onRotate(photoSlide.photoId)
  }

  const tap = useTapAction(rotatePhoto)

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={[
        "absolute top-2 right-11.5 md:right-13 md:top-3 z-40 rounded-full bg-black/40 text-white transition-opacity duration-200 hover:bg-black/50",
        getActionVisibleClass(showActions),
      ].join(" ")}
      {...tap}
    >
      <RotateCcwSquare />
      <span className="sr-only">Rotate photo</span>
    </Button>
  )
}

// 渲染原图加载按钮。
function LoadOriginalButton({
  showActions,
  originalPhoto,
  getPhotoCache,
  onLoadOriginal,
}: {
  showActions: boolean
  originalPhoto: OriginalPhoto | null
  getPhotoCache: (photoId: string) => string | undefined
  onLoadOriginal: (slide: PhotoSlide) => void
}) {
  const { currentSlide } = useLightboxState()
  const photoSlide = currentSlide && isImageSlide(currentSlide) ? currentSlide as PhotoSlide : null
  const cacheSrc = photoSlide ? getPhotoCache(photoSlide.photoId) : undefined
  const originalLoaded = Boolean(photoSlide && (originalPhoto?.key === photoSlide.key || cacheSrc?.includes("photo/")))

  // 把当前 slide 交给父组件加载原图。
  function loadOriginal() {

    //图片不存在，或已经加载完成就终止
    if (!photoSlide || originalLoaded) {
      return
    }

    onLoadOriginal(photoSlide)
  }

  const tap = useTapAction(loadOriginal)

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={[
        "absolute top-2 right-21 md:right-23.25 md:top-3 z-40 rounded-full bg-black/40 text-white transition-opacity duration-200 hover:bg-black/50",
        getActionVisibleClass(showActions),
      ].join(" ")}
      {...tap}
    >
      {originalLoaded ? <CircleIcon /> : <LoaderCircleIcon />}
      <span className="sr-only">Load original photo</span>
    </Button>
  )
}

// 渲染关闭按钮。
function CloseButton({ showActions }: { showActions: boolean }) {
  const { close } = useController()
  const tap = useTapAction(() => close())

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={[
        "absolute top-2 left-2 md:top-3 md:left-3 z-40 rounded-full bg-black/40 text-white transition-opacity duration-200 hover:bg-black/50",
        getActionVisibleClass(showActions),
      ].join(" ")}
      {...tap}
    >
      <ArrowLeftIcon />
      <span className="sr-only">Back</span>
    </Button>
  )
}

// 渲染单张照片，通过原图 key ref 判断显示封面还是原图。
function PhotoSlideImage({
  slide,
  originalPhoto,
  rotate,
  comments,
  commentsVisible,
  commentMode,
  selectedCommentId,
  onCreatePosition,
  onSelectComment,
}: {
  // 当前照片 slide。
  slide: PhotoSlide
  // 当前已加载完成的原图。
  originalPhoto: OriginalPhoto | null
  // 当前照片 CSS 旋转角度。
  rotate: number
  // 当前照片的空间评论。
  comments: PhotoCommentVo[]
  // 是否显示评论标签。
  commentsVisible: boolean
  // 是否允许点击图片创建评论。
  commentMode: boolean
  // 当前选中的评论。
  selectedCommentId: string | null
  // 创建评论位置。
  onCreatePosition: (position: CommentPosition) => void
  // 选中已有评论。
  onSelectComment: (comment: PhotoCommentVo) => void
}) {
  const [imageRatio, setImageRatio] = useState(
    slide.width && slide.height ? slide.width / slide.height : 1,
  )
  const normalizedRotate = ((rotate % 360) + 360) % 360
  const sideways = normalizedRotate === 90 || normalizedRotate === 270
  const imageWidth = sideways
    ? `min(calc(100cqw * ${imageRatio}), 100cqh)`
    : `min(100cqw, calc(100cqh * ${imageRatio}))`
  const imageHeight = sideways
    ? `min(100cqw, calc(100cqh / ${imageRatio}))`
    : `min(100cqh, calc(100cqw / ${imageRatio}))`

  // 把旋转后的屏幕坐标还原成原图上的归一化坐标。
  function createCommentAt(event: React.MouseEvent<HTMLDivElement>) {
    if (!commentMode) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    const screenX = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    const screenY = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height))
    let xRatio = screenX
    let yRatio = screenY

    if (normalizedRotate === 90) {
      xRatio = screenY
      yRatio = 1 - screenX
    } else if (normalizedRotate === 180) {
      xRatio = 1 - screenX
      yRatio = 1 - screenY
    } else if (normalizedRotate === 270) {
      xRatio = 1 - screenY
      yRatio = screenX
    }

    onCreatePosition({ xRatio, yRatio })
  }

  return (
    <div
      className={[
        "relative max-w-none origin-center transition-transform duration-200",
        commentMode ? "cursor-crosshair" : "",
      ].join(" ")}
      style={{
        width: imageWidth,
        height: imageHeight,
        transform: `rotate(${rotate}deg)`,
      }}
      onPointerDown={(event) => {
        if (commentMode) {
          event.stopPropagation()
        }
      }}
      onPointerUp={(event) => {
        if (commentMode) {
          event.stopPropagation()
        }
      }}
      onClick={createCommentAt}
    >
      <img
        src={originalPhoto?.key === slide.preview || originalPhoto?.key === slide.key ? originalPhoto.key : slide.src}
        alt={slide.alt}
        draggable={false}
        crossOrigin="anonymous"
        className="h-full w-full select-none object-fill"
        onLoad={(event) => {
          if (event.currentTarget.naturalWidth && event.currentTarget.naturalHeight) {
            setImageRatio(event.currentTarget.naturalWidth / event.currentTarget.naturalHeight)
          }
        }}
        onError={(event) => {
          event.currentTarget.style.display = "none"
        }}
      />
      <PhotoCommentMarkers
        comments={comments}
        visible={commentsVisible}
        rotate={rotate}
        selectedCommentId={selectedCommentId}
        onSelect={onSelectComment}
      />
    </div>
  )
}

// 渲染照片详情查看器，父组件负责传入当前照片和列表数据。
export function PhotoViewer({ open, index, photos, onBack, onBrowserBack }: PhotoViewerProps) {
  const t = useTranslations("photos.viewer")
  // 当前 lightbox 查看的照片索引。
  const [viewIndex, setViewIndex] = useState(index)
  // infoOpen 控制右侧照片信息侧栏是否展开。
  const infoOpen = usePhotoStore((state) => state.infoOpen)
  // setInfoOpen 更新信息侧栏展开状态。
  const setInfoOpen = usePhotoStore((state) => state.setInfoOpen)
  // toggleInfoOpen 切换信息侧栏展开状态。
  const toggleInfoOpen = usePhotoStore((state) => state.toggleInfoOpen)
  // 当前已经加载完成的原图。
  const [originalPhoto, setOriginalPhoto] = useState<OriginalPhoto | null>(null)
  // 当前原图加载进度。
  const [originalProgress, setOriginalProgress] = useState<OriginalProgress | null>(null)
  // showOriginalProgress 控制原图加载进度是否显示。
  const [showOriginalProgress, setShowOriginalProgress] = useState(false)
  // originalError 记录当前原图加载是否异常。
  const [originalError, setOriginalError] = useState(false)
  // 当前是否显示查看器操作按钮，单击图片区域可切换，放大时仍强制隐藏。
  const [showActions, setShowActions] = useState(true)
  // 当前照片缩放倍数。
  const [zoomLevel, setZoomLevel] = useState(1)
  // 当前是否处于全屏状态。
  const [fullscreenOpen, setFullscreenOpen] = useState(false)
  // 每张照片当前的旋转角度。
  const [photoRotates, setPhotoRotates] = useState<Record<string, number>>({})
  // commentsByPhoto 保存已经读取的空间评论。
  const [commentsByPhoto, setCommentsByPhoto] = useState<Record<string, PhotoCommentVo[]>>({})
  // commentsVisible 控制全部评论标签是否显示。
  const [commentsVisible, setCommentsVisible] = useState(() => (
    typeof window === "undefined"
      ? true
      : window.localStorage.getItem(COMMENTS_VISIBLE_STORAGE_KEY) !== "false"
  ))
  // commentMode 开启后，点击图片才会创建评论。
  const [commentMode, setCommentMode] = useState(false)
  // draftComment 保存新评论的照片位置。
  const [draftComment, setDraftComment] = useState<(CommentPosition & { photoId: string }) | null>(null)
  // selectedComment 保存当前查看或编辑的评论。
  const [selectedComment, setSelectedComment] = useState<PhotoCommentVo | null>(null)
  const [commentSaving, setCommentSaving] = useState(false)
  const [commentDeleting, setCommentDeleting] = useState(false)
  // getPhotoCache 从全局照片缓存中读取已加载的照片。
  const getPhotoCache = usePhotoStore((state) => state.getPhotoCache)
  // setPhotoCache 把已经加载完成的照片写入全局照片缓存。
  const setPhotoCache = usePhotoStore((state) => state.setPhotoCache)
  // 当前原图请求的取消方法。
  const abortOriginalRef = useRef<(() => void) | null>(null)
  // previewRequestsRef 保存正在请求的预览图 id 和取消方法。
  const previewRequestsRef = useRef<PreviewRequestMap>(new Map())
  // currentPhotoIdRef 保存当前查看的照片 id，用于静默预览图请求防乱序。
  const currentPhotoIdRef = useRef<string | null>(photos[index]?.photoId ?? null)
  // openScrollYRef 保存打开查看器前的页面滚动位置，关闭后还原照片列表。
  const openScrollYRef = useRef(typeof window === "undefined" ? 0 : window.scrollY)
  // historyPushedRef 记录查看器是否已经写入浏览器历史。
  const historyPushedRef = useRef(false)
  // onBrowserBackRef 保存最新的浏览器返回回调。
  const onBrowserBackRef = useRef(onBrowserBack)
  // originalProgressHideTimerRef 保存延迟隐藏原图加载进度的定时器。
  const originalProgressHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // slidePointerStartRef 记录 slide 上 pointerdown 坐标，用于区分点击与拖动切换。
  const slidePointerStartRef = useRef<{ x: number; y: number } | null>(null)

  // lightbox 需要的图片列表。
  const slides = useMemo<PhotoSlide[]>(() => (
    photos.map((photo) => ({
      photoId: photo.photoId,
      key: photo.key,
      originalSize: photo.size,
      preview: photo.preview || "",
      src: photo.thumbnail || photo.preview || "",
      thumbnail: photo.thumbnail || photo.preview || "",
      thumbHashUrl: getThumbHashUrl(photo.thumbHash),
      width: photo.width ?? undefined,
      height: photo.height ?? undefined,
      alt: photo.name,
    }))
  ), [photos])
  const actionsVisible = (showActions || commentMode) && zoomLevel <= 1
  const currentPhotoId = photos[viewIndex]?.photoId ?? null

  useEffect(() => {
    // 保持浏览器返回回调为父组件传入的最新方法。
    onBrowserBackRef.current = onBrowserBack
  }, [onBrowserBack])

  useEffect(() => {
    if (!open || !currentPhotoId || commentsByPhoto[currentPhotoId]) {
      return
    }

    let active = true
    photoCommentList({ photoId: currentPhotoId })
      .then((comments) => {
        if (active) {
          setCommentsByPhoto((prev) => ({ ...prev, [currentPhotoId]: comments }))
        }
      })
      .catch(() => {
        // 请求层已经向用户展示错误；这里允许下次打开时重试。
      })

    return () => {
      active = false
    }
  }, [commentsByPhoto, currentPhotoId, open])

  useLayoutEffect(() => {
    if (!open) {
      return
    }

    openScrollYRef.current = window.scrollY

    // 打开查看器时压入一条历史，浏览器返回时先关闭查看器而不是离开页面。
    function handlePopState() {

      if (innerWidth < 768) {
        setInfoOpen(false)
      }

      if (!historyPushedRef.current) {
        return
      }

      historyPushedRef.current = false
      onBrowserBackRef.current()
    }

    window.history.pushState(
      {
        ...window.history.state,
        photoViewerOpen: true,
      },
      "",
      window.location.href,
    )
    historyPushedRef.current = true
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [open, setInfoOpen])

  useEffect(() => {
    if (!open) {
      return
    }

    // 关闭查看器时中断未完成的原图请求，并把列表滚动位置还原到打开前。
    return () => {
      if (originalProgressHideTimerRef.current) {
        clearTimeout(originalProgressHideTimerRef.current)
      }
      abortOriginalRef.current?.()
      closePreviewRequests(previewRequestsRef.current)
      requestAnimationFrame(restoreListScroll)
    }
  }, [open])

  // 处理照片切换后的原图加载。
  function handleView(nextIndex: number) {
    setViewIndex(nextIndex)
    setCommentMode(false)
    setDraftComment(null)
    setSelectedComment(null)

    const photo = photos[nextIndex]
    const preview = photo.preview
    currentPhotoIdRef.current = photo.photoId

    if (originalProgressHideTimerRef.current) {
      clearTimeout(originalProgressHideTimerRef.current)
      originalProgressHideTimerRef.current = null
    }
    abortOriginalRef.current?.()
    closePreviewRequests(previewRequestsRef.current)
    setOriginalProgress(null)
    setOriginalError(false)
    setShowOriginalProgress(false)

    if (!preview) {
      return
    }

    // 当前照片加载完成后，再静默预热前后两张。
    loadPreviewImage(preview, photo.photoId, currentPhotoIdRef, setOriginalPhoto, previewRequestsRef, getPhotoCache, setPhotoCache, () => {
      if (photos.length < 2) {
        return
      }

      const prevIndex = nextIndex > 0 ? nextIndex - 1 : photos.length - 1
      const nextPhotoIndex = nextIndex < photos.length - 1 ? nextIndex + 1 : 0
      const targets = new Map<string, PhotoVo>()

      if (photos[prevIndex]?.preview) {
        targets.set(photos[prevIndex].photoId, photos[prevIndex])
      }
      if (photos[nextPhotoIndex]?.preview) {
        targets.set(photos[nextPhotoIndex].photoId, photos[nextPhotoIndex])
      }

      targets.forEach((target) => {
        loadPreviewImage(target.preview!, target.photoId, currentPhotoIdRef, setOriginalPhoto, previewRequestsRef, getPhotoCache, setPhotoCache)
      })
    })
  }

  // 手动加载当前照片原图。
  function loadOriginalPhoto(slide: PhotoSlide) {
    if (!slide.key) {
      return
    }

    abortOriginalRef.current?.()
    abortOriginalRef.current = loadOriginalImage({
      photoId: slide.photoId,
      src: slide.key,
      totalSize: slide.originalSize,
      setOriginalPhoto,
      setOriginalProgress,
      setShowOriginalProgress,
      setOriginalError,
      abortOriginalRef,
      hideTimerRef: originalProgressHideTimerRef,
      setPhotoCache,
    })
  }

  // 隐藏查看器操作按钮。
  function hideActions() {
    setShowActions(false)
  }

  // 显示查看器操作按钮。
  function showActionButtons() {
    setShowActions(true)
  }

  // 记录 slide 上按下时的坐标。
  function handleSlidePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    slidePointerStartRef.current = { x: event.clientX, y: event.clientY }
  }

  // 抬起时若位移很小则视为点击，切换操作按钮；拖动切换照片时不处理。
  function handleSlidePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (commentMode) {
      slidePointerStartRef.current = null
      return
    }

    if (zoomLevel > 1) {
      slidePointerStartRef.current = null
      return
    }

    const start = slidePointerStartRef.current
    slidePointerStartRef.current = null
    if (!start) {
      return
    }

    const dx = Math.abs(event.clientX - start.x)
    const dy = Math.abs(event.clientY - start.y)
    if (dx > 10 || dy > 10) {
      return
    }

    setShowActions((prev) => !prev)
  }

  // 取消 pointer 时清掉起始坐标。
  function handleSlidePointerCancel() {
    slidePointerStartRef.current = null
  }

  // 根据照片 id 把对应照片顺时针旋转 90 度。
  function rotatePhoto(photoId: string) {
    setPhotoRotates((prev) => ({
      ...prev,
      [photoId]: (prev[photoId] ?? 0) + 90,
    }))
  }

  // 切换评论标签显示状态并保存到当前浏览器。
  function toggleCommentsVisible() {
    const next = !commentsVisible
    setCommentsVisible(next)
    window.localStorage.setItem(COMMENTS_VISIBLE_STORAGE_KEY, String(next))

    if (!next) {
      setCommentMode(false)
      setDraftComment(null)
      setSelectedComment(null)
    }
  }

  // 开关显式评论模式；开启时保证标签可见。
  function toggleCommentMode() {
    setCommentMode((prev) => {
      const next = !prev
      if (next && !commentsVisible) {
        setCommentsVisible(true)
        window.localStorage.setItem(COMMENTS_VISIBLE_STORAGE_KEY, "true")
      }
      if (!next) {
        setDraftComment(null)
      }
      return next
    })
    setSelectedComment(null)
    setShowActions(true)
  }

  // 在当前照片坐标上打开新评论输入框。
  function createCommentPosition(photoId: string, position: CommentPosition) {
    setDraftComment({ photoId, ...position })
    setSelectedComment(null)
  }

  // 新增或更新当前评论。
  async function saveComment(body: string) {
    setCommentSaving(true)

    try {
      if (draftComment) {
        const created = await photoCommentAdd({
          photoId: draftComment.photoId,
          body,
          xRatio: draftComment.xRatio,
          yRatio: draftComment.yRatio,
        })
        setCommentsByPhoto((prev) => ({
          ...prev,
          [created.photoId]: [...(prev[created.photoId] ?? []), created],
        }))
        setDraftComment(null)
        setSelectedComment(created)
        setCommentMode(false)
        return
      }

      if (!selectedComment?.isOwn) {
        return
      }

      await photoCommentUpdate({ commentId: selectedComment.commentId, body })
      const updateTime = new Date().toISOString()
      setCommentsByPhoto((prev) => ({
        ...prev,
        [selectedComment.photoId]: (prev[selectedComment.photoId] ?? []).map((comment) => (
          comment.commentId === selectedComment.commentId
            ? { ...comment, body: body.trim(), updateTime }
            : comment
        )),
      }))
      setSelectedComment((prev) => prev ? { ...prev, body: body.trim(), updateTime } : null)
    } finally {
      setCommentSaving(false)
    }
  }

  // 删除本人评论，管理员也可以删除任意评论。
  async function deleteSelectedComment() {
    if (!selectedComment?.canDelete) {
      return
    }

    setCommentDeleting(true)
    try {
      await photoCommentDelete({ commentId: selectedComment.commentId })
      setCommentsByPhoto((prev) => ({
        ...prev,
        [selectedComment.photoId]: (prev[selectedComment.photoId] ?? []).filter(
          (comment) => comment.commentId !== selectedComment.commentId,
        ),
      }))
      setSelectedComment(null)
    } finally {
      setCommentDeleting(false)
    }
  }

  // 把页面滚动位置恢复到打开查看器前，抵消 lightbox 关闭时的焦点滚动。
  function restoreListScroll() {
    window.scrollTo(0, openScrollYRef.current)
  }

  // 关闭查看器并同步清理查看器写入的浏览器历史。
  function closeViewer() {

    if (historyPushedRef.current) {
      window.history.back()
      return
    }

    onBack()
  }

  // 侧栏展开时收窄 lightbox 宽度，为右侧信息面板留出空间。
  const lightboxClassName = infoOpen && !fullscreenOpen ? "w-0 md:w-[calc(100%-(0.25rem*80))]" : "w-full"

  // 渲染 yet-another-react-lightbox 最简预览。
  return (
    <Lightbox
      className={lightboxClassName}
      open={open}
      close={() => {
        closeViewer()
        // 关闭时重置缩放
        setZoomLevel(1)
      }}
      index={index}
      slides={slides}
      portal={{
        container: {
          style: photoViewerPortalStyle,
        },
      }}
      plugins={fullscreenOpen ? [Fullscreen, Zoom] : [Thumbnails, Fullscreen, Zoom]}
      zoom={{
        scrollToZoom: true,
        wheelZoomDistanceFactor: 100,
        maxZoomPixelRatio: 1.2,
        doubleClickMaxStops: 2,
      }}
      toolbar={{
        buttons: [],
      }}
      carousel={{
        spacing: 0,
        preload: innerWidth < 768 ? 10 : 22,
      }}
      animation={{
        fade: 250,
        easing: {
          fade: "ease-out",
          navigation: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      }}
      thumbnails={{
        width: innerWidth < 768 ? 46 : 75,
        height: innerWidth < 768 ? 46 : 75,
        gap: 0,
        padding: 0,
        border: 0,
        borderRadius: 0,
        imageFit: "cover",
        vignette: false,
      }}
      on={{
        exiting: () => {
          restoreListScroll()
        },
        view: ({ index }) => {
          handleView(index)
        },
        zoom: ({ zoom }) => {
          setZoomLevel(zoom)
        },
        enterFullscreen: () => {
          setFullscreenOpen(true)
          hideActions()
        },
        exitFullscreen: () => {
          setFullscreenOpen(false)
          showActionButtons()
        },
      }}
      render={{
        buttonPrev: () => <PrevButton key="prev" showActions={actionsVisible} />,
        buttonNext: () => <NextButton key="next" showActions={actionsVisible} />,
        controls: () => (
          <>
            {infoOpen && !fullscreenOpen && (
              <PhotoViewerBlurBackground thumbHash={photos[viewIndex]?.thumbHash} />
            )}
            {infoOpen && !fullscreenOpen && (
              <PhotoInfoSidebar photo={photos[viewIndex] ?? null} onClose={() => setInfoOpen(false)} />
            )}
            <CloseButton showActions={actionsVisible} />
            <InfoButton
              showActions={actionsVisible}
              open={infoOpen}
              onToggle={toggleInfoOpen}
            />
            <RotateButton showActions={actionsVisible} onRotate={rotatePhoto} />
            <LoadOriginalButton
              showActions={actionsVisible}
              originalPhoto={originalPhoto}
              getPhotoCache={getPhotoCache}
              onLoadOriginal={loadOriginalPhoto}
            />
            <div
              className={[
                "absolute bottom-14 left-2 z-40 flex gap-1.5 transition-opacity duration-200 md:bottom-24 md:left-3",
                getActionVisibleClass(actionsVisible),
              ].join(" ")}
            >
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className={[
                  "rounded-full text-white",
                  commentMode ? "bg-white text-black hover:bg-white/90" : "bg-black/40 hover:bg-black/50",
                ].join(" ")}
                title={commentMode ? t("exitCommentMode") : t("enterCommentMode")}
                onClick={toggleCommentMode}
              >
                <MessageSquarePlusIcon />
                <span className="sr-only">{commentMode ? t("exitCommentMode") : t("enterCommentMode")}</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="rounded-full bg-black/40 text-white hover:bg-black/50"
                title={commentsVisible ? t("hideComments") : t("showComments")}
                onClick={toggleCommentsVisible}
              >
                {commentsVisible ? <EyeIcon /> : <EyeOffIcon />}
                <span className="sr-only">{commentsVisible ? t("hideComments") : t("showComments")}</span>
              </Button>
            </div>
            {(draftComment || selectedComment) && (
              <PhotoCommentComposer
                key={draftComment ? `new-${draftComment.photoId}-${draftComment.xRatio}-${draftComment.yRatio}` : selectedComment?.commentId}
                position={draftComment}
                comment={selectedComment}
                saving={commentSaving}
                deleting={commentDeleting}
                onSave={saveComment}
                onDelete={deleteSelectedComment}
                onClose={() => {
                  setDraftComment(null)
                  setSelectedComment(null)
                }}
                labels={{
                  placeholder: t("commentPlaceholder"),
                  add: t("addComment"),
                  edit: t("editComment"),
                  delete: t("deleteComment"),
                  close: t("closeComment"),
                  deletedAuthor: t("deletedAuthor"),
                }}
              />
            )}
            {showOriginalProgress && (
              <OriginalProgressButton progress={originalProgress} error={originalError} />
            )}
          </>
        ),
        buttonFullscreen: () => null,
        buttonZoom: () => null,
        slide: ({ slide }) => {
          if (!isImageSlide(slide)) {
            return null
          }

          const photoSlide = slide as PhotoSlide

          return (
            <div
              className="relative flex h-full w-full items-center justify-center overflow-hidden [container-type:size]"
              onPointerDown={handleSlidePointerDown}
              onPointerUp={handleSlidePointerUp}
              onPointerCancel={handleSlidePointerCancel}
            >
              {photoSlide.thumbHashUrl && (
                <img
                  src={photoSlide.thumbHashUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full scale-110 blur-sm"
                  aria-hidden
                />
              )}
              <PhotoSlideImage
                slide={photoSlide}
                originalPhoto={originalPhoto}
                rotate={photoRotates[photoSlide.photoId] ?? 0}
                comments={commentsByPhoto[photoSlide.photoId] ?? []}
                commentsVisible={commentsVisible}
                commentMode={commentMode && photoSlide.photoId === currentPhotoId}
                selectedCommentId={selectedComment?.commentId ?? null}
                onCreatePosition={(position) => createCommentPosition(photoSlide.photoId, position)}
                onSelectComment={(comment) => {
                  setDraftComment(null)
                  setSelectedComment(comment)
                  setCommentMode(false)
                }}
              />
            </div>
          )
        },
        thumbnail: ({ slide, rect }) => {
          if (!isImageSlide(slide)) {
            return null
          }

          const photoSlide = slide as PhotoSlide

          return (
            <div
              className="relative overflow-hidden thumbnail-bg"
              style={{
                width: rect.width,
                height: rect.height,
              }}
            >
              {photoSlide.thumbHashUrl && (
                <img
                  src={photoSlide.thumbHashUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full scale-110 blur-sm object-cover"
                  aria-hidden
                />
              )}
              <img
                src={photoSlide.thumbnail}
                alt={photoSlide.alt}
                width={photoSlide.width}
                height={photoSlide.height}
                draggable={false}
                className="h-full w-full select-none object-cover"
                crossOrigin="anonymous"
                onError={(event) => {
                  event.currentTarget.style.display = "none"
                }}
              />
            </div>
          )
        }
      }}
    />
  )
}
