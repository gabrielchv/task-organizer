import { notFound } from "next/navigation";
import { ChatScreen } from "@/features/chat/components/ChatScreen";
import { isLocale } from "@/i18n/config";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return <ChatScreen locale={lang} />;
}
