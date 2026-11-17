'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import BlogEditor from '@/components/blog/BlogEditor';
import {
  createBlogArticleSlug,
  currentBlogMonth,
  initialBlogContent,
  monthInputValue,
  monthLabel,
  type BlogCategory,
  type BlogPost,
  type BlogPostSummary,
} from '@/lib/blog-data';
import type { PageViewAnalytics } from '@/lib/page-view-analytics';
import type { ReportEditorContent } from '@/types/report';

const buttonClass = 'rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

interface CategoryDraft {
  name: string;
  slug: string;
  description: string;
}

function categoryDraftFrom(category?: BlogCategory): CategoryDraft {
  return {
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
  };
}

function publishedDate(value: string | null): string {
  if (!value) return 'Not published';
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  }).format(new Date(value));
}

function formatViewCount(value: number): string {
  return value.toLocaleString('en-NZ');
}

export default function BlogAdminPage({ initialPostId }: { initialPostId?: string } = {}) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [pageViews, setPageViews] = useState<PageViewAnalytics | null>(null);
  const [pageViewsError, setPageViewsError] = useState<string | null>(null);
  const [active, setActive] = useState<BlogPost | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingPost, setLoadingPost] = useState(false);
  const [working, setWorking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>(categoryDraftFrom());
  const [categoryWorking, setCategoryWorking] = useState(false);
  const [categoryNotice, setCategoryNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [author, setAuthor] = useState('');
  const [articleMonth, setArticleMonth] = useState(currentBlogMonth);
  const [readingMinutes, setReadingMinutes] = useState('5');
  const [content, setContent] = useState<ReportEditorContent>([{ type: 'paragraph' }]);
  const [draftRevision, setDraftRevision] = useState(0);
  const [savedRevision, setSavedRevision] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving'>('saved');
  const contentRef = useRef<(() => ReportEditorContent) | null>(null);
  const draftRevisionRef = useRef(0);
  const saveInProgressRef = useRef(false);

  const markDraftChanged = useCallback(() => {
    const revision = draftRevisionRef.current + 1;
    draftRevisionRef.current = revision;
    setDraftRevision(revision);
    setSaveStatus('unsaved');
  }, []);

  const loadPageViews = useCallback(async () => {
    setPageViewsError(null);
    try {
      const response = await fetch('/api/admin/analytics/page-views', { cache: 'no-store' });
      const data = await response.json() as { success: boolean; data?: PageViewAnalytics; error?: string };
      if (!response.ok || !data.success || !data.data) {
        throw new Error(data.error || 'Failed to load Blog article views.');
      }
      setPageViews(data.data);
    } catch (caught) {
      setPageViewsError(caught instanceof Error ? caught.message : 'Failed to load Blog article views.');
    }
  }, []);

  const loadLists = useCallback(async () => {
    setLoadingList(true);
    try {
      const [postResponse, categoryResponse] = await Promise.all([
        fetch('/api/admin/blog/posts', { cache: 'no-store' }),
        fetch('/api/admin/blog/categories', { cache: 'no-store' }),
      ]);
      const [postData, categoryData] = await Promise.all([postResponse.json(), categoryResponse.json()]);
      if (!postResponse.ok || !postData.success) throw new Error(postData.error || 'Failed to load Blog articles.');
      if (!categoryResponse.ok || !categoryData.success) throw new Error(categoryData.error || 'Failed to load Blog categories.');
      setPosts(postData.posts || []);
      setCategories(categoryData.categories || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load Blog data.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadPost = useCallback(async (id: string): Promise<BlogPost | null> => {
    setLoadingPost(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/blog/posts/${id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load Blog article.');
      const post = data.post as BlogPost;
      setActive(post);
      setTitle(post.title);
      setSlug(createBlogArticleSlug(post.title));
      setSummary(post.summary || '');
      setCategoryId(post.category_id || '');
      setAuthor(post.author || '');
      setArticleMonth(monthInputValue(post.article_month));
      setReadingMinutes(String(post.reading_minutes || 5));
      setContent(initialBlogContent(post.content));
      draftRevisionRef.current = 0;
      setDraftRevision(0);
      setSavedRevision(0);
      setSaveStatus('saved');
      return post;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to load Blog article.');
      return null;
    } finally {
      setLoadingPost(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    void loadPageViews();
  }, [loadPageViews]);

  useEffect(() => {
    if (!initialPostId) return;
    void loadPost(initialPostId);
  }, [initialPostId, loadPost]);

  const filteredPosts = useMemo(
    () => categoryFilter ? posts.filter((post) => post.category_id === categoryFilter) : posts,
    [categoryFilter, posts],
  );
  const sortedPosts = useMemo(
    () => filteredPosts.slice().sort((a, b) => {
      const monthOrder = b.article_month.localeCompare(a.article_month);
      return monthOrder || b.updated_at.localeCompare(a.updated_at);
    }),
    [filteredPosts],
  );

  const handleSave = useCallback(async (notify = true): Promise<boolean> => {
    if (!active || saveInProgressRef.current) return false;
    saveInProgressRef.current = true;
    setWorking(true);
    setSaveStatus('saving');
    setError(null);
    try {
      const revisionAtSave = draftRevisionRef.current;
      const response = await fetch(`/api/admin/blog/posts/${active.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          slug,
          summary,
          categoryId: categoryId || null,
          author,
          articleMonth,
          readingMinutes: Number(readingMinutes),
          content: contentRef.current?.() ?? content,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save Blog draft.');
      if (notify) setNotice('Draft saved.');
      if (revisionAtSave === draftRevisionRef.current) {
        setSavedRevision(revisionAtSave);
        setSaveStatus('saved');
      } else {
        setSaveStatus('unsaved');
      }
      if (notify) await loadLists();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save Blog draft.');
      setSaveStatus('unsaved');
      return false;
    } finally {
      saveInProgressRef.current = false;
      setWorking(false);
    }
  }, [active, articleMonth, author, categoryId, content, loadLists, readingMinutes, slug, summary, title]);

  useEffect(() => {
    if (!active || loadingPost || working || draftRevision === savedRevision) return;
    const timeout = window.setTimeout(() => {
      void handleSave(false);
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [active, draftRevision, handleSave, loadingPost, savedRevision, working]);

  const handleCreate = async () => {
    setError(null);
    setWorking(true);
    try {
      const response = await fetch('/api/admin/blog/posts', { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success || !data.id) throw new Error(data.error || 'Failed to create Blog draft.');
      await loadLists();
      router.push(`/admin/blog/draft/${data.id}`);
      await loadPost(data.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to create Blog draft.');
    } finally {
      setWorking(false);
    }
  };

  const handleSelectPost = async (post: BlogPostSummary) => {
    router.push(`/admin/blog/draft/${post.id}`);
    await loadPost(post.id);
  };

  const handlePreview = async () => {
    if (!active) return;
    if (await handleSave()) {
      window.open(
        `/admin/blog/preview/${encodeURIComponent(slug)}`,
        '_blank',
        'noopener,noreferrer',
      );
    }
  };

  const handlePublish = async () => {
    if (!active || !(await handleSave())) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/blog/posts/${active.id}/publish`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to publish Blog article.');
      setNotice('Article published.');
      await loadLists();
      await loadPageViews();
      await loadPost(active.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to publish Blog article.');
    } finally {
      setWorking(false);
    }
  };

  const handleDeletePost = async (post: BlogPostSummary) => {
    if (!window.confirm(`Permanently delete "${post.title}"? This cannot be undone.`)) return;
    setDeletingId(post.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/blog/posts/${post.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to delete Blog article.');
      setPosts((current) => current.filter((item) => item.id !== post.id));
      if (active?.id === post.id) {
        router.push('/admin/blog');
        setActive(null);
      }
      setNotice('Article deleted.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete Blog article.');
    } finally {
      setDeletingId(null);
    }
  };

  const resetCategoryForm = () => {
    setCategoryEditingId(null);
    setCategoryDraft(categoryDraftFrom());
    setError(null);
  };

  const handleCategorySave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCategoryWorking(true);
    setError(null);
    try {
      const response = await fetch(
        categoryEditingId
          ? `/api/admin/blog/categories/${categoryEditingId}`
          : '/api/admin/blog/categories',
        {
          method: categoryEditingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(categoryDraft),
        },
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to save Blog category.');
      setCategoryNotice(categoryEditingId ? 'Category updated.' : 'Category created.');
      resetCategoryForm();
      await loadLists();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save Blog category.');
    } finally {
      setCategoryWorking(false);
    }
  };

  const handleCategoryDelete = async (category: BlogCategory) => {
    if (!window.confirm(`Delete the "${category.name}" category?`)) return;
    setCategoryWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/blog/categories/${category.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to delete Blog category.');
      setCategoryNotice('Category deleted.');
      if (categoryId === category.id) {
        setCategoryId('');
        markDraftChanged();
      }
      await loadLists();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete Blog category.');
    } finally {
      setCategoryWorking(false);
    }
  };

  const openCategoryDialog = () => {
    setError(null);
    setCategoryNotice(null);
    resetCategoryForm();
    setCategoryDialogOpen(true);
  };

  const statusLabel = active?.status === 'published' && (active.has_unpublished_changes || saveStatus !== 'saved')
    ? 'Published · draft changes'
    : active?.status || '';
  const activeViews = active && pageViews?.blog_posts.find((post) => post.id === active.id);

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-white">
      {sidebarCollapsed ? (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          title="Expand sidebar"
          aria-label="Expand Blog sidebar"
          className="flex w-6 shrink-0 items-center justify-center border-r border-[#e8e7e4] bg-[#f7f6f3] text-xs text-slate-500 hover:bg-[#e8e7e4]"
        >
          ▶
        </button>
      ) : (
        <aside className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-[#e8e7e4] bg-[#f7f6f3] sm:w-72">
          <div className="flex items-center justify-between border-b border-[#e8e7e4] px-4 py-3">
            <button type="button" onClick={() => router.push('/admin/blog')} className="text-base font-bold text-slate-800 hover:text-blue-700">
              Blog
            </button>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              title="Collapse sidebar"
              aria-label="Collapse Blog sidebar"
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-[#e8e7e4] hover:text-slate-800"
            >
              ◀
            </button>
          </div>

          <div className="flex items-center justify-between px-4 pb-2 pt-4">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Categories</span>
            <button
              type="button"
              onClick={openCategoryDialog}
              title="Manage categories"
              aria-label="Manage categories"
              className="rounded p-1.5 text-slate-500 hover:bg-white hover:text-blue-700"
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5 px-3 pb-3">
            <button
              type="button"
              onClick={() => setCategoryFilter(null)}
              className={`rounded-full px-2.5 py-1 text-xs ${categoryFilter === null ? 'bg-blue-100 text-blue-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                type="button"
                key={category.id}
                onClick={() => setCategoryFilter(category.id)}
                className={`rounded-full px-2.5 py-1 text-xs ${categoryFilter === category.id ? 'bg-blue-100 text-blue-800' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[#e8e7e4] px-4 pb-2 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Articles</span>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={working}
              title="Create an article"
              aria-label="Create an article"
              className="rounded px-2 py-1 text-lg leading-none text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            >
              <Plus size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
            {loadingList ? (
              <p className="px-3 py-4 text-xs text-slate-500">Loading articles…</p>
            ) : sortedPosts.length === 0 ? (
              <p className="px-3 py-4 text-xs leading-5 text-slate-500">
                {categoryFilter ? 'No articles in this category.' : 'No articles yet. Use + to create the first draft.'}
              </p>
            ) : (
              <div className="space-y-1">
                {sortedPosts.map((post) => {
                  const isSelected = active?.id === post.id;
                  return (
                    <div
                      key={post.id}
                      className={`group flex items-center rounded-md transition-colors ${isSelected ? 'bg-blue-100 text-blue-900' : 'text-slate-700 hover:bg-white/80'}`}
                    >
                      <button
                        type="button"
                        onClick={() => void handleSelectPost(post)}
                        aria-current={isSelected ? 'page' : undefined}
                        className="min-w-0 flex-1 px-3 py-2.5 text-left"
                      >
                        <span className="block truncate text-sm font-medium">{post.title}</span>
                        <span className="mt-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] text-slate-500">{monthLabel(post.article_month)}</span>
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] capitalize ${post.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                            {post.status}{post.has_unpublished_changes ? ' · edited' : ''}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-[10px] text-slate-500">{post.category_name || 'Uncategorised'}</span>
                        <span className="mt-1 block text-[10px] text-slate-500">
                          Views: {formatViewCount(pageViews?.blog_posts.find((item) => item.id === post.id)?.views.total ?? 0)}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeletePost(post)}
                        disabled={working || deletingId !== null}
                        title={`Delete ${post.title}`}
                        aria-label={`Delete ${post.title}`}
                        className="mr-2 rounded p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

          {!active ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Editorial</p>
                <h1 className="mt-2 text-3xl font-bold text-slate-900">Blog</h1>
                <p className="mt-3 text-slate-600">Create, organise, preview, and publish Blog articles.</p>
                <button type="button" onClick={() => void handleCreate()} disabled={working} className={`${buttonClass} mt-6 bg-blue-600 text-white hover:bg-blue-700`}>
                  + New article
                </button>
              </div>
            </section>
          ) : (
            <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold text-slate-900">{title || 'Untitled article'}</h1>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs capitalize text-slate-700">{statusLabel}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span role="status" aria-live="polite" className="px-2 text-xs text-slate-500">
                    {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'unsaved' ? 'Unsaved changes' : 'Saved'}
                  </span>
                  <button type="button" onClick={() => void handleSave()} disabled={working || loadingPost} className={`${buttonClass} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
                    Save draft
                  </button>
                  <button type="button" onClick={() => void handlePreview()} disabled={working || loadingPost} className={`${buttonClass} border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100`}>
                    Preview
                  </button>
                  <button type="button" onClick={() => void handlePublish()} disabled={working || loadingPost} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
                    {working ? 'Working…' : active.status === 'published' ? 'Publish update' : 'Publish'}
                  </button>
                </div>
              </div>

              {loadingPost ? (
                <p role="status" className="py-12 text-center text-sm text-slate-500">Loading article…</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Title
                      <input
                        value={title}
                        onChange={(event) => {
                          const nextTitle = event.target.value;
                          setTitle(nextTitle);
                          setSlug(createBlogArticleSlug(nextTitle));
                          markDraftChanged();
                        }}
                        maxLength={255}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      URL slug
                      <input
                        value={slug}
                        readOnly
                        aria-readonly="true"
                        maxLength={180}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 font-normal text-slate-600"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Category
                      <select
                        value={categoryId}
                        onChange={(event) => { setCategoryId(event.target.value); markDraftChanged(); }}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="">Select a category</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Author
                      <input
                        value={author}
                        onChange={(event) => { setAuthor(event.target.value); markDraftChanged(); }}
                        maxLength={160}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Article month
                      <input
                        type="month"
                        value={articleMonth}
                        onChange={(event) => { setArticleMonth(event.target.value); markDraftChanged(); }}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Reading time (minutes)
                      <input
                        type="number"
                        min={1}
                        max={120}
                        value={readingMinutes}
                        onChange={(event) => { setReadingMinutes(event.target.value); markDraftChanged(); }}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <div className="text-sm text-slate-700">
                      <span className="font-medium">Published at</span>
                      <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600">
                        {publishedDate(active.published_at)}
                      </p>
                    </div>
                  </div>

                  <label className="block text-sm font-medium text-slate-700">
                    Summary
                    <textarea
                      value={summary}
                      onChange={(event) => { setSummary(event.target.value); markDraftChanged(); }}
                      maxLength={4000}
                      rows={3}
                      className="mt-1 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 font-normal focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </label>

                  {active.status === 'published' && (
                    <section className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
                      <h2 className="font-semibold text-slate-900">Publication details</h2>
                      <p className="mt-1 text-sm text-slate-600">Last published {publishedDate(active.published_at)}</p>
                    </section>
                  )}

                  <section aria-label="Article views" className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h2 className="font-semibold text-slate-900">Article Views</h2>
                        <p className="text-xs text-slate-600">Recorded views for this article</p>
                      </div>
                      {activeViews && <p className="text-sm font-semibold text-blue-900">Total: {formatViewCount(activeViews.views.total)}</p>}
                    </div>
                    {pageViewsError ? (
                      <p role="alert" className="mt-3 text-sm text-red-700">Views unavailable: {pageViewsError}</p>
                    ) : !pageViews ? (
                      <p role="status" className="mt-3 text-sm text-slate-500">Loading views…</p>
                    ) : (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        {([
                          ['This week', activeViews?.views.week ?? 0],
                          ['This month', activeViews?.views.month ?? 0],
                          ['This year', activeViews?.views.year ?? 0],
                        ] as const).map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-white px-3 py-2">
                            <p className="text-[11px] text-slate-500">{label}</p>
                            <p className="mt-0.5 text-lg font-semibold text-slate-900">{formatViewCount(value)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="space-y-2">
                    <h2 className="text-sm font-medium text-slate-700">Article content</h2>
                    <BlogEditor
                      key={active.id}
                      postId={active.id}
                      content={content}
                      contentRef={contentRef}
                      onContentChange={markDraftChanged}
                    />
                  </section>
                </>
              )}
            </section>
          )}
        </div>
      </main>

      {categoryDialogOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-categories-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="blog-categories-title" className="text-lg font-semibold text-slate-900">Manage categories</h2>
                <p className="mt-1 text-sm text-slate-600">Add, edit, or remove Blog categories.</p>
              </div>
              <button
                type="button"
                onClick={() => { setCategoryDialogOpen(false); resetCategoryForm(); }}
                aria-label="Close category manager"
                className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            {error && <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {categoryNotice && <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{categoryNotice}</div>}
            <form onSubmit={handleCategorySave} className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <label className="text-sm font-medium text-slate-700">
                Category name
                <input
                  required
                  value={categoryDraft.name}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, name: event.target.value }))}
                  maxLength={80}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                URL slug
                <input
                  required
                  value={categoryDraft.slug}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, slug: event.target.value }))}
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="text-sm font-medium text-slate-700">
                Description
                <textarea
                  value={categoryDraft.description}
                  onChange={(event) => setCategoryDraft((current) => ({ ...current, description: event.target.value }))}
                  maxLength={500}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                />
              </label>
              <div className="flex justify-end gap-2">
                {categoryEditingId && (
                  <button type="button" onClick={resetCategoryForm} className={`${buttonClass} border border-slate-300 bg-white text-slate-700`}>
                    Cancel edit
                  </button>
                )}
                <button type="submit" disabled={categoryWorking} className={`${buttonClass} bg-blue-600 text-white hover:bg-blue-700`}>
                  {categoryWorking ? 'Saving…' : categoryEditingId ? 'Save category' : 'Add category'}
                </button>
              </div>
            </form>

            <div className="mt-5 divide-y divide-slate-200">
              {categories.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{category.name}</p>
                    <p className="text-xs text-slate-500">/{category.slug} · {category.post_count ?? 0} articles</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCategoryEditingId(category.id);
                        setCategoryDraft(categoryDraftFrom(category));
                        setError(null);
                      }}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCategoryDelete(category)}
                      disabled={categoryWorking || Boolean(category.post_count)}
                      title={category.post_count ? 'Move articles to another category first' : 'Delete category'}
                      aria-label={`Delete ${category.name} category`}
                      className="rounded border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
