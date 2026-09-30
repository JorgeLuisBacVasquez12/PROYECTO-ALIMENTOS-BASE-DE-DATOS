import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TeamUser } from "@mazate/contracts";
import { api } from "../../lib/api";
import { useMutationAction } from "../../hooks/useMutationAction";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { ErrorNotice } from "../../components/ui/Feedback";
import { AssignmentFields } from "./AssignmentFields";

export function AssignUser({
  user,
  onClose,
  onSaved,
}: {
  user: TeamUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [campaignId, setCampaignId] = useState("");
  const mutation = useMutationAction(
    (pointId: string) =>
      api(`/campaigns/${campaignId}/assignments`, {
        method: "PUT",
        body: JSON.stringify({ userId: user.id, pointId }),
      }),
    ["users", "assignments", "bootstrap"],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await mutation.mutateAsync(
        String(new FormData(event.currentTarget).get("pointId")),
      );
      onSaved();
      onClose();
    } catch {
      /* Rendered below. */
    }
  }
  return (
    <Dialog
      open
      title={t("team.assignPoint")}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <form onSubmit={submit} className="stack">
        <strong>{user.display_name}</strong>
        <AssignmentFields
          campaignId={campaignId}
          onCampaignChange={setCampaignId}
        />
        <ErrorNotice error={mutation.error} />
        <Button busy={mutation.isPending}>{t("common.save")}</Button>
      </form>
    </Dialog>
  );
}
