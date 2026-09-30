import { useTranslation } from "react-i18next";
import { useWorkspace } from "../../hooks/useWorkspace";
import { Select } from "../../components/ui/Field";

export function AssignmentFields({
  campaignId,
  onCampaignChange,
  optional = false,
}: {
  campaignId: string;
  onCampaignChange: (id: string) => void;
  optional?: boolean;
}) {
  const { t } = useTranslation();
  const { campaigns, points } = useWorkspace();
  return (
    <>
      <Select
        name="campaignId"
        label={t("team.assignmentCampaign")}
        value={campaignId}
        onChange={(event) => onCampaignChange(event.target.value)}
        required={!optional}
      >
        <option value="">
          {t(optional ? "team.assignLater" : "common.select")}
        </option>
        {campaigns
          .filter((c) => c.status !== "closed")
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      {campaignId ? (
        <Select
          key={campaignId}
          name="pointId"
          label={t("common.point")}
          defaultValue=""
          required
        >
          <option value="" disabled>
            {t("common.select")}
          </option>
          {points
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
      ) : null}
    </>
  );
}
