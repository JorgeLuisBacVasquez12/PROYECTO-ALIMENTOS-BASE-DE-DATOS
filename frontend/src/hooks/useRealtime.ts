import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useOnline } from "./useOnline";
export function useRealtime(campaignId: string | undefined) {
  const queries = useQueryClient();
  const [state, setState] = useState<"connecting" | "live" | "fallback">(
    "connecting",
  );
  const online = useOnline();
  useEffect(() => {
    if (!campaignId) return;
    setState("connecting");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase!
      .channel(`entregas:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_events",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            for (const key of [
              "lookup",
              "stats",
              "activity",
              "report",
              "assignments",
            ])
              void queries.invalidateQueries({ queryKey: [key, campaignId] });
            for (const key of ["bootstrap", "history", "users"])
              void queries.invalidateQueries({ queryKey: [key] });
          }, 100);
        },
      )
      .subscribe((status) => {
        setState(
          status === "SUBSCRIBED"
            ? "live"
            : status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
              ? "fallback"
              : "connecting",
        );
        if (status === "SUBSCRIBED") void queries.invalidateQueries();
      });
    return () => {
      clearTimeout(timer);
      void supabase!.removeChannel(channel);
    };
  }, [campaignId, queries]);
  return online ? state : "offline";
}
