import { LogOut, CheckCircle2 } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Button } from "../../components/ui/Button";
import { ErrorNotice } from "../../components/ui/Feedback";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useMutationAction } from "../../hooks/useMutationAction";
import { post } from "../../lib/api";
export function CloseShift({ onClose }: { onClose: () => void }) {
  const { campaign, setCampaign, profile } = useWorkspace();
  const action = useMutationAction(
    () => post(`/campaigns/${campaign!.id}/shift/close`, {}),
    ["bootstrap", "assignments", "history"],
  );
  return (
    <Dialog
      open
      title="¿Finalizar tu jornada?"
      onClose={() => {
        if (!action.isPending) onClose();
      }}
    >
      <div className="stack">
        <div className="confirmation-hero">
          <span className="soft-icon">
            <CheckCircle2 size={32} />
          </span>
          <h3>{campaign?.name}</h3>
          <p>
            Finalizarás tu turno en <strong>{campaign?.point_name}</strong>. Los
            demás empleados podrán seguir atendiendo.
          </p>
        </div>
        <div className="confirmation-person">
          <strong>{profile.display_name}</strong>
          <span>Tu nombre, punto y hora de cierre quedarán registrados.</span>
        </div>
        <ErrorNotice error={action.error} />
        <div className="actions end">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={action.isPending}
          >
            Seguir atendiendo
          </Button>
          <Button
            busy={action.isPending}
            onClick={() => {
              setCampaign(campaign!.id);
              void action
                .mutateAsync(undefined)
                .then(onClose)
                .catch(() => {});
            }}
          >
            <LogOut size={17} />
            Finalizar mi jornada
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
