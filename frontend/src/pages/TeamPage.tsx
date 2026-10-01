import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Users,
  KeyRound,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import type { Profile, TeamUser } from "@mazate/contracts";
import { api } from "../lib/api";
import { useMutationAction } from "../hooks/useMutationAction";
import {
  PageHeader,
  ErrorNotice,
  Notice,
  Loading,
} from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { CreateUser } from "../features/admin/CreateUser";
import { ResetPassword } from "../features/admin/ResetPassword";
import { initials } from "../lib/format";
export default function TeamPage() {
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<TeamUser | null>(null);
  const [target, setTarget] = useState<Profile | null>(null);
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<TeamUser[]>("/users"),
  });
  const status = useMutationAction(
    (u: Profile) =>
      api(`/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !u.active }),
      }),
    ["users", "bootstrap", "assignments"],
  );
  const employees = users.data?.filter((u) => u.role === "operator") ?? [];
  const visible = employees.filter((u) =>
    `${u.display_name} ${u.email ?? ""}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <div className="stack">
      <PageHeader
        title="Tu equipo"
        subtitle="Crea sus accesos. Ellos se encargan de cada entrega."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} />
            Nuevo empleado
          </Button>
        }
      />
      {message && <Notice tone="success">{message}</Notice>}
      <div className="team-intro">
        <span className="soft-icon">
          <Users size={25} />
        </span>
        <div>
          <strong>
            {employees.filter((u) => u.active).length} empleados activos
          </strong>
          <p>
            Sus accesos permiten buscar DPI y registrar entregas en las jornadas
            que les asignes.
          </p>
        </div>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <h2>
            Empleados <span className="count-chip">{employees.length}</span>
          </h2>
          <label className="inline-search">
            <Search size={17} />
            <input
              aria-label="Buscar empleado"
              placeholder="Buscar nombre o correo"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <ErrorNotice error={users.error} />
        {users.isPending ? (
          <Loading />
        ) : visible.length ? (
          <div
            className="table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Empleados"
          >
            <table className="team-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Jornadas asignadas</th>
                  <th>Acceso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="table-person">
                        <span className="avatar light">
                          {initials(u.display_name)}
                        </span>
                        <div>
                          <strong>{u.display_name}</strong>
                          <small className="cell-secondary">
                            {u.email ?? "Sin correo registrado"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.assignments.length ? (
                        u.assignments.map((a) => (
                          <div key={a.campaign_id} className="assignment-label">
                            <strong>{a.campaign_name}</strong>
                            <small>{a.point_name}</small>
                          </div>
                        ))
                      ) : (
                        <span className="muted">Pendiente de asignar</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${u.active ? "success" : "neutral"}`}
                      >
                        <i className="status-dot" />
                        {u.active ? "Activo" : "Desactivado"}
                      </span>
                    </td>
                    <td>
                      <div className="team-actions">
                        {u.active && (
                          <Button
                            variant="ghost"
                            onClick={() => setPasswordTarget(u)}
                          >
                            <KeyRound size={15} />
                            Contraseña
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          onClick={() => {
                            status.reset();
                            setTarget(u);
                          }}
                        >
                          {u.active ? (
                            <UserRoundX size={15} />
                          ) : (
                            <UserRoundCheck size={15} />
                          )}{" "}
                          {u.active ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-orbit">
              <Users size={35} />
            </span>
            <h2>
              {search
                ? "No encontramos ese empleado"
                : "Un buen equipo comienza contigo"}
            </h2>
            <p>
              {search
                ? "Prueba con otro nombre o correo."
                : "Crea el primer acceso con nombre, correo y contraseña. Después podrás asignarlo a una jornada."}
            </p>
            {!search && (
              <Button onClick={() => setCreating(true)}>
                Crear primer empleado
              </Button>
            )}
          </div>
        )}
      </section>
      {creating && (
        <CreateUser
          open
          onClose={() => setCreating(false)}
          onCreated={() =>
            setMessage(
              "Acceso creado. El empleado ya puede iniciar sesión con los datos que configuraste.",
            )
          }
        />
      )}
      <p className="muted small">
        Asigna empleados y puntos de atención desde el detalle de cada jornada.
      </p>
      {passwordTarget && (
        <ResetPassword
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={() =>
            setMessage(
              "Contraseña actualizada. Comparte la nueva contraseña con el empleado.",
            )
          }
        />
      )}
      <Dialog
        open={!!target}
        title={
          target?.active ? "¿Desactivar este acceso?" : "¿Activar este acceso?"
        }
        onClose={() => {
          if (!status.isPending) setTarget(null);
        }}
      >
        <div className="stack">
          <div className="confirmation-hero">
            <Users size={32} />
            <h3>{target?.display_name}</h3>
            <p>
              {target?.active
                ? "Ya no podrá consultar ni registrar entregas. Su historial se conservará."
                : "Podrá volver a entrar y atender en sus jornadas habilitadas."}
            </p>
          </div>
          <ErrorNotice error={status.error} />
          <div className="actions end">
            <Button
              variant="secondary"
              onClick={() => setTarget(null)}
              disabled={status.isPending}
            >
              Cancelar
            </Button>
            <Button
              busy={status.isPending}
              onClick={() => {
                if (target)
                  void status
                    .mutateAsync(target)
                    .then(() => {
                      setMessage("Estado del acceso actualizado.");
                      setTarget(null);
                    })
                    .catch(() => {});
              }}
            >
              Confirmar cambio
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
