import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../utils/api';
import type { Category, CategoryType, CategoryTreeNode, CategoryWithPath, CategoryWithCount } from '@otter-money/shared';

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
  tree: () => [...categoryKeys.all, 'tree'] as const,
  descendants: (id: string) => [...categoryKeys.all, 'descendants', id] as const,
};

// ============================================
// Helper functions
// ============================================

/**
 * Flatten a category tree into a list with path information
 */
function flattenTreeWithPath(
  nodes: CategoryTreeNode[],
  path: string[] = []
): CategoryWithPath[] {
  const result: CategoryWithPath[] = [];

  for (const node of nodes) {
    const currentPath = [...path, node.name];
    result.push({
      ...node,
      path: currentPath,
      fullName: currentPath.join(' > '),
    });

    if (node.children && node.children.length > 0) {
      result.push(...flattenTreeWithPath(node.children, currentPath));
    }
  }

  return result;
}

/**
 * Build a tree from a flat list of categories
 */
function buildTreeFromFlat(categories: CategoryWithCount[]): CategoryTreeNode[] {
  const categoryMap = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  // First pass: create all nodes
  categories.forEach((cat) => {
    categoryMap.set(cat.id, {
      ...cat,
      children: [],
    });
  });

  // Second pass: build tree structure
  categories.forEach((cat) => {
    const node = categoryMap.get(cat.id)!;
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId)!.children.push(node);
    } else if (!cat.parentId) {
      roots.push(node);
    }
  });

  // Sort children by displayOrder, then name
  const sortChildren = (nodes: CategoryTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) {
        return a.displayOrder - b.displayOrder;
      }
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => sortChildren(node.children));
  };

  sortChildren(roots);
  return roots;
}

/**
 * Find a category by ID in a tree
 */
function findInTree(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children.length > 0) {
      const found = findInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get the path to a category in a tree
 */
function getPathInTree(nodes: CategoryTreeNode[], id: string, path: CategoryTreeNode[] = []): CategoryTreeNode[] | null {
  for (const node of nodes) {
    const currentPath = [...path, node];
    if (node.id === id) return currentPath;
    if (node.children.length > 0) {
      const found = getPathInTree(node.children, id, currentPath);
      if (found) return found;
    }
  }
  return null;
}

// ============================================
// Hooks
// ============================================

/**
 * Get all categories as a flat list
 */
export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: () => api.get<CategoryWithCount[]>('/categories'),
  });
}

/**
 * Get categories grouped by type
 */
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

/**
 * Get categories as a tree structure from API
 */
export function useCategoriesTree() {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: () => api.get<CategoryTreeNode[]>('/categories/tree'),
  });
}

/**
 * Get categories as a tree, built from flat list (fallback)
 */
export function useCategoriesTreeLocal() {
  const { data: categories, ...rest } = useCategories();

  const tree = useMemo(() => {
    if (!categories) return undefined;
    return buildTreeFromFlat(categories);
  }, [categories]);

  return { data: tree, ...rest };
}

/**
 * Get categories as a flat list with path information
 */
export function useCategoriesFlat() {
  const { data: tree, ...rest } = useCategoriesTree();

  const flat = useMemo(() => {
    if (!tree) return undefined;
    return flattenTreeWithPath(tree);
  }, [tree]);

  return { data: flat, ...rest };
}

/**
 * Get categories of a specific type as a tree
 */
export function useCategoriesTreeByType(type: CategoryType) {
  const { data: tree, ...rest } = useCategoriesTree();

  const filtered = useMemo(() => {
    if (!tree) return undefined;
    return tree.filter((node) => node.type === type);
  }, [tree, type]);

  return { data: filtered, ...rest };
}

/**
 * Get categories of a specific type as a flat list with paths
 */
export function useCategoriesFlatByType(type: CategoryType) {
  const { data: flat, ...rest } = useCategoriesFlat();

  const filtered = useMemo(() => {
    if (!flat) return undefined;
    return flat.filter((cat) => cat.type === type);
  }, [flat, type]);

  return { data: filtered, ...rest };
}

/**
 * Find a specific category by ID
 */
export function useCategoryById(id: string | null) {
  const { data: categories, ...rest } = useCategories();

  const category = useMemo(() => {
    if (!categories || !id) return null;
    return categories.find((c) => c.id === id) || null;
  }, [categories, id]);

  return { data: category, ...rest };
}

/**
 * Get the path to a category (for breadcrumbs)
 */
export function useCategoryPath(id: string | null) {
  const { data: tree, ...rest } = useCategoriesTree();

  const path = useMemo(() => {
    if (!tree || !id) return null;
    return getPathInTree(tree, id);
  }, [tree, id]);

  return { data: path, ...rest };
}

/**
 * Get descendants of a category
 */
export function useCategoryDescendants(id: string) {
  return useQuery({
    queryKey: categoryKeys.descendants(id),
    queryFn: () => api.get<{ categoryId: string; descendants: string[] }>(`/categories/${id}/descendants`),
    enabled: !!id,
  });
}

// ============================================
// Mutations
// ============================================

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) =>
      api.post<Category>('/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: UpdateCategoryRequest & { id: string }) =>
      api.patch<Category>(`/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete<{ message: string }>(`/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

export function useMergeCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { sourceId: string; targetId: string }) =>
      api.post<{ message: string }>('/categories/merge', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

// Re-export helpers for external use
export { flattenTreeWithPath, buildTreeFromFlat, findInTree, getPathInTree };
