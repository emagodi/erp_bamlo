import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import ScheduleEditor from './ScheduleEditor.client';
import { createScheduleFromQuote } from '../../actions';
import { getProductivitySettings } from '../../actions';
import SubmitButton from '@/components/SubmitButton';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

async function extractScheduleFromQuote(projectId: string) {
  'use server';
  await createScheduleFromQuote(projectId);
  redirect(`/projects/${projectId}/schedule`);
}

export default async function ProjectSchedulePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const me = await getCurrentUser();

  const schedule = await prisma.schedule.findFirst({
    where: { projectId },
    include: { items: { orderBy: { createdAt: 'asc' }, include: { assignees: true } } },
  });
  const employees = await prisma.employee.findMany({
    orderBy: [{ givenName: 'asc' }, { surname: 'asc' }],
    select: { id: true, givenName: true, surname: true, role: true },
  });

  const productivity = await getProductivitySettings(projectId);

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 sm:p-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule of Work</h1>
          <p className="text-sm text-gray-500 mt-1">Plan labour & schedule for the project.</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/projects/${projectId}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
            Back to Project
          </Link>
          {!schedule && (
            <form action={extractScheduleFromQuote.bind(null, projectId)}>
              <SubmitButton className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2">
                Extract from Quote
              </SubmitButton>
            </form>
          )}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Schedule Editor</CardTitle>
          <CardDescription>Manage tasks, timelines, and employee assignments.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleEditor
            projectId={projectId}
            schedule={schedule ?? null}
            user={me ?? null}
            employees={employees}
            productivity={productivity}
          />
        </CardContent>
      </Card>
    </div>
  );
}
