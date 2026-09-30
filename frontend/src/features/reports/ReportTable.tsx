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
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {["person", "dpi", "status", "point", "date", "by", "actions"].map(
              (key) => (
                <th key={key}>{t(`common.${key}`)}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="name-cell">{row.full_name}</td>
              <td className="dpi-text">{row.dpi}</td>
              <td>
                <span
                  className={`badge ${row.delivery_id ? "success" : "neutral"}`}
                >
                  {t(`reports.${row.delivery_id ? "delivered" : "pending"}`)}
                </span>
              </td>
              <td>{row.point_name ?? "—"}</td>
              <td>{row.delivered_at ? formatDate(row.delivered_at) : "—"}</td>
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
