import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Lookup, DeliveryResult } from "@mazate/contracts";
import { post } from "../lib/api";
import { config } from "../config/app";
export function useDpiLookup(campaignId: string) {
  const [draft, setDraft] = useState("");
  const [dpi, setDpi] = useState("");
  const [dialog, setDialog] = useState(false);
  const intent = useRef<{ key: string; requestId: string } | null>(null);
  const queries = useQueryClient();
  const query = useQuery({
    queryKey: ["lookup", campaignId, dpi],
    queryFn: () => post<Lookup>("/lookup", { campaignId, dpi }),
    enabled: dpi.length === 13,
    refetchInterval: config.refreshMs,
  });
  const delivery = useMutation({
    mutationFn: () => {
      const key = `${campaignId}:${dpi}`;
      if (intent.current?.key !== key)
        intent.current = { key, requestId: crypto.randomUUID() };
      return post<DeliveryResult>("/deliveries", {
        campaignId,
        dpi,
        requestId: intent.current.requestId,
      });
    },
    onSuccess: () => {
      setDialog(false);
      for (const key of ["lookup", "stats", "activity", "report"])
        void queries.invalidateQueries({ queryKey: [key, campaignId] });
    },
  });
  const change = (value: string) => {
    setDraft(value);
    setDpi("");
    delivery.reset();
  };
  const search = () => {
    const clean = draft.replace(/[\s-]/g, "");
    if (!/^\d{13}$/.test(clean)) return false;
    setDpi(clean);
    delivery.reset();
    if (clean === dpi) void query.refetch();
    return true;
  };
  const reset = () => {
    change("");
    intent.current = null;
  };
  return {
    draft,
    dpi,
    change,
    search,
    reset,
    dialog,
    setDialog,
    query,
    delivery,
  };
}
