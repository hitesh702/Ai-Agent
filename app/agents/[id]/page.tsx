import { redirect } from "next/navigation";

type Props = { params: Promise<{ id: string }> };

export default async function AgentAliasPage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/agents/${id}`);
}
