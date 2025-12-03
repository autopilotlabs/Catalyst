"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchWorkspace, formatResult, SearchResult } from "@/lib/search-client";
import { Search, Loader2 } from "lucide-react";

export function SearchCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Handle keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isOpen || query.trim().length === 0) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      const searchResults = await searchWorkspace(query);
      setResults(searchResults);
      setSelectedIndex(0);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(results.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + results.length) % Math.max(results.length, 1));
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        handleSelect(results[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      const formatted = formatResult(result);
      router.push(formatted.link);
      setIsOpen(false);
      setQuery("");
      setResults([]);
    },
    [router]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setIsOpen(false)}>
      <div
        className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search agents, workflows, memories..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 outline-none text-gray-900 placeholder:text-gray-400"
            autoFocus
          />
          {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
          <kbd className="px-2 py-1 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 && query.trim().length > 0 && !loading && (
            <div className="px-4 py-8 text-center text-gray-500">
              No results found for &quot;{query}&quot;
            </div>
          )}

          {results.length === 0 && query.trim().length === 0 && (
            <div className="px-4 py-8 text-center text-gray-500">
              Start typing to search your workspace...
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((result, index) => {
                const formatted = formatResult(result);
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={`${result.entityType}-${result.entityId}`}
                    onClick={() => handleSelect(result)}
                    className={`
                      w-full px-4 py-3 text-left transition-colors
                      ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {formatted.title}
                          </span>
                          <span className="px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 rounded">
                            {result.entityType}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {formatted.description}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-200 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-200 rounded">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-200 rounded">↵</kbd>
              Select
            </span>
          </div>
          <span>
            <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-200 rounded">⌘K</kbd>
            to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
