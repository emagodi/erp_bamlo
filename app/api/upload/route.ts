
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const savedFile = await prisma.file.create({
      data: {
        filename: file.name,
        mimeType: file.type,
        data: buffer,
        size: buffer.length,
      },
    });

    return NextResponse.json({ 
      id: savedFile.id,
      url: `/api/files/${savedFile.id}` 
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
