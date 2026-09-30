import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../lib/api";
export function ErrorNotice({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  const code = error instanceof ApiError ? error.code : "SERVER_ERROR";
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={20} />
      <span>
        {t(`errors.${code}`, { defaultValue: t("errors.SERVER_ERROR") })}
      </span>
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "success" | "warning";
}) {
  return (
    <div className={`notice ${tone}`} role="status">
      {tone === "success" ? (
        <CheckCircle2 size={20} />
      ) : (
        <AlertCircle size={20} />
      )}
      <span>{children}</span>
    </div>
  );
}
export function Loading() {
  const { t } = useTranslation();
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      {t("common.loading")}
    </div>
  );
}
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}
