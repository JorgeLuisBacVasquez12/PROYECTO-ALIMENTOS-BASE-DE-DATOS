import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import type { UploadPreview, ImportMapping } from "@mazate/contracts";
import { Select, Input } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { Notice } from "../../components/ui/Feedback";
export function ColumnMapper({
  upload,
  campaignId,
  busy,
  onReview,
}: {
  upload: UploadPreview;
  campaignId: string;
  busy: boolean;
  onReview: (mapping: ImportMapping) => void;
}) {
  const { t } = useTranslation();
  const [sheetName, setSheet] = useState(upload.sheets[0]?.name ?? "");
  const [headerRow, setHeader] = useState(1);
  const [dpiColumn, setDpi] = useState(-1);
  const [sectorColumn, setSector] = useState(-1);
  const [ageColumn, setAge] = useState(-1);
  const [nameColumns, setNames] = useState<number[]>([]);
  const sheet = upload.sheets.find((s) => s.name === sheetName);
  const headers = sheet?.preview[headerRow - 1] ?? [];
  const reset = () => {
    setDpi(-1);
    setNames([]);
    setSector(-1);
    setAge(-1);
  };
  function submit(event: FormEvent) {
    event.preventDefault();
    if (dpiColumn >= 0 && nameColumns.length)
      onReview({
        campaignId,
        sheet: sheetName,
        headerRow,
        dpiColumn,
        nameColumns,
        ...(sectorColumn >= 0 ? { sectorColumn } : {}),
        ...(ageColumn >= 0 ? { ageColumn } : {}),
      });
  }
  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel stack">
        <div className="section-title">
          <h2>{upload.filename}</h2>
          <span className="badge neutral">
            {t("import.rowsCount", { count: sheet?.rows ?? 0 })}
          </span>
        </div>
        <div className="form-grid">
          <Select
            label={t("import.sheet")}
            value={sheetName}
            onChange={(e) => {
              setSheet(e.target.value);
              setHeader(1);
              reset();
            }}
          >
            {upload.sheets.map((s) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </Select>
          <Input
            label={t("import.header")}
            type="number"
            min={1}
            max={Math.min(100, sheet?.rows ?? 100)}
            value={headerRow}
            onChange={(e) => {
              setHeader(Number(e.target.value) || 1);
              reset();
            }}
          />
          <Select
            label={t("import.dpi")}
            required
            value={dpiColumn < 0 ? "" : dpiColumn}
            onChange={(e) => {
              setDpi(e.target.value === "" ? -1 : Number(e.target.value));
              setSector(-1);
              setAge(-1);
              setNames((current) =>
                current.filter((i) => i !== Number(e.target.value)),
              );
            }}
          >
            <option value="">{t("common.select")}</option>
            {headers.map((name, i) => (
              <option value={i} key={i}>
                {i + 1}. {name || "—"}
              </option>
            ))}
          </Select>
        </div>
        <fieldset className="name-mapping">
          <legend>{t("import.names")}</legend>
          <p>{t("import.namesHelp")}</p>
          <div className="column-options">
            {headers.map((name, i) => (
              <label
                className={`column-choice ${nameColumns.includes(i) ? "checked" : ""}`}
                key={i}
              >
                <input
                  type="checkbox"
                  disabled={
                    i === dpiColumn ||
                    i === sectorColumn ||
                    i === ageColumn ||
                    (!nameColumns.includes(i) && nameColumns.length >= 8)
                  }
                  checked={nameColumns.includes(i)}
                  onChange={(e) =>
                    setNames((current) =>
                      e.target.checked
                        ? [...current, i]
                        : current.filter((n) => n !== i),
                    )
                  }
                />
                <span>
                  {i + 1}. {name || "—"}
                </span>
                {nameColumns.includes(i) ? (
                  <b>{nameColumns.indexOf(i) + 1}</b>
                ) : null}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="muted small">
          {t("import.selectedOrder")}:{" "}
          {nameColumns.map((i) => headers[i]).join(" · ") || "—"}
        </p>
        <div className="form-grid">
          <Select
            label="Columna de sector (opcional)"
            value={sectorColumn}
            onChange={(e) => setSector(Number(e.target.value))}
          >
            <option value={-1}>Sin dato en este archivo</option>
            {headers.map((name, i) => (
              <option
                key={i}
                value={i}
                disabled={
                  i === dpiColumn || i === ageColumn || nameColumns.includes(i)
                }
              >
                {i + 1}. {name || "—"}
              </option>
            ))}
          </Select>
          <Select
            label="Columna de edad (opcional)"
            value={ageColumn}
            onChange={(e) => setAge(Number(e.target.value))}
          >
            <option value={-1}>Sin dato en este archivo</option>
            {headers.map((name, i) => (
              <option
                key={i}
                value={i}
                disabled={
                  i === dpiColumn ||
                  i === sectorColumn ||
                  nameColumns.includes(i)
                }
              >
                {i + 1}. {name || "—"}
              </option>
            ))}
          </Select>
        </div>
        <p className="muted small">
          La edad debe estar expresada en años completos, de 0 a 120. Se
          conserva la edad del padrón; si no hay un valor válido, aparecerá como
          «Sin dato».
        </p>
        <Notice>{t("import.otherColumns")}</Notice>
      </section>
      <section className="panel table-panel">
        <h2 className="table-toolbar">{t("import.sample")}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {headers.map((name, i) => (
                  <th key={i}>
                    {i + 1}. {name || "—"}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet?.preview.slice(headerRow, headerRow + 4).map((row, i) => (
                <tr key={i}>
                  {headers.map((_, j) => (
                    <td key={j}>{row[j] || "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="actions end">
        <Button busy={busy} disabled={dpiColumn < 0 || !nameColumns.length}>
          {t("import.review")}
        </Button>
      </div>
    </form>
  );
}
