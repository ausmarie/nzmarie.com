export type DocType = 'report' | 'letter' | 'suburb_intro' | 'general';
export type DocStatus = 'draft' | 'finalised' | 'archived';

export interface ReportSuburb {
  id: string;
  name: string;
  region: string;
  is_active: boolean;
  sort_order: number;
}

import type { DefaultBlockSchema, DefaultInlineContentSchema, DefaultStyleSchema, PartialBlock } from '@blocknote/core';

export type ReportEditorContent = PartialBlock<DefaultBlockSchema, DefaultInlineContentSchema, DefaultStyleSchema>[];

export interface ReportDocument {
  id: string;
  user_id: string;
  parent_id: string | null;
  doc_type: DocType;
  suburb_id: string | null;
  quarter: string | null;
  title: string;
  content: ReportEditorContent | null;
  icon: string | null;
  cover_type: string | null;
  cover_value: string | null;
  sort_order: number;
  status: DocStatus;
  suburb_name?: string;
  suburb_region?: string;
  created_at: string;
  updated_at: string;
}

export interface ReportDocumentTree extends ReportDocument {
  children: ReportDocumentTree[];
}

export interface AnalyticsSnapshot {
  suburb: string;
  quarter: string;
  chart_data_url?: string;
  table_data_url?: string;
  last_sold_url?: string;
}
