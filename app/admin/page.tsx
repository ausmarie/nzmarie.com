"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SkeletonDashboard } from "@/components/admin/Skeleton";

export default function AdminIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Always redirect to dashboard - middleware ensures auth
    router.replace("/admin/dashboard");
  }, [router]);

  return <SkeletonDashboard />;
}
