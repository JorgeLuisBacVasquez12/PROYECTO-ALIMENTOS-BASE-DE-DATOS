import { useState, type FormEvent } from "react";
import { Search, IdCard, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "../hooks/useWorkspace";
import { useDpiLookup } from "../hooks/useDpiLookup";
import { useOnline } from "../hooks/useOnline";
import { StatsCards } from "../features/lookup/StatsCards";
import { RecentDeliveries } from "../features/lookup/RecentDeliveries";
import { LookupResult } from "../features/lookup/LookupResult";
import { ConfirmDelivery } from "../features/lookup/ConfirmDelivery";
import { Button } from "../components/ui/Button";
import {
  PageHeader,
  Notice,
  Loading,
  ErrorNotice,
} from "../components/ui/Feedback";
function LookupSurface({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const { campaign } = useWorkspace();
  const online = useOnline();
  const lookup = useDpiLookup(campaignId);
  const [invalid, setInvalid] = useState(false);
  function submit(event: FormEvent) {
    event.preventDefault();
    setInvalid(!lookup.search());
  }
  return (
    <>
      <StatsCards campaignId={campaignId} />
      <div className="attention-grid">
        <section className="panel search-panel">
          <div className="section-title">
            <h2>{t("lookup.searchTitle")}</h2>
            <span className="badge neutral">
              <MapPin size={14} />
              {campaign?.point_name ?? t("common.none")}
            </span>
          </div>
          <p className="muted">{t("lookup.searchHelp")}</p>
          <form onSubmit={submit} className="dpi-form">
            <div className="dpi-input">
              <Search size={22} />
              <input
                aria-label={t("common.dpi")}
                value={lookup.draft}
                onChange={(e) => {
                  setInvalid(false);
                  lookup.change(e.target.value);
                }}
                placeholder={t("lookup.placeholder")}
                inputMode="numeric"
                autoComplete="off"
                maxLength={24}
                autoFocus
              />
              <span className="key-hint">↵</span>
            </div>
            <Button
              busy={lookup.query.isFetching && !!lookup.dpi}
              disabled={!online}
              type="submit"
            >
              {t("lookup.button")}
            </Button>
          </form>
          {invalid ? (
            <p role="alert" className="field-error">
              {t("lookup.invalidDpi")}
            </p>
          ) : null}
          <ErrorNotice error={lookup.query.error} />
          {lookup.dpi && lookup.query.isPending ? <Loading /> : null}
          {!lookup.dpi ? (
            <div className="lookup-empty">
              <span>
                <IdCard size={44} strokeWidth={1.3} />
              </span>
              <h3>{t("lookup.emptyTitle")}</h3>
              <p>{t("lookup.emptyText")}</p>
            </div>
          ) : lookup.query.data ? (
            <LookupResult
              result={lookup.query.data}
              receipt={lookup.delivery.data}
              onConfirm={() => lookup.setDialog(true)}
              disabled={
                !online ||
                campaign?.status !== "active" ||
                !campaign.point_id ||
                lookup.query.isError
              }
            />
          ) : null}
          {lookup.delivery.data ? (
            <Button variant="secondary" onClick={lookup.reset}>
              {t("lookup.nextPerson")}
            </Button>
          ) : null}
        </section>
        <RecentDeliveries campaignId={campaignId} />
      </div>
      {campaign?.status !== "active" ? (
        <Notice tone="warning">{t("lookup.closed")}</Notice>
      ) : !campaign.point_id ? (
        <Notice tone="warning">{t("lookup.noPoint")}</Notice>
      ) : null}
      <ConfirmDelivery
        open={lookup.dialog}
        person={lookup.query.data?.person ?? null}
        busy={lookup.delivery.isPending}
        offline={!online}
        error={lookup.delivery.error}
        onClose={() => lookup.setDialog(false)}
        onConfirm={() => {
          if (online) lookup.delivery.mutate();
        }}
      />
    </>
  );
}
export default function LookupPage() {
  const { t } = useTranslation();
  const { campaign } = useWorkspace();
  return (
    <div className="stack">
      <PageHeader title={t("lookup.title")} subtitle={t("lookup.subtitle")} />
      {campaign ? (
        <LookupSurface key={campaign.id} campaignId={campaign.id} />
      ) : (
        <section className="panel empty-state">
          <IdCard size={40} />
          <h2>{t("lookup.noCampaign")}</h2>
          <p>{t("lookup.noCampaignHelp")}</p>
        </section>
      )}
    </div>
  );
}
