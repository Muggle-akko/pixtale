"use client"

import { useLocale, useTranslations } from "next-intl"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApp } from "@/app/(main)/provider"
import { useAuditLogs } from "./provider"

function formatDetails(details: Record<string, unknown> | null, t: (key: string, values?: Record<string, string | number>) => string) {
  if (!details) {
    return "-"
  }

  if (Array.isArray(details.photoIds)) {
    const orphanCount = Array.isArray(details.orphanPhotoIds) ? details.orphanPhotoIds.length : 0
    return t("photoCount", { count: details.photoIds.length, orphanCount })
  }

  if (typeof details.photoId === "string") {
    return t("photo", { id: details.photoId })
  }

  if (typeof details.canView === "boolean") {
    return t("permissions", {
      view: details.canView ? t("yes") : t("no"),
      upload: details.canUpload ? t("yes") : t("no"),
      deleteOwn: details.canDeleteOwn ? t("yes") : t("no"),
    })
  }

  return "-"
}

export default function AuditPage() {
  const t = useTranslations("audit")
  const locale = useLocale()
  const logs = useAuditLogs()
  const { sidebarOpen, setSidebarOpen } = useApp()

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-13 shrink-0 items-center gap-2 bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{t("title")}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="px-4 py-4">
          <div className="max-h-[calc(100dvh-5.25rem)] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="min-w-40">{t("time")}</TableHead>
                  <TableHead className="min-w-28">{t("actor")}</TableHead>
                  <TableHead className="min-w-36">{t("action")}</TableHead>
                  <TableHead className="min-w-44">{t("target")}</TableHead>
                  <TableHead className="min-w-72">{t("details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length ? logs.map((log) => (
                  <TableRow key={log.auditId}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.createTime))}
                    </TableCell>
                    <TableCell>{log.actorName}</TableCell>
                    <TableCell>{t(`actions.${log.action.replaceAll(".", "_")}`)}</TableCell>
                    <TableCell>
                      <div className="max-w-72 truncate" title={log.targetId ?? undefined}>
                        {log.targetName || log.targetId || t(`targets.${log.targetType.replaceAll("-", "_")}`)}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDetails(log.details, t)}</TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
