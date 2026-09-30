import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Profile } from "@mazate/contracts";
import { api, post } from "../lib/api";
import { useWorkspace } from "../hooks/useWorkspace";
import { useMutationAction } from "../hooks/useMutationAction";
import { PageHeader, ErrorNotice, Notice } from "../components/ui/Feedback";
import { Input } from "../components/ui/Field";
import { Button } from "../components/ui/Button";
import { Dialog } from "../components/ui/Dialog";
import { CreateUser } from "../features/admin/CreateUser";
export default function TeamPage() {
  const { t } = useTranslation();
  const { points, profile } = useWorkspace();
  const [userOpen, setUserOpen] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const [target, setTarget] = useState<Profile | null>(null);
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<Profile[]>("/users"),
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
      {created ? <Notice tone="success">{t("team.userCreated")}</Notice> : null}
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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {["name", "role", "status", "actions"].map((key) => (
                  <th key={key}>{t(`common.${key}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.data?.map((u) => (
                <tr key={u.id}>
                  <td className="name-cell">{u.display_name}</td>
                  <td>{t(`common.${u.role}`)}</td>
                  <td>
                    <span
                      className={`badge ${u.active ? "success" : "neutral"}`}
                    >
                      {t(`common.${u.active ? "active" : "inactive"}`)}
                    </span>
                  </td>
                  <td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <CreateUser
        open={userOpen}
        onClose={() => setUserOpen(false)}
        onCreated={() => setCreated(true)}
      />
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
                  .then(() => setTarget(null))
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
