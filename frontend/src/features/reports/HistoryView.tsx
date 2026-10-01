import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Search, PackageCheck, LogOut, Undo2 } from "lucide-react";
import type { HistoryReport, HistoryEvent } from "@mazate/contracts";
import { api } from "../../lib/api";
import { config } from "../../config/app";
import { formatDate } from "../../lib/format";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Input, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { ErrorNotice, Loading } from "../../components/ui/Feedback";
const labels: Record<string, string> = {
  "delivery.register": "Entrega registrada",
  "delivery.void": "Entrega anulada",
  "shift.close": "Turno cerrado",
  "campaign.status": "Jornada finalizada",
};
function EventDescription({ event: e }: { event: HistoryEvent }) {
  const Icon =
    e.action === "delivery.register"
      ? PackageCheck
      : e.action === "delivery.void"
        ? Undo2
        : LogOut;
  return (
    <div className="history-event">
      <span
        className={`event-icon ${e.action === "delivery.register" ? "green" : ""}`}
      >
        <Icon size={18} />
      </span>
      <div>
        <strong>{labels[e.action] ?? e.action}</strong>
        <small className="cell-secondary">
          {e.recipient_name ??
            String(e.detail.employeeName ?? e.campaign_name ?? "Jornada")}
        </small>
        {e.dpi && <small className="dpi-text cell-secondary">{e.dpi}</small>}
        {e.action === "delivery.void" && (
          <small className="cell-secondary">
            Motivo: {String(e.detail.reason ?? "—")}
          </small>
        )}
      </div>
    </div>
  );
}
export function HistoryView() {
  const { campaigns } = useWorkspace();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    ...filters,
    page: String(page),
  }).toString();
  const query = useQuery({
    queryKey: ["history", params],
    queryFn: () => api<HistoryReport>(`/history?${params}`),
    refetchInterval: config.refreshMs,
  });
  function filter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFilters(
      Object.fromEntries(
        [...new FormData(e.currentTarget)]
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, String(v)]),
      ),
    );
    setPage(1);
  }
  return (
    <div className="stack">
      <div className="history-intro">
        <History size={22} />
        <p>
          Cada entrega y cada cierre dejan un registro de la persona
          responsable, el punto y la hora.
        </p>
      </div>
      <form className="panel history-filters" onSubmit={filter}>
        <Input
          label="Buscar en el historial"
          name="q"
          placeholder="Persona, DPI o empleado"
          maxLength={120}
        />
        <Select label="Jornada" name="campaignId">
          <option value="">Todas las jornadas</option>
          {campaigns.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select label="Movimiento" name="kind">
          <option value="all">Todos los movimientos</option>
          <option value="delivery">Entregas y anulaciones</option>
          <option value="closure">Cierres de turno y jornada</option>
        </Select>
        <Input label="Desde" type="date" name="from" />
        <Input label="Hasta" type="date" name="to" />
        <Button>
          <Search size={16} />
          Consultar
        </Button>
      </form>
      <ErrorNotice error={query.error} />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <h2>Actividad registrada</h2>
          <span className="muted small">
            {query.data?.total ?? "—"} movimientos · Hora de Guatemala
          </span>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.data?.rows.length ? (
          <>
            <div
              className="table-scroll history-desktop"
              tabIndex={0}
              role="region"
              aria-label="Historial de movimientos"
            >
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Movimiento / Persona</th>
                    <th>Jornada</th>
                    <th>Responsable</th>
                    <th>Punto</th>
                    <th>Fecha y hora</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.rows.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <EventDescription event={e} />
                      </td>
                      <td>{e.campaign_name ?? "—"}</td>
                      <td>{e.actor}</td>
                      <td>{e.point_name ?? "—"}</td>
                      <td className="date-cell">{formatDate(e.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="history-mobile">
              {query.data.rows.map((e) => (
                <article className="history-card" key={e.id}>
                  <EventDescription event={e} />
                  <dl>
                    <div>
                      <dt>Jornada</dt>
                      <dd>{e.campaign_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Responsable</dt>
                      <dd>{e.actor}</dd>
                    </div>
                    <div>
                      <dt>Punto</dt>
                      <dd>{e.point_name ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Fecha y hora</dt>
                      <dd>{formatDate(e.created_at)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state compact-empty">
            <History size={34} />
            <h2>Aquí quedará cada movimiento</h2>
            <p>No hay registros que coincidan con esta consulta.</p>
          </div>
        )}
        <div className="pagination">
          <Button
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            variant="ghost"
            disabled={
              !query.data || page * query.data.pageSize >= query.data.total
            }
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </section>
    </div>
  );
}
