import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PackageCheck } from "lucide-react";
import type { Delivery } from "@mazate/contracts";
import { api } from "../../lib/api";
import { formatDate, initials } from "../../lib/format";
import { config } from "../../config/app";
import { ErrorNotice, Loading } from "../../components/ui/Feedback";
export function RecentDeliveries({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["activity", campaignId],
    queryFn: () => api<Delivery[]>(`/campaigns/${campaignId}/activity`),
    refetchInterval: config.refreshMs,
  });
  return (
    <section className="panel recent-panel">
      <div className="section-title">
        <h2>{t("lookup.recent")}</h2>
        <PackageCheck size={19} />
      </div>
      <p className="muted small">{t("lookup.recentHelp")}</p>
      <ErrorNotice error={query.error} />
      {query.isPending ? <Loading /> : null}
      {query.data?.length ? (
        <ul className="activity-list">
          {query.data.map((d) => (
            <li key={d.id}>
              <span className="avatar light">{initials(d.recipient_name)}</span>
              <div>
                <strong>{d.recipient_name}</strong>
                <span>{d.point_name}</span>
                <small>{formatDate(d.delivered_at)}</small>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-small">
          <PackageCheck size={34} />
          <p>{t("lookup.recentEmpty")}</p>
        </div>
      )}
    </section>
  );
}
