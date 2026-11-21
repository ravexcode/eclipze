import { IconRefresh } from "@tabler/icons-react";

import Input from "@/components/ui/input";
import MenuSelector from "@/components/ui/menu-selector";
import {
  ISSUE_PRIORITY_FILTER_OPTIONS,
  ISSUE_TYPE_FILTER_OPTIONS,
} from "@/constants/issues";
import type { BoardFilters } from "@/types/board";

type BoardToolbarProps = {
  filters: BoardFilters;
  loading: boolean;
  onFiltersChange: (updates: Partial<BoardFilters>) => void;
  onRefresh: () => void;
};

export default function BoardToolbar({
  filters,
  loading,
  onFiltersChange,
  onRefresh,
}: BoardToolbarProps) {
  return (
    <section className="flex flex-wrap items-center gap-2 rounded-md bg-background-card p-3">
      <Input
        type="search"
        aria-label="Search the board"
        value={filters.query}
        onChange={(query) => onFiltersChange({ query })}
        className="min-w-56 flex-1"
        placeholder="Search the board"
      />

      <MenuSelector
        ariaLabel="Filter the board by type"
        value={filters.type}
        onChange={(type) => onFiltersChange({ type })}
        options={ISSUE_TYPE_FILTER_OPTIONS}
        placeholder="All types"
        className="w-36"
      />

      <MenuSelector
        ariaLabel="Filter the board by priority"
        value={filters.priority}
        onChange={(priority) => onFiltersChange({ priority })}
        options={ISSUE_PRIORITY_FILTER_OPTIONS}
        placeholder="All priorities"
        className="w-40"
      />

      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className="rounded-md p-2 text-foreground-off hover:bg-background-focus focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
        aria-label="Refresh board"
        title="Refresh from server">
        <IconRefresh size={17} />
      </button>
    </section>
  );
}
