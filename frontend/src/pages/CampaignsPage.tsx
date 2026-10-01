import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  CalendarDays,
  ArrowUpRight,
  Users,
  PackageCheck,
  Upload,
  Check,
  Clock3,
} from "lucide-react";
import type { Campaign } from "@mazate/contracts";
import { useWorkspace } from "../hooks/useWorkspace";
import { PageHeader, Notice } from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { CampaignAssignments } from "../features/admin/CampaignAssignments";
import { CreateCampaign } from "../features/admin/CreateCampaign";
import { CampaignCard } from "../features/admin/CampaignCard";
import { CampaignStatus } from "../features/admin/CampaignStatus";
import { formatDate } from "../lib/format";
export default function CampaignsPage() {
  const { campaign, campaigns, setCampaign } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState<Campaign | null>(null);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");
  const shown = campaigns.filter(
    (c) => filter === "all" || c.status === filter,
  );
  const metrics = [
    {
      label: "Jornadas en curso",
      value: campaigns.filter((c) => c.status === "active").length,
      icon: CalendarDays,
      tone: "green",
    },
    {
      label: "Turnos abiertos",
      value: campaigns
        .filter((c) => c.status === "active")
        .reduce((s, c) => s + c.open_shifts, 0),
      icon: Users,
      tone: "sand",
    },
    {
      label: "Entregas registradas",
      value: campaigns.reduce((s, c) => s + c.delivered, 0),
      icon: PackageCheck,
      tone: "rose",
    },
  ];
  return (
    <div className="stack">
      <PageHeader
        title="Jornadas de entrega"
        subtitle="Organiza a tu equipo. Acompaña cada entrega."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={18} />
            Nueva jornada
          </Button>
        }
      />
      {message && <Notice tone="success">{message}</Notice>}
      <div className="overview-grid">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div className="overview-card" key={label}>
            <span className={`overview-icon ${tone}`}>
              <Icon size={22} />
            </span>
            <div>
              <span>{label}</span>
              <strong>{value.toLocaleString("es-GT")}</strong>
            </div>
            <ArrowUpRight size={18} className="muted" />
          </div>
        ))}
      </div>
      <div className="section-title">
        <div className="segmented" aria-label="Filtrar jornadas">
          {[
            ["all", "Todas"],
            ["active", "En curso"],
            ["draft", "En preparación"],
            ["closed", "Finalizadas"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value!)}
              aria-pressed={filter === value}
              className={filter === value ? "active" : ""}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="muted small">{shown.length} jornadas</span>
      </div>
      {shown.length ? (
        <div className="journey-grid">
          {shown.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              selected={campaign?.id === c.id}
              onSelect={() => setCampaign(c.id)}
            />
          ))}
        </div>
      ) : (
        <section className="panel empty-state welcome-empty">
          <span className="empty-orbit">
            <CalendarDays size={38} />
          </span>
          <h2>
            {campaigns.length
              ? "No hay jornadas en este estado"
              : "Tu próxima jornada comienza aquí"}
          </h2>
          <p>
            {campaigns.length
              ? "Selecciona otro filtro para ver las demás jornadas."
              : "Crea una jornada para cada entrega: pollo, pizza o cualquier otro beneficio. Podrás cargar el Excel cuando esté listo."}
          </p>
          {!campaigns.length && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={17} />
              Crear primera jornada
            </Button>
          )}
        </section>
      )}
      {campaign && (
        <section className="panel journey-detail">
          <div className="section-title">
            <div>
              <span className="eyebrow">DETALLE DE LA JORNADA</span>
              <h2>{campaign.name}</h2>
              <p className="muted small">{campaign.benefit}</p>
            </div>
            <div className="actions">
              {campaign.status === "draft" && (
                <Link className="button secondary" to="/import">
                  <Upload size={16} />
                  Cargar Excel
                </Link>
              )}
              <Link className="button ghost" to="/reports">
                Ver consultas
                <ArrowUpRight size={17} />
              </Link>
              <Button
                variant={campaign.status === "active" ? "secondary" : "primary"}
                disabled={
                  campaign.status !== "active" &&
                  (!campaign.eligible || !campaign.employee_count)
                }
                onClick={() => setTarget(campaign)}
              >
                {campaign.status === "active"
                  ? "Finalizar jornada"
                  : campaign.status === "closed"
                    ? "Reabrir jornada"
                    : "Habilitar jornada"}
              </Button>
            </div>
          </div>
          {campaign.status === "draft" ? (
            <div className="setup-checks">
              <span className={campaign.eligible ? "ready" : ""}>
                {campaign.eligible ? <Check size={16} /> : <Clock3 size={16} />}
                Padrón:{" "}
                {campaign.eligible
                  ? `${campaign.eligible} personas`
                  : "pendiente del Excel"}
              </span>
              <span className={campaign.employee_count ? "ready" : ""}>
                {campaign.employee_count ? (
                  <Check size={16} />
                ) : (
                  <Clock3 size={16} />
                )}
                Equipo:{" "}
                {campaign.employee_count
                  ? `${campaign.employee_count} asignados`
                  : "por asignar"}
              </span>
              <small>Completa ambos pasos para habilitar.</small>
            </div>
          ) : campaign.closed_at ? (
            <div className="closure-note">
              <Check size={16} />
              Finalizada por {campaign.closed_by_name} ·{" "}
              {formatDate(campaign.closed_at)}
            </div>
          ) : (
            <p className="journey-rule">
              <Check size={16} />
              Una entrega por persona en esta jornada, en todos los puntos.
            </p>
          )}
          <CampaignAssignments
            key={campaign.id}
            campaignId={campaign.id}
            closed={campaign.status === "closed"}
          />
        </section>
      )}
      {creating && (
        <CreateCampaign
          onClose={() => setCreating(false)}
          onCreated={() => {
            setFilter("all");
            setMessage(
              "Jornada creada. Ahora prepara el padrón y asigna a tus empleados.",
            );
          }}
        />
      )}
      {target && (
        <CampaignStatus
          campaign={target}
          onClose={() => setTarget(null)}
          onSaved={() =>
            setMessage(
              target.status === "active"
                ? "Jornada finalizada. El cierre quedó guardado en el historial."
                : "Jornada habilitada. Tu equipo ya puede comenzar.",
            )
          }
        />
      )}
    </div>
  );
}
