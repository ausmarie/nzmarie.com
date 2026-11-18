import type { Metadata } from 'next';
import PublicBlogListing from '@/components/blog/PublicBlogListing';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: '博客 | NZ Marie',
  description: '奥克兰买房、卖房实用指南与房地产市场洞察。',
  alternates: {
    canonical: 'https://www.nzmarie.com/blog/cn',
    languages: {
      en: 'https://www.nzmarie.com/blog',
      zh: 'https://www.nzmarie.com/blog/cn',
    },
  },
};

export default async function ChineseBlogPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string | string[]; page?: string | string[] }>;
}) {
  return <PublicBlogListing language="cn" searchParams={await searchParams} />;
}
