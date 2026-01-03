
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;

  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    return new NextResponse('File not found', { status: 404 });
  }

  // Return the file data with correct headers
  return new NextResponse(file.data, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `inline; filename="${file.filename}"`,
      'Content-Length': file.size.toString(),
    },
  });
}
