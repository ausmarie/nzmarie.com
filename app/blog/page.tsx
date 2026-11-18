import type { Metadata } from 'next';
import PublicBlogListing from '@/components/blog/PublicBlogListing';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Blog | NZ Marie',
    description: 'Practical guides and market insights for buying and selling property in Auckland.',
    alternates: {
      canonical: 'https://www.nzmarie.com/blog',
      languages: {
        en: 'https://www.nzmarie.com/blog',
        zh: 'https://www.nzmarie.com/blog/cn',
      },
    },
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string | string[]; page?: string | string[] }>;
}) {
  return <PublicBlogListing language="en" searchParams={await searchParams} />;
}
