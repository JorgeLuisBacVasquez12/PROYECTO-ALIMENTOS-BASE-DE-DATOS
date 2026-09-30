import type { Delivery } from "@mazate/contracts";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../lib/format";
export function DeliveryDetails({ delivery }: { delivery: Delivery }) {
  const { t } = useTranslation();
  return (
    <dl className="detail-grid">
      <div>
        <dt>{t("common.point")}</dt>
        <dd>{delivery.point_name}</dd>
      </div>
      <div>
        <dt>{t("common.by")}</dt>
        <dd>{delivery.operator_name}</dd>
      </div>
      <div>
        <dt>{t("common.date")}</dt>
        <dd>{formatDate(delivery.delivered_at)}</dd>
      </div>
    </dl>
  );
}
