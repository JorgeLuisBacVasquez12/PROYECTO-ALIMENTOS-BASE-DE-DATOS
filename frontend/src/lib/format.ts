import { config } from "../config/app";
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat(config.locale, {
    timeZone: config.timezone,
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
export const formatNumber = (value: number) =>
  new Intl.NumberFormat(config.locale).format(value);
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((v) => v[0])
    .join("")
    .toUpperCase();
