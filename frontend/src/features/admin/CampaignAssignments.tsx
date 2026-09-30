import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { Assignment, Profile } from "@mazate/contracts";
import { api } from "../../lib/api";
import { useWorkspace } from "../../hooks/useWorkspace";
import { useMutationAction } from "../../hooks/useMutationAction";
import { Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { ErrorNotice } from "../../components/ui/Feedback";
export function CampaignAssignments({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const { points } = useWorkspace();
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Profile[]>("/users"),
  });
  const assigned = useQuery({
    queryKey: ["assignments", campaignId],
    queryFn: () => api<Assignment[]>(`/campaigns/${campaignId}/assignments`),
  });
  const mutation = useMutationAction(
    (body: { userId: string; pointId: string }) =>
      api(`/campaigns/${campaignId}/assignments`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    ["assignments", "bootstrap"],
  );
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    mutation.mutate({
      userId: String(values.get("userId")),
      pointId: String(values.get("pointId")),
    });
  }
  return (
    <section className="panel stack">
      <h2>{t("campaigns.assignments")}</h2>
      <ErrorNotice error={users.error || assigned.error || mutation.error} />
      <form className="assignment-form" onSubmit={submit}>
        <Select
          label={t("campaigns.member")}
          name="userId"
          required
          defaultValue=""
        >
          <option value="" disabled>
            {t("common.select")}
          </option>
          {users.data
            ?.filter((u) => u.active)
            .map((u) => (
              <option value={u.id} key={u.id}>
                {u.display_name}
              </option>
            ))}
        </Select>
        <Select
          label={t("common.point")}
          name="pointId"
          required
          defaultValue=""
        >
          <option value="" disabled>
            {t("common.select")}
          </option>
          {points
            .filter((p) => p.active)
            .map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
        </Select>
        <Button busy={mutation.isPending}>{t("campaigns.assign")}</Button>
      </form>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>{t("campaigns.member")}</th>
              <th>{t("common.point")}</th>
            </tr>
          </thead>
          <tbody>
            {assigned.data?.map((a) => (
              <tr key={a.user_id}>
                <td>{a.display_name}</td>
                <td>{a.point_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!assigned.data?.length ? (
          <p className="table-empty">{t("common.empty")}</p>
        ) : null}
      </div>
    </section>
  );
}
