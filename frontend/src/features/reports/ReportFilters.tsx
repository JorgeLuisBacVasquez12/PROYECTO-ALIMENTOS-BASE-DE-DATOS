import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, RotateCcw } from "lucide-react";
import type { TeamUser } from "@mazate/contracts";
import { Input, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { ErrorNotice } from "../../components/ui/Feedback";
import { useWorkspace } from "../../hooks/useWorkspace";
import { api } from "../../lib/api";
export function ReportFilters({
  campaignId,
  onChange,
}: {
  campaignId: string;
  onChange: (value: Record<string, string>) => void;
}) {
  const { points } = useWorkspace();
  const [expanded, setExpanded] = useState(false);
  const sectors = useQuery({
    queryKey: ["report-options", campaignId],
    queryFn: () =>
      api<{ sectors: string[] }>(`/campaigns/${campaignId}/report-options`),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<TeamUser[]>("/users"),
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onChange(
      Object.fromEntries(
        [...new FormData(event.currentTarget)]
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, String(v)]),
      ),
    );
  }
  return (
    <form
      className="panel report-filters"
      onSubmit={submit}
      onReset={() => onChange({})}
    >
      <div className="filter-primary">
        <Input
          label="Buscar persona"
          name="q"
          maxLength={120}
          placeholder="Nombre o número de DPI"
        />
        <Select label="Entrega" name="status">
          <option value="all">Todas las personas</option>
          <option value="delivered">Recibieron</option>
          <option value="pending">No han recibido</option>
        </Select>
        <Select label="Sector" name="sector">
          <option value="">Todos los sectores</option>
          {sectors.data?.sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
        <Button type="submit">
          <Search size={17} />
          Consultar
        </Button>
      </div>
      <div className="filter-advanced" hidden={!expanded} id="advanced-filters">
        <Input
          label="Edad desde"
          name="ageMin"
          type="number"
          min={0}
          max={120}
          placeholder="0 años"
        />
        <Input
          label="Edad hasta"
          name="ageMax"
          type="number"
          min={0}
          max={120}
          placeholder="120 años"
        />
        <Select label="Punto de entrega" name="pointId">
          <option value="">Todos los puntos</option>
          {points.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Select label="Entregado por" name="operatorId">
          <option value="">Todos los empleados</option>
          {users.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.display_name}
            </option>
          ))}
        </Select>
        <Input label="Fecha desde" name="from" type="date" />
        <Input label="Fecha hasta" name="to" type="date" />
        <p className="muted small filter-help">
          Edad según el padrón cargado. Punto, empleado y fechas filtran
          entregas realizadas.
        </p>
      </div>
      <div className="filter-footer">
        <Button
          variant="ghost"
          type="button"
          aria-expanded={expanded}
          aria-controls="advanced-filters"
          onClick={() => setExpanded(!expanded)}
        >
          <SlidersHorizontal size={16} />
          {expanded ? "Menos filtros" : "Edad, empleado y fechas"}
        </Button>
        <Button type="reset" variant="ghost">
          <RotateCcw size={15} />
          Limpiar
        </Button>
      </div>
      <ErrorNotice error={sectors.error || users.error} />
    </form>
  );
}
