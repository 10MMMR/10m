import { ClassDetailsHeader } from "./_components/class-details-header";

type ClassDetailsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClassDetailsPage({ params }: ClassDetailsPageProps) {
  const { id } = await params;

  return <ClassDetailsHeader classId={id} />;
}
