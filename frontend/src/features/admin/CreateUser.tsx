import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { post } from "../../lib/api";
import { useMutationAction } from "../../hooks/useMutationAction";
import { Dialog } from "../../components/ui/Dialog";
import { Input, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { ErrorNotice } from "../../components/ui/Feedback";
import { AssignmentFields } from "./AssignmentFields";
export function CreateUser({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [campaignId, setCampaignId] = useState("");
  const mutation = useMutationAction(
    (body: unknown) => post("/users", body),
    ["users", "assignments", "bootstrap"],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const values = new FormData(form);
      await mutation.mutateAsync({
        displayName: String(values.get("displayName")),
        email: String(values.get("email")),
        password: String(values.get("password")),
        role: String(values.get("role")),
        ...(campaignId
          ? {
              assignment: {
                campaignId,
                pointId: String(values.get("pointId")),
              },
            }
          : {}),
      });
      form.reset();
      onCreated();
      onClose();
    } catch {
      /* Rendered below. */
    }
  }
  return (
    <Dialog
      open={open}
      title={t("team.newUser")}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <form className="stack" onSubmit={submit}>
        <Input
          name="displayName"
          label={t("common.name")}
          required
          minLength={3}
          maxLength={100}
        />
        <Input
          name="email"
          label={t("common.email")}
          type="email"
          autoComplete="off"
          required
        />
        <Select name="role" label={t("common.role")} defaultValue="operator">
          <option value="operator">{t("common.operator")}</option>
          <option value="admin">{t("common.admin")}</option>
        </Select>
        <Input
          name="password"
          label={t("team.initialPassword")}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          help={t("team.passwordHelp")}
        />
        <ErrorNotice error={mutation.error} />
        <AssignmentFields
          campaignId={campaignId}
          onCampaignChange={setCampaignId}
          optional
        />
        <Button busy={mutation.isPending}>{t("team.newUser")}</Button>
      </form>
    </Dialog>
  );
}
