import { AuditProvider } from "./provider"
import { getProxyUser } from "@/server/lib/proxy-user"
import { UserTypeEnum } from "@/server/enums/user-enum"
import { auditLogService } from "@/server/service/audit-log-service"

export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  const user = await getProxyUser()

  if (!user || user.type !== UserTypeEnum.ADMIN) {
    return null
  }

  const logs = await auditLogService.list(user.userId)

  return <AuditProvider logs={logs}>{children}</AuditProvider>
}
