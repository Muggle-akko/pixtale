import { MyUploadsProvider } from "./provider"
import { getProxyUser } from "@/server/lib/proxy-user"
import { PHOTO_LIST_PAGE_SIZE } from "@/server/const/global"
import { photoService } from "@/server/service/photo-service"

interface MyUploadsLayoutProps {
  children: React.ReactNode
}

// 服务端查询本人上传照片第一页，并提供给虚拟筛选页初始化列表。
export default async function MyUploadsLayout({ children }: MyUploadsLayoutProps) {
  const proxyUser = await getProxyUser()

  if (!proxyUser) {
    return null
  }

  const data = await photoService.list({
    size: PHOTO_LIST_PAGE_SIZE,
    cursorPhotoId: null,
    cursorTime: null,
    favorite: null,
    status: null,
    albumId: null,
    mine: true,
  }, proxyUser.userId)

  return (
    <MyUploadsProvider initialPhotos={data.list}>
      {children}
    </MyUploadsProvider>
  )
}
