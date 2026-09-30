import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { formatDate } from "../lib/format";
import { PageHeader, ErrorNotice, Loading } from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
interface Audit {
  id: string;
  action: string;
  actor: string;
  created_at: string;
  detail: {
    reason?: string;
    status?: string;
    rows?: number;
    imported?: number;
  };
}
export default function AuditPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["audit", page],
    queryFn: () => api<Audit[]>(`/audit?page=${page}`),
  });
  return (
    <div className="stack">
      <PageHeader title={t("audit.title")} subtitle={t("audit.subtitle")} />
      <ErrorNotice error={query.error} />
      <section className="panel table-panel">
        {query.isPending ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("common.date")}</th>
                  <th>{t("common.by")}</th>
                  <th>{t("audit.action")}</th>
                  <th>{t("audit.detail")}</th>
                </tr>
              </thead>
              <tbody>
                {query.data?.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>{row.actor}</td>
                    <td>{t(`audit.${row.action}`)}</td>
                    <td>
                      {row.detail.reason ??
                        (row.detail.status
                          ? t(`campaigns.${row.detail.status}`)
                          : (row.detail.imported ?? row.detail.rows ?? "—"))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pagination">
          <Button
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("common.previous")}
          </Button>
          <span>{t("reports.page", { page })}</span>
          <Button
            variant="ghost"
            disabled={(query.data?.length ?? 0) < 50}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next")}
          </Button>
        </div>
      </section>
    </div>
  );
}
