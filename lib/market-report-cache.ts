import { revalidatePath } from 'next/cache';

export function revalidateMarketReportHomePages(): void {
  revalidatePath('/', 'page');
  revalidatePath('/cn', 'page');
}
