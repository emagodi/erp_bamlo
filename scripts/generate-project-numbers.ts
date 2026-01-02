// Script to generate project numbers for existing projects
// Run with: npx tsx scripts/generate-project-numbers.ts

import { prisma } from '../lib/db';
import { format } from 'date-fns';

async function generateProjectNumbers() {
    console.log('Starting project number generation...');

    // Get all projects without project numbers, ordered by creation date
    const projects = await prisma.project.findMany({
        where: {
            projectNumber: null,
        },
        orderBy: {
            createdAt: 'asc',
        },
        select: {
            id: true,
            createdAt: true,
        },
    });

    console.log(`Found ${projects.length} projects without project numbers`);

    // Group projects by date
    const projectsByDate = new Map<string, typeof projects>();
    for (const project of projects) {
        const dateStr = format(project.createdAt, 'yyyyMMdd');
        const existing = projectsByDate.get(dateStr) || [];
        existing.push(project);
        projectsByDate.set(dateStr, existing);
    }

    let updated = 0;

    // Generate numbers for each date group
    for (const [dateStr, dateProjects] of projectsByDate.entries()) {
        console.log(`\nProcessing ${dateProjects.length} projects for date ${dateStr}`);

        for (let i = 0; i < dateProjects.length; i++) {
            const project = dateProjects[i];
            const sequence = (i + 1).toString().padStart(3, '0');
            const projectNumber = `BM${dateStr}${sequence}`;

            await prisma.project.update({
                where: { id: project.id },
                data: { projectNumber },
            });

            console.log(`  Generated ${projectNumber} for project ${project.id}`);
            updated++;
        }
    }

    console.log(`\n✅ Successfully generated ${updated} project numbers`);
}

generateProjectNumbers()
    .then(() => {
        console.log('Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
