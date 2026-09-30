import { useId, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";

export function PasswordInput({
  label,
  help,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  help?: string;
}) {
  const id = useId();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const toggleLabel = t(visible ? "auth.hidePassword" : "auth.showPassword");
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={help ? `${id}-help` : undefined}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((value) => !value)}
          aria-label={toggleLabel}
          title={toggleLabel}
          aria-pressed={visible}
          aria-controls={id}
          disabled={props.disabled}
        >
          {visible ? (
            <EyeOff size={20} aria-hidden="true" />
          ) : (
            <Eye size={20} aria-hidden="true" />
          )}
        </button>
      </div>
      {help ? <small id={`${id}-help`}>{help}</small> : null}
    </div>
  );
}
