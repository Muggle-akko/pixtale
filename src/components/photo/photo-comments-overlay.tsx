"use client"

import { PencilIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { type PhotoCommentVo } from "@/server/entity/vo/photo-comment"

type CommentPosition = {
  xRatio: number
  yRatio: number
}

type PhotoCommentMarkersProps = {
  comments: PhotoCommentVo[]
  visible: boolean
  rotate: number
  selectedCommentId: string | null
  onSelect: (comment: PhotoCommentVo) => void
}

type PhotoCommentComposerProps = {
  position: CommentPosition | null
  comment: PhotoCommentVo | null
  saving: boolean
  deleting: boolean
  onSave: (body: string) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  labels: {
    placeholder: string
    add: string
    edit: string
    delete: string
    close: string
    deletedAuthor: string
  }
}

// 把评论标签固定在图片归一化坐标上，并反向旋转文字保持可读。
function PhotoCommentMarkers({ comments, visible, rotate, selectedCommentId, onSelect }: PhotoCommentMarkersProps) {
  if (!visible) {
    return null
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10" aria-label="Photo comments">
      {comments.map((comment) => (
        <button
          key={comment.commentId}
          type="button"
          className={[
            "pointer-events-auto absolute max-w-48 origin-top-left rounded-md border px-2 py-1 text-left text-xs leading-4 text-white shadow-lg backdrop-blur-sm transition-colors md:max-w-60",
            selectedCommentId === comment.commentId
              ? "border-white bg-black/85"
              : "border-white/30 bg-black/65 hover:bg-black/80",
          ].join(" ")}
          style={{
            left: `${comment.xRatio * 100}%`,
            top: `${comment.yRatio * 100}%`,
            transform: `translate(-6px, -6px) rotate(${-rotate}deg)`,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(comment)
          }}
        >
          <span className="block truncate font-medium text-white/75">
            {comment.authorName}
          </span>
          <span className="line-clamp-3 break-words">{comment.body}</span>
        </button>
      ))}
    </div>
  )
}

// 在查看器底部编辑新评论或作者自己的评论。
function PhotoCommentComposer({
  position,
  comment,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
  labels,
}: PhotoCommentComposerProps) {
  const [body, setBody] = useState(comment?.body ?? "")
  const editable = Boolean(position || comment?.isOwn)

  async function submit() {
    if (!editable || !body.trim()) {
      return
    }

    await onSave(body)
  }

  return (
    <div
      className="absolute bottom-16 left-1/2 z-[460] w-[min(24rem,calc(100vw-1rem))] -translate-x-1/2 rounded-lg border border-white/15 bg-black/85 p-2.5 text-white shadow-2xl backdrop-blur-md md:bottom-24"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-white/70">
        <span className="truncate">
          {position ? labels.add : `${comment?.authorDeleted ? labels.deletedAuthor : comment?.authorName}`}
        </span>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          title={labels.close}
          onClick={onClose}
        >
          <XIcon />
          <span className="sr-only">{labels.close}</span>
        </Button>
      </div>

      {editable ? (
        <Textarea
          value={body}
          maxLength={200}
          autoFocus
          className="min-h-20 resize-none border-white/20 bg-white/10 text-white placeholder:text-white/45"
          placeholder={labels.placeholder}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault()
              void submit()
            }
          }}
        />
      ) : (
        <p className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-5">
          {comment?.body}
        </p>
      )}

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-white/50">{editable ? `${body.length}/200` : ""}</span>
        <div className="flex gap-1.5">
          {comment?.canDelete && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={deleting || saving}
              className="text-red-300 hover:bg-red-500/15 hover:text-red-200"
              onClick={() => void onDelete()}
            >
              <Trash2Icon />
              {labels.delete}
            </Button>
          )}
          {editable && (
            <Button
              type="button"
              size="sm"
              disabled={!body.trim() || saving || deleting}
              className="bg-white text-black hover:bg-white/90"
              onClick={() => void submit()}
            >
              {comment ? <PencilIcon /> : <SendIcon />}
              {comment ? labels.edit : labels.add}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export { PhotoCommentComposer, PhotoCommentMarkers }
export type { CommentPosition }
