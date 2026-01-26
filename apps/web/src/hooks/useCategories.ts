import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import type { Category, CategoryType } from '@otter-money/shared';

interface CategoryWithCount extends Category {
  transactionCount: number;
}

interface CreateCategoryRequest {
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  parentId?: string;
}

interface UpdateCategoryRequest {
  name?: string;
  icon?: string | null;
  color?: string | null;
}

// Query keys
export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
};

// Hooks
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: () => api.get<CategoryWithCount[]>('/categories'),
  });
}

export function useCategoriesByType() {
  const { data: categories, ...rest } = useCategories();

  const grouped = categories?.reduce(
    (acc, cat) => {
      if (!acc[cat.type]) {
        acc[cat.type] = [];
      }
      acc[cat.type].push(cat);
      return acc;
    },
    {} as Record<CategoryType, CategoryWithCount[]>
  );

  return { data: grouped, categories, ...rest };
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) =>
      api.post<Category>('/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCategoryRequest & { id: string }) =>
      api.patch<Category>(`/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}

export function useMergeCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { sourceId: string; targetId: string }) =>
      api.post<{ message: string }>('/categories/merge', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() });
    },
  });
}
