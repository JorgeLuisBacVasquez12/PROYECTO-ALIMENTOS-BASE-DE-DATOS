import { useState, type FormEvent } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Campaign } from "@mazate/contracts";
import { api, post } from "../lib/api";
import { useWorkspace } from "../hooks/useWorkspace";
import { useMutationAction } from "../hooks/useMutationAction";
import { PageHeader, ErrorNotice, Notice } from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import { Dialog } from "../components/ui/Dialog";
import { CampaignAssignments } from "../features/admin/CampaignAssignments";
export default function CampaignsPage() {
  const { t } = useTranslation();
  const { campaign, campaigns, setCampaign } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [statusTarget, setTarget] = useState<Campaign | null>(null);
  const create = useMutationAction(
    (body: { name: string; benefit: string }) => post("/campaigns", body),
    ["bootstrap"],
  );
  const status = useMutationAction(
    (c: Campaign) =>
      api(`/campaigns/${c.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status: c.status === "active" ? "closed" : "active",
        }),
      }),
    ["bootstrap"],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    try {
      await create.mutateAsync({
        name: String(values.get("name")),
        benefit: String(values.get("benefit")),
      });
      setCreating(false);
    } catch {
      /* Rendered below. */
    }
  }
  return (
    <div className="stack">
      <PageHeader
        title={t("campaigns.title")}
        subtitle={t("campaigns.subtitle")}
        actions={
          <Button
            onClick={() => {
              create.reset();
              setCreating(true);
            }}
          >
            <Plus size={18} />
            {t("campaigns.new")}
          </Button>
        }
      />
      <Notice>{t("campaigns.setup")}</Notice>
      <div className="campaign-grid">
        {campaigns.map((c) => (
          <section
            className={`panel campaign-card ${campaign?.id === c.id ? "is-selected" : ""}`}
            key={c.id}
          >
            <div className="section-title">
              <CalendarDays size={23} />
              <span
                className={`badge ${c.status === "active" ? "success" : "neutral"}`}
              >
                {t(`campaigns.${c.status}`)}
              </span>
            </div>
            <h2>{c.name}</h2>
            <p>{c.benefit}</p>
            <div className="actions">
              <Button
                variant="secondary"
                onClick={() => setCampaign(c.id)}
                disabled={campaign?.id === c.id}
              >
                {t("common.select")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  status.reset();
                  setTarget(c);
                }}
              >
                {t(
                  c.status === "active"
                    ? "campaigns.close"
                    : c.status === "closed"
                      ? "campaigns.reopen"
                      : "campaigns.activate",
                )}
              </Button>
            </div>
          </section>
        ))}
      </div>
      {!campaigns.length ? (
        <section className="panel empty-state">
          <CalendarDays size={40} />
          <p>{t("campaigns.empty")}</p>
        </section>
      ) : null}
      {campaign ? (
        <CampaignAssignments key={campaign.id} campaignId={campaign.id} />
      ) : null}
      <Dialog
        open={creating}
        title={t("campaigns.new")}
        onClose={() => {
          if (!create.isPending) setCreating(false);
        }}
      >
        <form className="stack" onSubmit={submit}>
          <Input
            label={t("campaigns.name")}
            name="name"
            required
            minLength={3}
            maxLength={120}
          />
          <Input
            label={t("campaigns.benefit")}
            name="benefit"
            required
            minLength={2}
            maxLength={120}
          />
          <ErrorNotice error={create.error} />
          <Button busy={create.isPending}>{t("common.save")}</Button>
        </form>
      </Dialog>
      <Dialog
        open={!!statusTarget}
        title={t("campaigns.confirmStatus")}
        onClose={() => {
          if (!status.isPending) setTarget(null);
        }}
      >
        <div className="stack">
          <strong>{statusTarget?.name}</strong>
          <ErrorNotice error={status.error} />
          <Button
            busy={status.isPending}
            onClick={() => {
              if (statusTarget)
                void status
                  .mutateAsync(statusTarget)
                  .then(() => setTarget(null))
                  .catch(() => {});
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
