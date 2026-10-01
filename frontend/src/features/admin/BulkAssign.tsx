import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Plus, Users } from "lucide-react";
import type { TeamUser } from "@mazate/contracts";
import { api, post } from "../../lib/api";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useMutationAction } from "../../hooks/useMutationAction";
import { Dialog } from "../../components/ui/Dialog";
import { Input, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { ErrorNotice, Loading } from "../../components/ui/Feedback";
import { initials } from "../../lib/format";
export function BulkAssign({
  campaignId,
  onClose,
  onSaved,
}: {
  campaignId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { points } = useWorkspace();
  const [selected, setSelected] = useState<string[]>([]);
  const [pointId, setPointId] = useState("");
  const [newPoint, setNewPoint] = useState(false);
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<TeamUser[]>("/users"),
  });
  const employees =
    users.data?.filter((u) => u.role === "operator" && u.active) ?? [];
  const action = useMutationAction(
    () =>
      api(`/campaigns/${campaignId}/assignments`, {
        method: "PUT",
        body: JSON.stringify({
          assignments: selected.map((userId) => ({ userId, pointId })),
        }),
      }),
    ["bootstrap", "assignments", "users", "history"],
  );
  const point = useMutationAction(
    (name: string) => post<{ id: string }>("/points", { name }),
    ["bootstrap"],
  );
  async function savePoint(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      const p = await point.mutateAsync(
        String(new FormData(e.currentTarget).get("name")),
      );
      setPointId(p.id);
      setNewPoint(false);
    } catch {
      /* Visible feedback. */
    }
  }
  return (
    <>
      <Dialog
        open
        title="Asignar empleados"
        onClose={() => {
          if (!action.isPending) onClose();
        }}
      >
        <div className="stack">
          <p className="muted">
            Selecciona quiénes atenderán en este punto. Puedes asignar otro
            grupo a un punto diferente.
          </p>
          <div className="point-select-row">
            <Select
              label="Punto de entrega"
              value={pointId}
              onChange={(e) => setPointId(e.target.value)}
            >
              <option value="">Selecciona un punto</option>
              {points
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
            <Button
              variant="secondary"
              onClick={() => setNewPoint(true)}
              aria-label="Crear punto de entrega"
            >
              <MapPin size={17} />
              <Plus size={15} />
            </Button>
          </div>
          <div
            className="employee-checklist"
            role="group"
            aria-label="Empleados disponibles"
          >
            {users.isPending ? (
              <Loading />
            ) : employees.length ? (
              employees.map((u) => (
                <label
                  key={u.id}
                  className={`employee-choice ${selected.includes(u.id) ? "chosen" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(u.id)}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, u.id]
                          : current.filter((id) => id !== u.id),
                      )
                    }
                  />
                  <span className="avatar light">
                    {initials(u.display_name)}
                  </span>
                  <span>
                    <strong>{u.display_name}</strong>
                    <small>{u.email ?? "Empleado"}</small>
                  </span>
                </label>
              ))
            ) : (
              <div className="empty-state compact-empty">
                <Users />
                <p>Crea primero los accesos desde Empleados.</p>
              </div>
            )}
          </div>
          <small className="muted">
            Asignar nuevamente a un empleado también reabre su turno en esta
            jornada.
          </small>
          <ErrorNotice error={users.error || action.error} />
          <div className="actions end">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={action.isPending}
            >
              Cancelar
            </Button>
            <Button
              disabled={!pointId || !selected.length}
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
              Asignar {selected.length || ""} empleados
            </Button>
          </div>
        </div>
      </Dialog>
      <Dialog
        open={newPoint}
        title="Nuevo punto de entrega"
        onClose={() => {
          if (!point.isPending) setNewPoint(false);
        }}
      >
        <form className="stack" onSubmit={savePoint}>
          <Input
            label="Nombre del punto"
            name="name"
            placeholder="Ej. Centro comunal · Sector Norte"
            minLength={2}
            maxLength={100}
            required
          />
          <ErrorNotice error={point.error} />
          <Button busy={point.isPending}>Crear punto</Button>
        </form>
      </Dialog>
    </>
  );
}
