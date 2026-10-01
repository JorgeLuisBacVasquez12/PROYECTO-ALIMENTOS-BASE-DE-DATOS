import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { post } from "../../lib/api";
import { useMutationAction } from "../../hooks/useMutationAction";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Field";
import { PasswordInput } from "../../components/ui/PasswordInput";
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
        role: "operator",
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
      setCampaignId("");
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
        <p className="muted">
          Crea el acceso para el punto de registro. El empleado podrá buscar un
          DPI, entregar el alimento y cerrar su turno.
        </p>
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
        <PasswordInput
          name="password"
          label={t("team.initialPassword")}
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
        <div className="actions end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancelar
          </Button>
          <Button busy={mutation.isPending}>Crear empleado</Button>
        </div>
      </form>
    </Dialog>
  );
}
