import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { Input, Select } from "../../components/ui/Field";
import { Button } from "../../components/ui/Button";
import { useWorkspace } from "../../hooks/useWorkspace";
export function ReportFilters({
  onChange,
}: {
  onChange: (value: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const { points } = useWorkspace();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onChange(
      Object.fromEntries(
        [...new FormData(event.currentTarget)]
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, String(v)]),
      ),
    );
  }
  return (
    <form className="panel filters-grid" onSubmit={submit}>
      <Input
        label={t("reports.search")}
        name="q"
        maxLength={120}
        placeholder={t("reports.search")}
      />
      <Select label={t("common.status")} name="status">
        <option value="all">{t("common.all")}</option>
        <option value="delivered">{t("reports.delivered")}</option>
        <option value="pending">{t("reports.pending")}</option>
      </Select>
      <Select label={t("common.point")} name="pointId">
        <option value="">{t("common.all")}</option>
        {points.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <Input label={t("reports.from")} name="from" type="date" />
      <Input label={t("reports.to")} name="to" type="date" />
      <Button type="submit">
        <Search size={17} />
        {t("common.search")}
      </Button>
    </form>
  );
}
