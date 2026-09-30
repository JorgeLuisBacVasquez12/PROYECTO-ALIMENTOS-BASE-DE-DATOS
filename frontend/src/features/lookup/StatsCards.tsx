import { useQuery } from "@tanstack/react-query";
import { Users, PackageCheck, Clock3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Stats } from "@mazate/contracts";
import { api } from "../../lib/api";
import { config } from "../../config/app";
import { formatNumber } from "../../lib/format";
import { ErrorNotice } from "../../components/ui/Feedback";
export function StatsCards({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["stats", campaignId],
    queryFn: () => api<Stats>(`/campaigns/${campaignId}/stats`),
    refetchInterval: config.refreshMs,
  });
  const cards = [
    { key: "eligible" as const, icon: Users },
    { key: "delivered" as const, icon: PackageCheck },
    { key: "pending" as const, icon: Clock3 },
  ];
  return (
    <>
      <ErrorNotice error={query.error} />
      <div className="stats-grid">
        {cards.map(({ key, icon: Icon }) => (
          <div className={`stat-card ${key}`} key={key}>
            <div>
              <span>{t(`stats.${key}`)}</span>
              <strong>
                {query.data ? formatNumber(query.data[key]) : "—"}
              </strong>
            </div>
            <span className="stat-icon">
              <Icon size={22} />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
