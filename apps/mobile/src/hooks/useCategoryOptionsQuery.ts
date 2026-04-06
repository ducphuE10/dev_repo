import { useQuery } from "@tanstack/react-query";

import { useApiClient } from "./useApiClient.ts";

export const useCategoryOptionsQuery = () => {
  const apiClient = useApiClient();

  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const response = await apiClient.listCategories();
      return response.categories;
    }
  });
};
