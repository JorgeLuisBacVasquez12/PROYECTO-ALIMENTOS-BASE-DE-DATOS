import { useMutation, useQueryClient } from "@tanstack/react-query";
export function useMutationAction<T, TResult = unknown>(
  action: (body: T) => Promise<TResult>,
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
