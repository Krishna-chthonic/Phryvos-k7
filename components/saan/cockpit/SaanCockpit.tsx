"use client";

import * as React from "react";
import {
  Search,
  Sparkles,
  Layers,
  ChevronRight,
  Filter,
  X,
  Code2,
  Terminal,
  Activity,
  Zap,
  Globe,
  Mic,
  Shield,
  Archive,
  BookOpen,
} from "lucide-react";
import {
  CATEGORIES,
  REPOS_METADATA,
  type RepoCategory,
  type RepoMetadata,
} from "./types";
import { RepoViewRenderer } from "./RepoViewRenderer";

export function SaanCockpit() {
  const [selectedCategory, setSelectedCategory] = React.useState<RepoCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = React.useState("");
  const [activeRepoId, setActiveRepoId] = React.useState<string>("chronicler");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Filter repos based on category and search query
  const filteredRepos = React.useMemo(() => {
    return REPOS_METADATA.filter((repo) => {
      const matchesCategory =
        selectedCategory === 'all' || repo.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        repo.name.toLowerCase().includes(q) ||
        repo.title.toLowerCase().includes(q) ||
        repo.repoSlug.toLowerCase().includes(q) ||
        repo.action.toLowerCase().includes(q) ||
        repo.description.toLowerCase().includes(q) ||
        repo.highlights.some((h) => h.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Current active repo
  const activeRepo = React.useMemo(() => {
    return (
      REPOS_METADATA.find((r) => r.id === activeRepoId) ||
      filteredRepos[0] ||
      REPOS_METADATA[0]
    );
  }, [activeRepoId, filteredRepos]);

  return (
    <div className="flex flex-col h-full w-full min-w-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Cockpit Sub-Header & Category Ribbon */}
      <div className="shrink-0 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md p-3 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold text-xs">
              50
            </span>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                Saan Living Companion OS Cockpit
              </h1>
              <p className="text-[11px] text-zinc-500">
                50 Ground-Truth Repositories • Clean-Room TypeScript Matrix
              </p>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter 50 repos (e.g. Graphiti, Whisper)..."
              className="w-full text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-zinc-900 pl-8 pr-7 py-1.5 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Pills Ribbon */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            All 50 Repos
          </button>

          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-full font-medium transition shrink-0 flex items-center gap-1.5 ${
                selectedCategory === cat.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              <span>{cat.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Layout: Left 50-Repo Tab Sidebar + Right Stage */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Repo Navigation Drawer / Sidebar */}
        <div className="w-72 md:w-80 shrink-0 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-zinc-200/60 dark:border-zinc-800/60 flex items-center justify-between text-xs text-zinc-500">
            <span>Showing {filteredRepos.length} Repositories</span>
            <span className="font-mono text-[11px] font-semibold text-purple-600 dark:text-purple-400">
              Active: #{activeRepo.num}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900/60 p-2 space-y-1">
            {filteredRepos.map((repo) => {
              const isActive = repo.id === activeRepo.id;
              return (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => setActiveRepoId(repo.id)}
                  className={`w-full text-left p-2.5 rounded-xl transition flex items-start gap-2.5 ${
                    isActive
                      ? 'bg-purple-500/10 text-purple-900 dark:text-purple-100 border border-purple-500/30 shadow-xs'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <span
                    className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-md font-mono text-[11px] font-bold ${
                      isActive
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {repo.num}
                  </span>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold truncate">
                        {repo.name}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        {repo.license}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {repo.title}
                    </p>

                    <div className="pt-0.5 flex items-center gap-1.5 text-[10px] text-zinc-400">
                      <span className="font-mono text-purple-500">
                        {repo.action}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredRepos.length === 0 && (
              <div className="p-6 text-center text-xs text-zinc-500 space-y-2">
                <p>No repositories match your filter query.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                  className="text-purple-600 dark:text-purple-400 font-semibold underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Stage: Interactive Active Repository View */}
        <div className="flex-1 min-w-0 overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/50 flex flex-col">
          <RepoViewRenderer repo={activeRepo} />
        </div>
      </div>
    </div>
  );
}
