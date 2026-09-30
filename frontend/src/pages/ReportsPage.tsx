import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Report, ReportRow } from "@mazate/contracts";
import { useWorkspace } from "../hooks/useWorkspace";
import { useMutationAction } from "../hooks/useMutationAction";
import { api, post, download } from "../lib/api";
import { config } from "../config/app";
import {
  PageHeader,
  ErrorNotice,
  Loading,
  Notice,
} from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { ReportFilters } from "../features/reports/ReportFilters";
import { ReportTable } from "../features/reports/ReportTable";
import { StatsCards } from "../features/lookup/StatsCards";
function ReportSurface({ id }: { id: string }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const params = new URLSearchParams({
    ...filters,
    page: String(page),
  }).toString();
  const query = useQuery({
    queryKey: ["report", id, params],
    queryFn: () => api<Report>(`/campaigns/${id}/report?${params}`),
    refetchInterval: config.refreshMs,
  });
  const exporter = useMutationAction(async () =>
    download(
      `/campaigns/${id}/export?${new URLSearchParams(filters)}`,
      "entregas.xlsx",
    ),
  );
  const voider = useMutationAction(
    async (reason: string) =>
      post(`/deliveries/${selected!.delivery_id}/void`, { reason }),
    ["report", "stats", "activity", "lookup", "audit"],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason"));
    try {
      await voider.mutateAsync(reason);
      setSelected(null);
    } catch {
      /* ErrorNotice renders the mutation error. */
    }
  }
  return (
    <>
      <StatsCards campaignId={id} />
      <ReportFilters
        onChange={(value) => {
          setFilters(value);
          setPage(1);
        }}
      />
      <ErrorNotice error={query.error || exporter.error} />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <strong>
            {t("reports.count", { count: query.data?.total ?? 0 })}
          </strong>
          <Button
            variant="secondary"
            busy={exporter.isPending}
            onClick={() => exporter.mutate(undefined)}
          >
            <Download size={17} />
            {t("reports.export")}
          </Button>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.data ? (
          <ReportTable
            rows={query.data.rows}
            onVoid={(row) => {
              voider.reset();
              setSelected(row);
            }}
          />
        ) : null}
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
            disabled={
              !query.data || page * query.data.pageSize >= query.data.total
            }
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next")}
          </Button>
        </div>
      </section>
      <Dialog
        open={!!selected}
        title={t("reports.voidTitle")}
        onClose={() => {
          if (!voider.isPending) setSelected(null);
        }}
      >
        <form onSubmit={submit} className="stack">
          <p>{t("reports.voidHelp")}</p>
          <strong>{selected?.full_name}</strong>
          <label className="field">
            <span>{t("reports.reason")}</span>
            <textarea
              name="reason"
              required
              minLength={10}
              maxLength={500}
              rows={3}
            />
            <small>{t("reports.reasonHelp")}</small>
          </label>
          <ErrorNotice error={voider.error} />
          <Button variant="danger" busy={voider.isPending}>
            {t("reports.void")}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
export default function ReportsPage() {
  const { t } = useTranslation();
  const { campaign } = useWorkspace();
  return (
    <div className="stack">
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      {campaign ? (
        <ReportSurface key={campaign.id} id={campaign.id} />
      ) : (
        <Notice>{t("lookup.noCampaign")}</Notice>
      )}
    </div>
  );
}
