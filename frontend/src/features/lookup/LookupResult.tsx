import {
  CheckCircle2,
  ShieldAlert,
  UserRoundX,
  IdCard,
  PackageCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Lookup, DeliveryResult } from "@mazate/contracts";
import { Button } from "../../components/ui/Button";
import { DeliveryDetails } from "./DeliveryDetails";
export function LookupResult({
  result,
  receipt,
  onConfirm,
  disabled,
}: {
  result: Lookup;
  receipt?: DeliveryResult;
  onConfirm: () => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const mode =
    receipt?.outcome === "registered"
      ? "confirmed"
      : receipt?.outcome === "replayed"
        ? "replayed"
        : result.state === "not_found"
          ? "notFound"
          : receipt || result.state === "delivered"
            ? "delivered"
            : "available";
  const delivery = receipt?.delivery ?? result.delivery;
  const Icon =
    mode === "available"
      ? CheckCircle2
      : mode === "confirmed"
        ? PackageCheck
        : mode === "notFound"
          ? UserRoundX
          : ShieldAlert;
  return (
    <div className={`lookup-result ${mode}`} aria-live="polite">
      <div className="result-heading">
        <Icon size={26} />
        <div>
          <strong>{t(`lookup.${mode}`)}</strong>
          <p>{t(`lookup.${mode}Help`)}</p>
        </div>
      </div>
      {result.person ? (
        <div className="person-card">
          <span className="person-symbol">
            <IdCard size={28} />
          </span>
          <div>
            <span>{t("common.person")}</span>
            <h3>{result.person.full_name}</h3>
            <p className="dpi-text">{result.person.dpi}</p>
            {result.person.sector ? (
              <p className="person-sector">{result.person.sector}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {delivery ? <DeliveryDetails delivery={delivery} /> : null}
      {mode === "available" ? (
        <Button onClick={onConfirm} disabled={disabled}>
          <PackageCheck size={18} />
          {t("lookup.register")}
        </Button>
      ) : null}
    </div>
  );
}
