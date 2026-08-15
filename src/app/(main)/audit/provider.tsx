"use client"

import { createContext, useContext } from "react"
import { type AuditLogVo } from "@/server/entity/vo/audit-log"

const AuditContext = createContext<AuditLogVo[] | null>(null)

function useAuditLogs() {
  const logs = useContext(AuditContext)

  if (!logs) {
    throw new Error("useAuditLogs must be used within AuditProvider")
  }

  return logs
}

function AuditProvider({ logs, children }: { logs: AuditLogVo[]; children: React.ReactNode }) {
  return <AuditContext.Provider value={logs}>{children}</AuditContext.Provider>
}

export { AuditProvider, useAuditLogs }
