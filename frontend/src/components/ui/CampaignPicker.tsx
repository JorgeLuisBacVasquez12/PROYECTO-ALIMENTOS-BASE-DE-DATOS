import { CalendarDays } from "lucide-react";
import { useWorkspace } from "../../hooks/useWorkspace";
export function CampaignPicker() {
  const { campaign, campaigns, setCampaign } = useWorkspace();
  return (
    <label className="journey-picker">
      <CalendarDays size={19} />
      <span>
        <small>Jornada seleccionada</small>
        <select
          aria-label="Jornada"
          value={campaign?.id ?? ""}
          onChange={(e) => setCampaign(e.target.value)}
        >
          {!campaign && <option value="">Selecciona una jornada</option>}
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.status === "closed" ? " · cerrada" : ""}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
