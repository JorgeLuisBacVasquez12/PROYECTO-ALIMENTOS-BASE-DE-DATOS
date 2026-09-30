import { useMutation, useQueryClient } from "@tanstack/react-query";
export function useMutationAction<T>(
  action: (body: T) => Promise<unknown>,
  keys: string[] = [],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: async () => {
      await Promise.all(
        keys.map((key) => client.invalidateQueries({ queryKey: [key] })),
      );
    },
  });
}
