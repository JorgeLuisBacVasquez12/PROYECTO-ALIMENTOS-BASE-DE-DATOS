import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Person } from "@mazate/contracts";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { ErrorNotice, Notice } from "../../components/ui/Feedback";
export function ConfirmDelivery({
  open,
  person,
  busy,
  offline,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  person: Person | null;
  busy: boolean;
  offline: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  useEffect(() => setChecked(false), [open]);
  return (
    <Dialog
      open={open}
      title={t("lookup.dialogTitle")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <div className="stack">
        <p className="muted">{t("lookup.dialogText")}</p>
        <div className="confirmation-person">
          <strong>{person?.full_name}</strong>
          <span className="dpi-text">{person?.dpi}</span>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          {t("lookup.verified")}
        </label>
        {offline ? (
          <Notice tone="warning">{t("connection.offline")}</Notice>
        ) : null}
        <ErrorNotice error={error} />
        <div className="actions end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            busy={busy}
            disabled={!checked || offline}
            onClick={onConfirm}
          >
            {t("lookup.confirm")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
