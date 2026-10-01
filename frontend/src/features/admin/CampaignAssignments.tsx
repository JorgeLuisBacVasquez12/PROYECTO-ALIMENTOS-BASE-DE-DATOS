import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Users, CheckCircle2 } from "lucide-react";
import type { Assignment } from "@mazate/contracts";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { ErrorNotice, Loading, Notice } from "../../components/ui/Feedback";
import { BulkAssign } from "./BulkAssign";
import { initials, formatDate } from "../../lib/format";
export function CampaignAssignments({
  campaignId,
  closed = false,
}: {
  campaignId: string;
  closed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const assigned = useQuery({
    queryKey: ["assignments", campaignId],
    queryFn: () => api<Assignment[]>(`/campaigns/${campaignId}/assignments`),
    refetchInterval: 15000,
  });
  return (
    <section className="assignment-section stack">
      <div className="section-title">
        <div>
          <h3>Equipo de esta jornada</h3>
          <p className="muted small">
            Turnos, puntos de entrega y cierres registrados.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={closed}
          onClick={() => setOpen(true)}
        >
          <UserPlus size={17} />
          Asignar empleados
        </Button>
      </div>
      {saved && (
        <Notice tone="success">
          Equipo asignado. Los empleados ya verán la jornada al entrar.
        </Notice>
      )}
      <ErrorNotice error={assigned.error} />
      {assigned.isPending ? (
        <Loading />
      ) : assigned.data?.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Empleado</th>
                <th>Punto de entrega</th>
                <th>Entregas</th>
                <th>Turno</th>
              </tr>
            </thead>
            <tbody>
              {assigned.data.map((a) => (
                <tr key={a.user_id}>
                  <td>
                    <div className="table-person">
                      <span className="avatar light">
                        {initials(a.display_name)}
                      </span>
                      <strong>{a.display_name}</strong>
                    </div>
                  </td>
                  <td>{a.point_name}</td>
                  <td>{a.delivered}</td>
                  <td>
                    {a.closed_at ? (
                      <>
                        <span className="badge neutral">
                          <CheckCircle2 size={13} />
                          Finalizado
                        </span>
                        <small className="cell-secondary">
                          {formatDate(a.closed_at)}
                          <br />
                          {a.closed_by_name}
                        </small>
                      </>
                    ) : (
                      <span className="badge success">
                        <i className="status-dot" />
                        Abierto
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="inline-empty">
          <Users size={27} />
          <div>
            <strong>Aún no hay empleados asignados</strong>
            <p>Elige quién atenderá y desde qué punto.</p>
          </div>
        </div>
      )}
      {open && (
        <BulkAssign
          campaignId={campaignId}
          onClose={() => setOpen(false)}
          onSaved={() => setSaved(true)}
        />
      )}
    </section>
  );
}
