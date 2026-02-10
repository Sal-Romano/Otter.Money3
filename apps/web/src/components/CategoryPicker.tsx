import { useState, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Search, ChevronRight, ChevronDown, Check, X } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { useCategoriesTreeByType, useCategoryById, flattenTreeWithPath } from '../hooks/useCategories';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import type { CategoryType, CategoryTreeNode, CategoryWithPath } from '@otter-money/shared';

interface CategoryPickerProps {
  value: string | null;
  onChange: (categoryId: string | null) => void;
  categoryType?: CategoryType;
  label?: string;
  allowUncategorized?: boolean;
  placeholder?: string;
  className?: string;
}

export function CategoryPicker({
  value,
  onChange,
  categoryType = 'EXPENSE',
  label,
  allowUncategorized = true,
  placeholder = 'Select category...',
  className = '',
}: CategoryPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: tree, isLoading } = useCategoriesTreeByType(categoryType);
  const { data: selectedCategory } = useCategoryById(value);

  useBodyScrollLock(isOpen);

  // Auto-expand parents of selected category
  useEffect(() => {
    if (value && tree) {
      const findAndExpandParents = (nodes: CategoryTreeNode[], parents: string[] = []): boolean => {
        for (const node of nodes) {
          if (node.id === value) {
            setExpandedCategories(new Set(parents));
            return true;
          }
          if (node.children.length > 0) {
            if (findAndExpandParents(node.children, [...parents, node.id])) {
              return true;
            }
          }
        }
        return false;
      };
      findAndExpandParents(tree);
    }
  }, [value, tree]);

  // Flatten tree for search
  const flatCategories = useMemo(() => {
    if (!tree) return [];
    return flattenTreeWithPath(tree);
  }, [tree]);

  // Filter by search query
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return flatCategories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(query) ||
        cat.fullName.toLowerCase().includes(query)
    );
  }, [flatCategories, searchQuery]);

  // Toggle category expansion
  const toggleExpand = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Handle category selection
  const handleSelect = (categoryId: string | null) => {
    onChange(categoryId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Focus search input when opening
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Render a category node (recursive for tree)
  const renderCategoryNode = (node: CategoryTreeNode, depth: number = 0) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedCategories.has(node.id);
    const isSelected = node.id === value;
    const indentPx = depth * 24;

    return (
      <div key={node.id}>
        <button
          type="button"
          onClick={() => handleSelect(node.id)}
          className={clsx(
            'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
            'hover:bg-gray-50 active:bg-gray-100',
            isSelected && 'bg-purple-50'
          )}
          style={{ paddingLeft: `${16 + indentPx}px` }}
        >
          {/* Expand/collapse button for parents */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => toggleExpand(node.id, e)}
              className="p-1 -ml-2 rounded hover:bg-gray-200 text-gray-400"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-6" /> // Spacer for alignment
          )}

          {/* Icon */}
          <span
            className={clsx(
              'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
              isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
            )}
            style={node.color ? { backgroundColor: `${node.color}20`, color: node.color } : undefined}
          >
            <CategoryIcon icon={node.icon} size={18} />
          </span>

          {/* Name */}
          <span
            className={clsx(
              'flex-1 font-medium truncate',
              isSelected ? 'text-purple-900' : 'text-gray-900',
              hasChildren && 'font-semibold'
            )}
          >
            {node.name}
          </span>

          {/* Selected check */}
          {isSelected && (
            <Check className="h-5 w-5 text-purple-600 flex-shrink-0" />
          )}
        </button>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderCategoryNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render search result item
  const renderSearchResult = (cat: CategoryWithPath) => {
    const isSelected = cat.id === value;

    return (
      <button
        key={cat.id}
        type="button"
        onClick={() => handleSelect(cat.id)}
        className={clsx(
          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
          'hover:bg-gray-50 active:bg-gray-100',
          isSelected && 'bg-purple-50'
        )}
      >
        {/* Icon */}
        <span
          className={clsx(
            'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
            isSelected ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
          )}
          style={cat.color ? { backgroundColor: `${cat.color}20`, color: cat.color } : undefined}
        >
          <CategoryIcon icon={cat.icon} size={18} />
        </span>

        {/* Name with path */}
        <div className="flex-1 min-w-0">
          <div
            className={clsx(
              'font-medium truncate',
              isSelected ? 'text-purple-900' : 'text-gray-900'
            )}
          >
            {cat.name}
          </div>
          {cat.path.length > 1 && (
            <div className="text-xs text-gray-500 truncate">
              {cat.path.slice(0, -1).join(' > ')}
            </div>
          )}
        </div>

        {/* Selected check */}
        {isSelected && (
          <Check className="h-5 w-5 text-purple-600 flex-shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className={clsx('relative', className)}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={clsx(
          'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left',
          'bg-white border-gray-300 hover:border-gray-400 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent'
        )}
      >
        {selectedCategory ? (
          <>
            <span
              className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center bg-gray-100 text-gray-600"
              style={
                selectedCategory.color
                  ? { backgroundColor: `${selectedCategory.color}20`, color: selectedCategory.color }
                  : undefined
              }
            >
              <CategoryIcon icon={selectedCategory.icon} size={14} />
            </span>
            <span className="flex-1 truncate text-gray-900">{selectedCategory.name}</span>
          </>
        ) : (
          <span className="flex-1 text-gray-500">{placeholder}</span>
        )}
        <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* Modal/Bottom Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-white overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Select Category
                </h3>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 -mr-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-300 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">
                  Loading categories...
                </div>
              ) : searchResults ? (
                // Search results
                searchResults.length > 0 ? (
                  <div className="py-2">
                    {searchResults.map((cat) => renderSearchResult(cat))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    No categories found
                  </div>
                )
              ) : (
                // Tree view
                <div className="py-2">
                  {/* Uncategorized option */}
                  {allowUncategorized && (
                    <button
                      type="button"
                      onClick={() => handleSelect(null)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                        'hover:bg-gray-50 active:bg-gray-100',
                        value === null && 'bg-purple-50'
                      )}
                    >
                      <span className="w-6" />
                      <span
                        className={clsx(
                          'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                          value === null ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'
                        )}
                      >
                        <X className="h-4 w-4" />
                      </span>
                      <span
                        className={clsx(
                          'flex-1 font-medium',
                          value === null ? 'text-purple-900' : 'text-gray-600'
                        )}
                      >
                        Uncategorized
                      </span>
                      {value === null && (
                        <Check className="h-5 w-5 text-purple-600 flex-shrink-0" />
                      )}
                    </button>
                  )}

                  {/* Category tree */}
                  {tree?.map((node) => renderCategoryNode(node))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
