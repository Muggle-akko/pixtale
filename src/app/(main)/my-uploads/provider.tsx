"use client"

import { createContext, useContext } from "react"

import { type PhotoVo } from "@/server/entity/vo/photo"

interface MyUploadsContextValue {
  // initialPhotos 保存服务端筛选出的本人上传照片首页数据。
  initialPhotos: PhotoVo[]
}

interface MyUploadsProviderProps {
  // children 是本人上传照片页内容。
  children: React.ReactNode
  // initialPhotos 保存服务端筛选出的本人上传照片首页数据。
  initialPhotos: PhotoVo[]
}

const MyUploadsContext = createContext<MyUploadsContextValue | null>(null)

// 读取本人上传照片页服务端预取的数据。
function useMyUploadsContext() {
  const context = useContext(MyUploadsContext)

  if (!context) {
    throw new Error("useMyUploadsContext must be used within MyUploadsProvider.")
  }

  return context
}

// 给本人上传照片页客户端组件提供服务端预取照片。
function MyUploadsProvider({ children, initialPhotos }: MyUploadsProviderProps) {
  return (
    <MyUploadsContext.Provider value={{ initialPhotos }}>
      {children}
    </MyUploadsContext.Provider>
  )
}

export { MyUploadsProvider, useMyUploadsContext }
