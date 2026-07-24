import { getChatThreadData } from "./get-thread-data";
import { ChatThread } from "./chat-thread";

export default async function ChatThreadPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const data = await getChatThreadData(leadId);
  return <ChatThread {...data} />;
}
