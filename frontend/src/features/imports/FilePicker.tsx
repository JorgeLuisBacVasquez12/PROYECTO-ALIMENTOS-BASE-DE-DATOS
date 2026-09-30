import { FileSpreadsheet, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRef } from "react";
import { Button } from "../../components/ui/Button";
export function FilePicker({
  onPick,
  busy,
}: {
  onPick: (file: File) => void;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="panel upload-panel">
      <span className="upload-icon">
        <FileSpreadsheet size={40} />
      </span>
      <h2>{t("import.uploadTitle")}</h2>
      <p>{t("import.uploadHelp")}</p>
      <input
        ref={input}
        hidden
        type="file"
        accept=".xlsx"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <Button busy={busy} onClick={() => input.current?.click()}>
        <Upload size={18} />
        {t("import.choose")}
      </Button>
    </section>
  );
}
