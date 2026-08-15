import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { iconTone } from "@/lib/icon-colors";
import { EmptyState, ErrorState, LoadingState, NoResultsState } from "./states";
import { AnimatedContent } from "./page-layout";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortValue?: ((row: T) => string | number) | undefined;
  className?: string | undefined;
  width?: string | undefined;
}

export interface FilterConfig<T> {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  predicate: (row: T, value: string) => boolean;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string | undefined;
}) {
  return (
    <div className="relative w-full sm:w-72">
      <Search className={cn("pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2", iconTone.muted)} />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 bg-background pl-9"
        aria-label={placeholder}
      />
    </div>
  );
}

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[170px] bg-background text-sm" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}: All</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TableToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-4 py-3">{children}</div>
  );
}

interface DataTableProps<T> {
  data: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  isLoading?: boolean | undefined;
  isError?: boolean | undefined;
  errorMessage?: string | undefined;
  onRetry?: (() => void) | undefined;
  searchPlaceholder?: string | undefined;
  searchFields?: ((row: T) => string)[] | undefined;
  filters?: FilterConfig<T>[] | undefined;
  onRowClick?: ((row: T) => void) | undefined;
  rowActions?: ((row: T) => ReactNode) | undefined;
  emptyTitle?: string | undefined;
  toolbarExtra?: ReactNode | undefined;
  pageSize?: number | undefined;
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  searchPlaceholder = "Search",
  searchFields,
  filters = [],
  onRowClick,
  rowActions,
  emptyTitle,
  toolbarExtra,
  pageSize = 10,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (query.trim() && searchFields?.length) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((r) => searchFields.some((f) => f(r).toLowerCase().includes(q)));
    }
    for (const f of filters) {
      const v = filterValues[f.key];
      if (v && v !== "all") rows = rows.filter((r) => f.predicate(r, v));
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col?.sortValue) {
        rows = [...rows].sort((a, b) => {
          const av = col.sortValue!(a);
          const bv = col.sortValue!(b);
          const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
          return sort.dir === "asc" ? cmp : -cmp;
        });
      }
    }
    return rows;
  }, [data, query, filterValues, filters, sort, columns, searchFields]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, totalPages);
  const paged = filtered.slice((current - 1) * pageSize, current * pageSize);
  const hasFiltersApplied = query.trim().length > 0 || Object.values(filterValues).some((v) => v && v !== "all");

  const clearAll = () => {
    setQuery("");
    setFilterValues({});
    setPage(1);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-none">
      <TableToolbar>
        {searchFields?.length ? (
          <SearchInput
            value={query}
            onChange={(v) => {
              setQuery(v);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
          />
        ) : null}
        {filters.map((f) => (
          <FilterDropdown
            key={f.key}
            label={f.label}
            value={filterValues[f.key] ?? "all"}
            options={f.options}
            onChange={(v) => {
              setFilterValues((prev) => ({ ...prev, [f.key]: v }));
              setPage(1);
            }}
          />
        ))}
        {hasFiltersApplied && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">{toolbarExtra}</div>
      </TableToolbar>

      {isLoading ? (
        <div className="animate-content-enter">
          <LoadingState />
        </div>
      ) : isError ? (
        <div className="animate-content-enter">
          <ErrorState title={errorMessage ?? "Unable to load"} onRetry={onRetry} />
        </div>
      ) : (data ?? []).length === 0 ? (
        <div className="animate-content-enter">
          <EmptyState title={emptyTitle ?? "Nothing here yet"} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="animate-content-enter">
          <NoResultsState onClear={clearAll} />
        </div>
      ) : (
        <AnimatedContent>
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface-raised">
              <tr className="border-b border-border">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(
                      "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                      c.className,
                    )}
                  >
                    {c.sortValue ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                        onClick={() =>
                          setSort((prev) =>
                            prev?.key === c.key
                              ? { key: c.key, dir: prev.dir === "asc" ? "desc" : "asc" }
                              : { key: c.key, dir: "asc" },
                          )
                        }
                      >
                        {c.header}
                        {sort?.key === c.key ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className={cn("size-3", iconTone.primary)} />
                          ) : (
                            <ArrowDown className={cn("size-3", iconTone.primary)} />
                          )
                        ) : (
                          <ChevronsUpDown className={cn("size-3", iconTone.muted)} />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
                {rowActions && <th className="w-12 px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody>
              {paged.map((row, index) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "animate-row-enter border-b border-border/60 transition-colors last:border-0",
                    onRowClick && "cursor-pointer hover:bg-accent/40",
                  )}
                  style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-3 align-middle", c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {rowActions(row)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </AnimatedContent>
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              <ChevronLeft className={cn("size-3.5", iconTone.primary)} /> Previous
            </Button>
            <span className="tabular-nums">
              Page {current} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>
              Next <ChevronRight className={cn("size-3.5", iconTone.primary)} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
