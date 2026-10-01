import { useRef, useState, type FormEvent } from "react";
import {
  Search,
  IdCard,
  MapPin,
  ShieldCheck,
  LogOut,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "../hooks/useWorkspace";
import { useDpiLookup } from "../hooks/useDpiLookup";
import { useOnline } from "../hooks/useOnline";
import { LookupResult } from "../features/lookup/LookupResult";
import { ConfirmDelivery } from "../features/lookup/ConfirmDelivery";
import { CloseShift } from "../features/lookup/CloseShift";
import { Button } from "../components/ui/Button";
import { Loading, ErrorNotice } from "../components/ui/Feedback";
import { CampaignPicker } from "../components/ui/CampaignPicker";
import { formatDate } from "../lib/format";
function LookupSurface({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const { campaign } = useWorkspace();
  const online = useOnline();
  const lookup = useDpiLookup(campaignId);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  function submit(e: FormEvent) {
    e.preventDefault();
    setInvalid(!lookup.search());
  }
  return (
    <section className="panel search-panel operator-search">
      <div className="search-card-heading">
        <span className="soft-icon">
          <IdCard size={26} />
        </span>
        <div>
          <h2>Consulta de beneficiarios</h2>
          <p>Todo comienza con su DPI.</p>
        </div>
      </div>
      <form onSubmit={submit} className="operator-dpi-form">
        <label htmlFor="dpi-search">Número de DPI</label>
        <div className="dpi-form">
          <div className="dpi-input">
            <Search size={22} />
            <input
              id="dpi-search"
              ref={input}
              aria-label="DPI"
              value={lookup.draft}
              onChange={(e) => {
                setInvalid(false);
                lookup.change(e.target.value);
              }}
              placeholder="Ingresa los 13 dígitos"
              inputMode="numeric"
              autoComplete="off"
              maxLength={24}
              disabled={lookup.delivery.isPending}
              autoFocus
              aria-invalid={invalid}
              aria-describedby="dpi-help"
            />
          </div>
          <Button
            type="submit"
            busy={lookup.query.isFetching && !!lookup.dpi}
            disabled={!online || lookup.delivery.isPending}
          >
            Consultar DPI
          </Button>
        </div>
        <small id="dpi-help" className={invalid ? "field-error" : "muted"}>
          {invalid
            ? t("lookup.invalidDpi")
            : "Verifica que el número corresponda a la persona que estás atendiendo."}
        </small>
      </form>
      <ErrorNotice error={lookup.query.error} />
      {lookup.dpi && lookup.query.isPending ? (
        <Loading />
      ) : !lookup.dpi ? (
        <div className="lookup-empty">
          <span>
            <IdCard size={45} strokeWidth={1.3} />
          </span>
          <h3>Listos para ayudar</h3>
          <p>
            Busca a la persona para confirmar si puede recibir{" "}
            {campaign?.benefit.toLowerCase()} en esta jornada.
          </p>
        </div>
      ) : lookup.query.data ? (
        <LookupResult
          result={lookup.query.data}
          receipt={lookup.delivery.data}
          onConfirm={() => lookup.setDialog(true)}
          disabled={
            !online ||
            campaign?.status !== "active" ||
            !!campaign.shift_closed_at ||
            !campaign.point_id ||
            lookup.query.isError
          }
        />
      ) : null}
      {lookup.delivery.data && (
        <Button
          variant="secondary"
          onClick={() => {
            lookup.reset();
            input.current?.focus();
          }}
        >
          Atender a otra persona
        </Button>
      )}
      <div className="search-reassurance">
        <ShieldCheck size={16} />
        <span>
          Una entrega por persona. La verificación incluye todos los puntos de
          esta jornada.
        </span>
      </div>
      <ConfirmDelivery
        open={lookup.dialog}
        person={lookup.query.data?.person ?? null}
        busy={lookup.delivery.isPending}
        offline={!online}
        error={lookup.delivery.error}
        onClose={() => lookup.setDialog(false)}
        onConfirm={() => {
          if (online) lookup.delivery.mutate();
        }}
      />
    </section>
  );
}
export default function LookupPage() {
  const { campaign, campaigns, profile } = useWorkspace();
  const [closing, setClosing] = useState(false);
  const ready = campaign?.status === "active" && !campaign.shift_closed_at;
  return (
    <div className="operator-page stack">
      <div className="operator-greeting">
        <span className="eyebrow">PUNTO DE REGISTRO</span>
        <h1>Hola, {profile.display_name.split(" ")[0]}.</h1>
        <p>Una atención sencilla, una entrega segura.</p>
      </div>
      {campaigns.length > 0 && (
        <div className="operator-context">
          <CampaignPicker />
          <span className="point-label">
            <MapPin size={16} />
            {campaign?.point_name ?? "Sin punto asignado"}
          </span>
          {ready && (
            <Button variant="ghost" onClick={() => setClosing(true)}>
              <LogOut size={16} />
              Cerrar jornada
            </Button>
          )}
        </div>
      )}
      {ready && campaign ? (
        <LookupSurface key={campaign.id} campaignId={campaign.id} />
      ) : (
        <section className="panel empty-state operator-waiting">
          <span className="empty-orbit">
            {campaign?.shift_closed_at ? (
              <CheckCircle2 size={40} />
            ) : (
              <CalendarClock size={40} />
            )}
          </span>
          <h2>
            {campaign?.shift_closed_at
              ? "Tu jornada ha finalizado"
              : campaign?.status === "closed"
                ? "Esta jornada está finalizada"
                : campaign
                  ? "Tu jornada se está preparando"
                  : "Todavía no tienes una jornada"}
          </h2>
          <p>
            {campaign?.shift_closed_at
              ? `Tu cierre quedó registrado el ${formatDate(campaign.shift_closed_at)}. Gracias por tu trabajo.`
              : campaign
                ? "El administrador te avisará cuando esté habilitada para atender."
                : "Cuando el administrador te asigne una jornada y un punto, aparecerán aquí."}
          </p>
          {campaigns.length > 1 && (
            <p className="small">
              Puedes seleccionar otra jornada asignada arriba.
            </p>
          )}
        </section>
      )}
      {closing && <CloseShift onClose={() => setClosing(false)} />}
    </div>
  );
}
