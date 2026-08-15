// 这个模块定义审计记录页面使用的数据。

interface AuditLogVo {
  auditId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string | null;
  details: Record<string, unknown> | null;
  createTime: string;
}

export type { AuditLogVo };
