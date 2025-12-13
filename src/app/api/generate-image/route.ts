import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: `Create an inspiring, hopeful image that represents a high school student's dream and future vision: ${prompt}. Style: Colorful, optimistic, modern illustration with a sense of possibility and growth.`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error('No image generated');
    }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: 'Image generation failed' },
      { status: 500 }
    );
  }
}
