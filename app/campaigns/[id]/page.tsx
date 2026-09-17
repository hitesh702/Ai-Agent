import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function CampaignAliasPage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/campaigns/${id}`);
}
