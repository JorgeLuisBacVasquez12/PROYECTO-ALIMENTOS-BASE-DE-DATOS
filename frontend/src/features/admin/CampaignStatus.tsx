import { Power, LockKeyhole } from "lucide-react";
import type { Campaign } from "@mazate/contracts";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { ErrorNotice } from "../../components/ui/Feedback";
import { useMutationAction } from "../../hooks/useMutationAction";
import { api } from "../../lib/api";
export function CampaignStatus({
  campaign: c,
  onClose,
  onSaved,
}: {
  campaign: Campaign;
  onClose: () => void;
  onSaved: () => void;
}) {
  const closing = c.status === "active";
  const action = useMutationAction(
    () =>
      api(`/campaigns/${c.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: closing ? "closed" : "active" }),
      }),
    ["bootstrap", "assignments", "users", "history"],
  );
  return (
    <Dialog
      open
      title={
        closing
          ? "¿Finalizar esta jornada?"
          : c.status === "closed"
            ? "¿Reabrir la jornada?"
            : "Todo listo para comenzar"
      }
      onClose={() => {
        if (!action.isPending) onClose();
      }}
    >
      <div className="stack">
        <div className={`confirmation-hero ${closing ? "warm" : ""}`}>
          {closing ? <LockKeyhole size={34} /> : <Power size={34} />}
          <h3>{c.name}</h3>
          <p>
            {closing
              ? "Se cerrarán los turnos abiertos y no se podrán registrar nuevas entregas. El historial conservará quién cerró y a qué hora."
              : c.status === "closed"
                ? "Se abrirán los turnos asignados. Las entregas anteriores se conservan y no podrán repetirse."
                : "Tus empleados asignados podrán consultar DPI y entregar el alimento desde sus puntos."}
          </p>
        </div>
        <ErrorNotice error={action.error} />
        <div className="actions end">
          <Button
            variant="secondary"
            disabled={action.isPending}
            onClick={onClose}
          >
            Volver
          </Button>
          <Button
            busy={action.isPending}
            onClick={() =>
              void action
                .mutateAsync(undefined)
                .then(() => {
                  onSaved();
                  onClose();
                })
                .catch(() => {})
            }
          >
            {closing ? "Sí, finalizar jornada" : "Habilitar jornada"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
