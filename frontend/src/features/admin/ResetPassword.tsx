import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TeamUser } from "@mazate/contracts";
import { post } from "../../lib/api";
import { useMutationAction } from "../../hooks/useMutationAction";
import { Dialog } from "../../components/ui/Dialog";
import { Input } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { ErrorNotice, Notice } from "../../components/ui/Feedback";

export function ResetPassword({
  user,
  onClose,
  onSaved,
}: {
  user: TeamUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [mismatch, setMismatch] = useState(false);
  const mutation = useMutationAction((password: string) =>
    post(`/users/${user.id}/password`, { password }),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password"));
    setMismatch(password !== values.get("repeat"));
    if (password !== values.get("repeat")) return;
    try {
      await mutation.mutateAsync(password);
      form.reset();
      onSaved();
      onClose();
    } catch {
      /* Rendered below. */
    }
  }
  return (
    <Dialog
      open
      title={t("team.resetPassword")}
      onClose={() => {
        if (!mutation.isPending) onClose();
      }}
    >
      <form onSubmit={submit} className="stack">
        <div>
          <strong>{user.display_name}</strong>
          <p className="muted">{user.email}</p>
        </div>
        <Input
          name="password"
          label={t("auth.newPassword")}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          help={t("team.passwordHelp")}
        />
        <Input
          name="repeat"
          label={t("auth.repeatPassword")}
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
        />
        {mismatch ? (
          <Notice tone="warning">{t("auth.passwordMismatch")}</Notice>
        ) : null}
        <ErrorNotice error={mutation.error} />
        <Button busy={mutation.isPending}>{t("team.resetPassword")}</Button>
      </form>
    </Dialog>
  );
}
