import type { Metadata } from "next";
import MainPageContent from "../../components/MainPageContent";

export const metadata: Metadata = {
    title: "NZ Marie - 持牌房地产专家 | 奥克兰北岸",
    description: "Marie Nian 提供奥克兰北岸专业的房地产服务。凭借金融背景和市场洞察力，为您提供买卖房产的专业咨询与服务。",
};

export default function HomeCN() {
    return <MainPageContent lang="zh" />;
}
