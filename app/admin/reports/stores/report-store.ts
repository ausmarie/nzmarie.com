import { create } from 'zustand';
import type { ReportDocumentTree, ReportSuburb } from '@/types/report';

export interface OverviewSuburbDoc {
  id: string;
  title: string;
  quarter: string;
  status: string;
  createdAt: string;
}

export interface OverviewSuburb {
  id: string;
  name: string;
  introDoc: { id: string; title: string; status: string } | null;
  letterDoc: { id: string; title: string; status: string } | null;
  reports: OverviewSuburbDoc[];
}

interface ReportStore {
  documents: ReportDocumentTree[];
  suburbs: ReportSuburb[];
  selectedDocId: string | null;
  slugMap: Record<string, string>;
  idToSlug: Record<string, string>;
  isSaving: boolean;
  lastSaved: string | null;
  sidebarCollapsed: boolean;
  refreshKey: number;
  overviewSuburbs: OverviewSuburb[];
  setDocuments: (docs: ReportDocumentTree[]) => void;
  setSuburbs: (suburbs: ReportSuburb[]) => void;
  setSelectedDocId: (id: string | null) => void;
  setSlugMap: (map: Record<string, string>, idMap: Record<string, string>) => void;
  setIsSaving: (saving: boolean) => void;
  setLastSaved: (time: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  updateDocument: (id: string, updates: Partial<ReportDocumentTree>) => void;
  removeDocument: (id: string) => void;
  bumpRefreshKey: () => void;
  setOverviewSuburbs: (data: OverviewSuburb[]) => void;
}

export const useReportStore = create<ReportStore>((set) => ({
  documents: [],
  suburbs: [],
  selectedDocId: null,
  slugMap: {},
  idToSlug: {},
  isSaving: false,
  lastSaved: null,
  sidebarCollapsed: false,
  refreshKey: 0,
  overviewSuburbs: [],

  setDocuments: (documents) => set({ documents }),
  setSuburbs: (suburbs) => set({ suburbs }),
  setSelectedDocId: (selectedDocId) => set({ selectedDocId }),
  setSlugMap: (slugMap, idToSlug) => set({ slugMap, idToSlug }),
  setIsSaving: (isSaving) => set({ isSaving }),
  setLastSaved: (lastSaved) => set({ lastSaved }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  updateDocument: (id, updates) => set((state) => ({
    documents: state.documents.map((d) =>
      d.id === id ? { ...d, ...updates } : d
    ),
  })),

  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter((d) => d.id !== id),
  })),

  bumpRefreshKey: () => set((state) => ({ refreshKey: state.refreshKey + 1 })),
  setOverviewSuburbs: (overviewSuburbs) => set({ overviewSuburbs }),
}));
