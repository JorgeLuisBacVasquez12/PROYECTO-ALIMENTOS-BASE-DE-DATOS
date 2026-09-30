import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { PageHeader, Notice } from "../components/ui/Feedback";
import { Input } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
export default function AccountPage() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const password = String(values.get("password"));
    if (password !== values.get("repeat")) {
      setMessage("auth.passwordMismatch");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase!.auth.updateUser({ password });
      setMessage(error ? "errors.SERVER_ERROR" : "auth.passwordSaved");
      if (!error) form.reset();
    } catch {
      setMessage("errors.SERVER_ERROR");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeader title={t("auth.accountTitle")} />
      <form className="panel stack narrow" onSubmit={submit}>
        <Input
          name="password"
          label={t("auth.newPassword")}
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          help={t("auth.passwordHelp")}
        />
        <Input
          name="repeat"
          label={t("auth.repeatPassword")}
          type="password"
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
        />
        {message ? (
          <Notice
            tone={message === "auth.passwordSaved" ? "success" : "warning"}
          >
            {t(message)}
          </Notice>
        ) : null}
        <Button busy={busy}>{t("common.save")}</Button>
      </form>
    </>
  );
}
