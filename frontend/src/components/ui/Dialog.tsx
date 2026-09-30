import { useEffect, useRef, type ReactNode, useId } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { t } = useTranslation();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label={t("common.close")}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
