import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    const fullPrompt = `Create an inspiring, hopeful image that represents a high school student's dream and future vision: ${prompt}. Style: Colorful, optimistic, modern illustration with a sense of possibility and growth.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini image API error:', response.status, errorText);
      throw new Error('Image generation request failed');
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
      throw new Error('No image generated');
    }

    const imageUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: 'Image generation failed' },
      { status: 500 }
    );
  }
}
