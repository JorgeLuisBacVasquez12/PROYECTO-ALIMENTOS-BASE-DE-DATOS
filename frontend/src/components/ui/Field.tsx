import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";
export function Input({
  label,
  help,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; help?: string }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input
        {...props}
        id={id}
        aria-describedby={help ? `${id}-help` : undefined}
      />
      {help ? <small id={`${id}-help`}>{help}</small> : null}
    </label>
  );
}
export function Select({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select {...props} id={id}>
        {children}
      </select>
    </label>
  );
}
