import type { FormEvent } from "react";
import { Leaf, ArrowRight } from "lucide-react";
import { Dialog } from "../../components/ui/Dialog";
import { Input, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { ErrorNotice } from "../../components/ui/Feedback";
import { useMutationAction } from "../../hooks/useMutationAction";
import { useWorkspace } from "../../hooks/useWorkspace";
import { post } from "../../lib/api";
export function CreateCampaign({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { campaigns, setCampaign } = useWorkspace();
  const action = useMutationAction(
    (body: unknown) => post<{ id: string }>("/campaigns", body),
    ["bootstrap"],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      const source = String(f.get("rosterSourceId"));
      const c = await action.mutateAsync({
        name: String(f.get("name")),
        benefit: String(f.get("benefit")),
        ...(source ? { rosterSourceId: source } : {}),
      });
      setCampaign(c.id);
      onCreated();
      onClose();
    } catch {
      /* Error rendered below. */
    }
  }
  return (
    <Dialog
      open
      title="Nueva jornada"
      onClose={() => {
        if (!action.isPending) onClose();
      }}
    >
      <form className="stack" onSubmit={submit}>
        <div className="dialog-intro">
          <span className="soft-icon">
            <Leaf size={26} />
          </span>
          <p>
            Prepara una entrega. Después asigna a tu equipo y habilita la
            jornada cuando esté lista.
          </p>
        </div>
        <Input
          label="Nombre de la jornada"
          name="name"
          placeholder="Ej. Entrega de pollo · Octubre"
          minLength={3}
          maxLength={120}
          required
        />
        <Input
          label="Alimento o beneficio"
          name="benefit"
          placeholder="Ej. Pollo"
          minLength={2}
          maxLength={120}
          required
        />
        <Select
          label="Padrón de beneficiarios"
          name="rosterSourceId"
          defaultValue=""
        >
          <option value="">Cargaré el Excel después</option>
          {campaigns
            .filter((c) => c.eligible > 0)
            .map((c) => (
              <option key={c.id} value={c.id}>
                Reutilizar padrón: {c.name}
              </option>
            ))}
        </Select>
        <p className="muted small">
          Cada jornada lleva su propio control: recibir aquí no impide recibir
          en otra.
        </p>
        <ErrorNotice error={action.error} />
        <div className="actions end">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={action.isPending}
          >
            Cancelar
          </Button>
          <Button busy={action.isPending}>
            Crear jornada
            <ArrowRight size={17} />
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
