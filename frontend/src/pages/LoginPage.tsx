import { useState, type FormEvent } from "react";
import { Landmark, LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";
import { config } from "../config/app";
import { Input } from "../components/ui/Field";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Button } from "../components/ui/Button";
export function LoginPage() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    const data = new FormData(event.currentTarget);
    try {
      const { error } = await supabase!.auth.signInWithPassword({
        email: String(data.get("email")).trim(),
        password: String(data.get("password")),
      });
      setError(Boolean(error));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-page">
      <section className="auth-brand">
        <div className="brand-line">
          <Landmark size={32} />
          <span>{config.organization}</span>
        </div>
        <div>
          <p className="eyebrow">{config.appName}</p>
          <h1>{t("auth.brandTitle")}</h1>
          <p>{t("auth.brandText")}</p>
        </div>
        <small>{t("auth.restricted")}</small>
      </section>
      <section className="auth-content">
        <form className="login-card stack" onSubmit={submit}>
          <div className="login-icon">
            <LockKeyhole size={26} />
          </div>
          <div>
            <h2>{t("auth.title")}</h2>
            <p className="muted">{t("auth.subtitle")}</p>
          </div>
          <Input
            label={t("common.email")}
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <PasswordInput
            label={t("common.password")}
            name="password"
            autoComplete="current-password"
            required
          />
          {error ? (
            <p className="notice error" role="alert">
              {t("auth.invalid")}
            </p>
          ) : null}
          <Button type="submit" busy={busy}>
            {t("auth.submit")}
          </Button>
        </form>
      </section>
    </main>
  );
}
