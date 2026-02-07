import { TopicThreadClient } from "./topic-thread-client";

export default async function TopicThreadPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { topicId } = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <TopicThreadClient
      topicId={topicId}
      searchParams={resolvedSearchParams}
    />
  );
}
