import { NextRequest, NextResponse } from 'next/server';

// シートから同じ名前の過去記録を検索する
export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();
    const webhookUrl = process.env.GAS_WEBHOOK_URL;

    if (!webhookUrl || !name?.trim()) {
      return NextResponse.json({ found: false, records: [] });
    }

    const response = await fetch(`${webhookUrl}?name=${encodeURIComponent(name.trim())}`, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('History lookup failed:', response.status);
      return NextResponse.json({ found: false, records: [] });
    }

    const data = await response.json();
    return NextResponse.json({
      found: !!data.found,
      records: Array.isArray(data.records) ? data.records : [],
    });
  } catch (error) {
    // 履歴が取れなくても診断は続行できるようにエラーにしない
    console.error('History lookup error:', error);
    return NextResponse.json({ found: false, records: [] });
  }
}
