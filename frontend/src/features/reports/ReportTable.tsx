import type { ReportRow } from "@mazate/contracts";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../lib/format";
import { Button } from "../../components/ui/Button";
export function ReportTable({
  rows,
  onVoid,
}: {
  rows: ReportRow[];
  onVoid: (row: ReportRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Personas y entregas"
    >
      <table className="report-table">
        <thead>
          <tr>
            {[
              "person",
              "sector",
              "age",
              "status",
              "point",
              "date",
              "by",
              "actions",
            ].map((key) => (
              <th key={key}>
                {key === "person" ? "Persona / DPI" : t(`common.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="name-cell">
                <strong>{row.full_name}</strong>
                <small className="dpi-text cell-secondary">{row.dpi}</small>
              </td>
              <td>{row.sector ?? "Sin dato"}</td>
              <td>
                {row.age === null || row.age === undefined
                  ? "Sin dato"
                  : `${row.age} años`}
              </td>
              <td>
                <span
                  className={`badge ${row.delivery_id ? "success" : "neutral"}`}
                >
                  {t(`reports.${row.delivery_id ? "delivered" : "pending"}`)}
                </span>
              </td>
              <td>{row.point_name ?? "—"}</td>
              <td className="date-cell">
                {row.delivered_at ? formatDate(row.delivered_at) : "—"}
              </td>
              <td>{row.operator_name ?? "—"}</td>
              <td>
                {row.delivery_id ? (
                  <Button variant="ghost" onClick={() => onVoid(row)}>
                    {t("reports.void")}
                  </Button>
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? (
        <p className="table-empty">{t("reports.noResults")}</p>
      ) : null}
    </div>
  );
}
