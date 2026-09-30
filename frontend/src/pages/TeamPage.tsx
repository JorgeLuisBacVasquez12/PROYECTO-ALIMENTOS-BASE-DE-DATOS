import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Profile, TeamUser } from "@mazate/contracts";
import { api, post } from "../lib/api";
import { useWorkspace } from "../hooks/useWorkspace";
import { useMutationAction } from "../hooks/useMutationAction";
import { PageHeader, ErrorNotice, Notice } from "../components/ui/Feedback";
import { Input } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { CreateUser } from "../features/admin/CreateUser";
import { ResetPassword } from "../features/admin/ResetPassword";
import { AssignUser } from "../features/admin/AssignUser";
export default function TeamPage() {
  const { t } = useTranslation();
  const { points, profile } = useWorkspace();
  const [userOpen, setUserOpen] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [passwordTarget, setPasswordTarget] = useState<TeamUser | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<TeamUser | null>(
    null,
  );
  const [target, setTarget] = useState<Profile | null>(null);
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<TeamUser[]>("/users"),
  });
  const point = useMutationAction(
    (name: string) => post("/points", { name }),
    ["bootstrap"],
  );
  const status = useMutationAction(
    (user: Profile) =>
      api(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      }),
    ["users"],
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await point.mutateAsync(
        String(new FormData(event.currentTarget).get("name")),
      );
      setPointOpen(false);
    } catch {
      /* Rendered below. */
    }
  }
  return (
    <div className="stack">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      {message ? <Notice tone="success">{t(message)}</Notice> : null}
      <section className="panel stack">
        <div className="section-title">
          <h2>{t("team.points")}</h2>
          <Button
            variant="secondary"
            onClick={() => {
              point.reset();
              setPointOpen(true);
            }}
          >
            <Plus size={17} />
            {t("team.newPoint")}
          </Button>
        </div>
        <div className="point-list">
          {points.map((p) => (
            <div className="point-item" key={p.id}>
              <MapPin size={20} />
              <strong>{p.name}</strong>
            </div>
          ))}
        </div>
        {!points.length ? <p className="muted">{t("common.empty")}</p> : null}
      </section>
      <section className="panel table-panel">
        <div className="table-toolbar">
          <h2>{t("team.users")}</h2>
          <Button onClick={() => setUserOpen(true)}>
            <Plus size={17} />
            {t("team.newUser")}
          </Button>
        </div>
        <ErrorNotice error={users.error} />
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={t("team.users")}
        >
          <table className="team-table">
            <thead>
              <tr>
                {["name", "role", "point", "status", "actions"].map((key) => (
                  <th key={key}>{t(`common.${key}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td className="name-cell">
                    <strong>{u.display_name}</strong>
                    <div className="muted">{u.email ?? "—"}</div>
                  </td>
                  <td>{t(`common.${u.role}`)}</td>
                  <td>
                    {u.assignments.length
                      ? u.assignments.map((a) => (
                          <div key={a.campaign_id}>
                            <strong>{a.point_name}</strong>
                            <div className="muted">{a.campaign_name}</div>
                          </div>
                        ))
                      : t("team.unassigned")}
                  </td>
                  <td>
                    <span
                      className={`badge ${u.active ? "success" : "neutral"}`}
                    >
                      {t(`common.${u.active ? "active" : "inactive"}`)}
                    </span>
                  </td>
                  <td>
                    <div className="team-actions">
                      {u.active ? (
                        <Button
                          variant="ghost"
                          onClick={() => setAssignmentTarget(u)}
                        >
                          {t("team.assignPoint")}
                        </Button>
                      ) : null}
                      {u.active && u.id !== profile.id ? (
                        <Button
                          variant="ghost"
                          onClick={() => setPasswordTarget(u)}
                        >
                          {t("team.resetPassword")}
                        </Button>
                      ) : null}
                      {u.id !== profile.id ? (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            status.reset();
                            setTarget(u);
                          }}
                        >
                          {t(u.active ? "team.disable" : "team.enable")}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {userOpen ? (
        <CreateUser
          open={userOpen}
          onClose={() => setUserOpen(false)}
          onCreated={() => setMessage("team.userCreated")}
        />
      ) : null}
      {passwordTarget ? (
        <ResetPassword
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onSaved={() => setMessage("team.passwordSaved")}
        />
      ) : null}
      {assignmentTarget ? (
        <AssignUser
          user={assignmentTarget}
          onClose={() => setAssignmentTarget(null)}
          onSaved={() => setMessage("team.assignmentSaved")}
        />
      ) : null}
      <Dialog
        open={pointOpen}
        title={t("team.newPoint")}
        onClose={() => {
          if (!point.isPending) setPointOpen(false);
        }}
      >
        <form onSubmit={submit} className="stack">
          <Input
            label={t("common.name")}
            name="name"
            minLength={2}
            maxLength={100}
            required
          />
          <ErrorNotice error={point.error} />
          <Button busy={point.isPending}>{t("common.save")}</Button>
        </form>
      </Dialog>
      <Dialog
        open={!!target}
        title={t("team.confirmStatus")}
        onClose={() => {
          if (!status.isPending) setTarget(null);
        }}
      >
        <div className="stack">
          <strong>{target?.display_name}</strong>
          <ErrorNotice error={status.error} />
          <Button
            busy={status.isPending}
            onClick={() => {
              if (target)
                void status
                  .mutateAsync(target)
                  .then(() => {
                    setMessage("team.statusSaved");
                    setTarget(null);
                  })
                  .catch(() => {});
            }}
          >
            {t("common.save")}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
