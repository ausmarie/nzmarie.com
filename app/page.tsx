import MainPageContent from "../components/MainPageContent";
import PageViewTracker from "@/components/PageViewTracker";
import { getLatestMarketReportUrl } from "@/lib/market-report-public";

export const revalidate = 300;

export default async function Home() {
  const marketReportsHref = await getLatestMarketReportUrl('en');
  return (
    <>
      <PageViewTracker pageType="home" language="en" />
      <MainPageContent lang="en" marketReportsHref={marketReportsHref ?? '/market-reports?lang=en'} />
    </>
  );
}
