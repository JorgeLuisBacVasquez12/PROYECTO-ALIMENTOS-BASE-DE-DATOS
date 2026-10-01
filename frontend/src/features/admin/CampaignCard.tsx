import {
  ArrowUpRight,
  Users,
  Package,
  Drumstick,
  Pizza,
  Candy,
} from "lucide-react";
import type { Campaign } from "@mazate/contracts";
const number = (v: number) => new Intl.NumberFormat("es-GT").format(v);
export function CampaignCard({
  campaign: c,
  selected,
  onSelect,
}: {
  campaign: Campaign;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = /pollo/i.test(c.benefit)
    ? Drumstick
    : /pizza/i.test(c.benefit)
      ? Pizza
      : /chocolate/i.test(c.benefit)
        ? Candy
        : Package;
  const percent = c.eligible
    ? Math.min(100, Math.round((c.delivered / c.eligible) * 100))
    : 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`journey-card campaign-card ${selected ? "is-selected" : ""}`}
      aria-pressed={selected}
      aria-label={`Ver jornada ${c.name}`}
    >
      <div className="journey-card-top">
        <span className={`food-icon food-${c.status}`}>
          <Icon size={25} />
        </span>
        <span
          className={`badge ${c.status === "active" ? "success" : c.status === "draft" ? "warm" : "neutral"}`}
        >
          {c.status === "active" && <i className="status-dot" />}
          {c.status === "active"
            ? "En curso"
            : c.status === "draft"
              ? "En preparación"
              : "Finalizada"}
        </span>
      </div>
      <h2>{c.name}</h2>
      <p className="benefit-label">{c.benefit}</p>
      <div className="journey-progress-label">
        <span>
          <strong>{number(c.delivered)}</strong>{" "}
          {c.delivered === 1 ? "entrega" : "entregas"}
        </span>
        <span>{c.eligible ? `${percent}%` : "Padrón pendiente"}</span>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`Avance de ${c.name}`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="journey-card-bottom">
        <span>
          <Users size={15} />
          {c.open_shifts} de {c.employee_count} turnos abiertos
        </span>
        <ArrowUpRight size={19} />
      </div>
    </button>
  );
}
