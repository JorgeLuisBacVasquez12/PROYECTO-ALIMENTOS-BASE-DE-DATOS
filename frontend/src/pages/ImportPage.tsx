import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspace";
import { useImport } from "../hooks/useImport";
import { PageHeader, Notice, ErrorNotice } from "../components/ui/Feedback";
import { Button } from "../components/ui/Button";
import { FilePicker } from "../features/imports/FilePicker";
import { ColumnMapper } from "../features/imports/ColumnMapper";
import { ImportReview } from "../features/imports/ImportReview";
function ImportSurface({ id }: { id: string }) {
  const { t } = useTranslation();
  const state = useImport();
  const step = state.plan ? 3 : state.upload ? 2 : 1;
  if (state.commitAction.data)
    return (
      <section className="panel empty-state">
        <CheckCircle2 size={48} className="success-icon" />
        <h2>{t("import.success")}</h2>
        <p>{t("import.successDetail", { ...state.commitAction.data })}</p>
        <Button onClick={state.reset}>{t("import.another")}</Button>
      </section>
    );
  return (
    <>
      <ol className="steps">
        {[1, 2, 3].map((s) => (
          <li
            key={s}
            className={s === step ? "current" : s < step ? "complete" : ""}
          >
            <span>{s}</span>
            {t(`import.step${s}`)}
          </li>
        ))}
      </ol>
      <ErrorNotice
        error={
          state.uploadAction.error ||
          state.previewAction.error ||
          state.commitAction.error
        }
      />
      {state.plan ? (
        <ImportReview
          plan={state.plan}
          busy={state.commitAction.isPending}
          onBack={() => state.setPlan(null)}
          onCommit={(skip) => state.commitAction.mutate(skip)}
        />
      ) : state.upload ? (
        <ColumnMapper
          key={state.upload.id}
          upload={state.upload}
          campaignId={id}
          busy={state.previewAction.isPending}
          onReview={(mapping) => state.previewAction.mutate(mapping)}
        />
      ) : (
        <FilePicker
          onPick={(file) => state.uploadAction.mutate(file)}
          busy={state.uploadAction.isPending}
        />
      )}
    </>
  );
}
export default function ImportPage() {
  const { t } = useTranslation();
  const { campaign } = useWorkspace();
  return (
    <div className="stack">
      <PageHeader title={t("import.title")} subtitle={t("import.subtitle")} />
      {campaign?.status === "draft" ? (
        <ImportSurface key={campaign.id} id={campaign.id} />
      ) : (
        <Notice tone="warning">{t("import.draftOnly")}</Notice>
      )}
    </div>
  );
}
