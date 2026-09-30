import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UploadPreview,
  ImportPlan,
  ImportMapping,
  ImportResult,
} from "@mazate/contracts";
import { api, post } from "../lib/api";
export function useImport() {
  const [upload, setUpload] = useState<UploadPreview | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const queryClient = useQueryClient();
  const uploadAction = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api<UploadPreview>("/imports/upload", {
        method: "POST",
        body: form,
      });
    },
    onSuccess: (data) => {
      setUpload(data);
      setPlan(null);
    },
  });
  const previewAction = useMutation({
    mutationFn: (mapping: ImportMapping) =>
      post<ImportPlan>(`/imports/${upload!.id}/preview`, mapping),
    onSuccess: setPlan,
  });
  const commitAction = useMutation({
    mutationFn: (skipInvalid: boolean) =>
      post<ImportResult>(`/imports/${upload!.id}/commit`, {
        skipInvalid,
        planId: plan!.planId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
      void queryClient.invalidateQueries({ queryKey: ["report"] });
    },
  });
  const reset = () => {
    setUpload(null);
    setPlan(null);
    uploadAction.reset();
    previewAction.reset();
    commitAction.reset();
  };
  return {
    upload,
    plan,
    setPlan,
    uploadAction,
    previewAction,
    commitAction,
    reset,
  };
}
