import { useState } from "react";
import type { ImportPlan } from "@mazate/contracts";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/Button";
import { Notice, ErrorNotice } from "../../components/ui/Feedback";
import { download } from "../../lib/api";
export function ImportReview({
  plan,
  busy,
  onCommit,
  onBack,
}: {
  plan: ImportPlan;
  busy: boolean;
  onCommit: (skip: boolean) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const [skip, setSkip] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <div className="stack">
      <div className="stats-grid">
        {[
          ["valid", plan.valid],
          ["invalid", plan.invalid],
          ["existing", plan.existing],
        ].map(([key, value]) => (
          <div className="stat-card" key={key}>
            <div>
              <span>{t(`import.${key}`)}</span>
              <strong>{value}</strong>
            </div>
          </div>
        ))}
      </div>
      <section className="panel stack">
        <h2>{t("import.sampleNames")}</h2>
        {plan.sample.map((p) => (
          <div className="sample-person" key={p.dpi}>
            <span className="dpi-text">{p.dpi}</span>
            <strong>{p.full_name}</strong>
          </div>
        ))}
        <Notice>{t("import.replaceNote")}</Notice>
      </section>
      {plan.invalid ? (
        <section className="panel stack">
          <div className="section-title">
            <h2>{t("import.issues")}</h2>
            <Button
              variant="secondary"
              onClick={() => {
                void download(
                  `/imports/${plan.id}/issues`,
                  "incidencias-importacion.json",
                ).catch(setError);
              }}
            >
              {t("import.downloadIssues")}
            </Button>
          </div>
          <ErrorNotice error={error} />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("import.row")}</th>
                  <th>{t("common.dpi")}</th>
                  <th>{t("import.issues")}</th>
                </tr>
              </thead>
              <tbody>
                {plan.issues.map((issue) => (
                  <tr key={issue.row}>
                    <td>{issue.row}</td>
                    <td className="dpi-text">{issue.dpi}</td>
                    <td>{t(`import.${issue.code}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {plan.issueCount > 100 ? (
            <p className="muted">{t("import.issuesLimited")}</p>
          ) : null}
          <label className="check-row">
            <input
              type="checkbox"
              checked={skip}
              onChange={(e) => setSkip(e.target.checked)}
            />
            {t("import.skipInvalid")}
          </label>
        </section>
      ) : null}
      <div className="actions end">
        <Button variant="secondary" disabled={busy} onClick={onBack}>
          {t("common.back")}
        </Button>
        <Button
          busy={busy}
          disabled={!plan.valid || (plan.invalid > 0 && !skip)}
          onClick={() => onCommit(skip)}
        >
          {t("import.commit", { count: plan.valid })}
        </Button>
      </div>
    </div>
  );
}
