import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Answer } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { step, answers, previousAnalysis } = await request.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    let prompt = '';

    if (step === 'values') {
      prompt = `
あなたは高校生の自己分析をサポートするキャリアカウンセラーです。
以下は高校生の「価値観」に関する回答です。

${answers.map((a: Answer) => `質問: ${a.questionId}\n回答: ${a.answer}`).join('\n\n')}

この回答から、この生徒の価値観を分析してください：
1. コアとなる価値観のキーワードを5つ抽出（例：挑戦、自由、協調、成長、創造など）
2. それらの価値観を重要度順にランキング
3. この価値観を仕事の目的として翻訳するとどうなるか

分析は高校生にもわかりやすい言葉で、具体的に説明してください。
形式：自然な文章で、親しみやすいトーンで。500文字程度。
`;
    } else if (step === 'talents') {
      prompt = `
あなたは高校生の自己分析をサポートするキャリアカウンセラーです。
以下は高校生の「才能」に関する回答です。

${answers.map((a: Answer) => `質問: ${a.questionId}\n回答: ${a.answer}`).join('\n\n')}

この回答から、この生徒の才能を分析してください：
1. 充実体験から見える天然の能力
2. イライラの裏側にある無自覚な才能
3. 短所を「〜だからこそ」で裏返した強み
4. これらから導かれる核となる才能3つ

分析は高校生にもわかりやすい言葉で、具体的に説明してください。
特に「自分にとっては当たり前」だけど実は才能であることを気づかせてあげてください。
形式：自然な文章で、親しみやすいトーンで。500文字程度。
`;
    } else if (step === 'passion') {
      prompt = `
あなたは高校生の自己分析をサポートするキャリアカウンセラーです。
以下は高校生の「情熱」に関する回答です。

${answers.map((a: Answer) => `質問: ${a.questionId}\n回答: ${a.answer}`).join('\n\n')}

この回答から、この生徒の情熱を分析してください：
1. 真の情熱の対象は何か
2. その情熱の「何」に惹かれているのか（深掘り）
3. 興味関心の方向性

分析は高校生にもわかりやすい言葉で、具体的に説明してください。
「好き」の本質的な部分を引き出してあげてください。
形式：自然な文章で、親しみやすいトーンで。400文字程度。
`;
    } else if (step === 'final') {
      prompt = `
あなたは高校生の自己分析をサポートするキャリアカウンセラーです。
これまでの分析結果を統合して、この生徒の「やりたいこと」を導き出してください。

【価値観の分析】
${previousAnalysis.values}

【才能の分析】
${previousAnalysis.talents}

【情熱の分析】
${previousAnalysis.passion}

これらを組み合わせて（V × T × P）：
1. この生徒に向いていそうな具体的な活動・プロジェクトを3つ提案
2. 最もおすすめの方向性と、その理由
3. 今すぐ始められる具体的な第一歩（アクションプラン）を3つ
4. この生徒の「やりたいこと」を一言で表現した場合のビジョン

最後に、DALL-Eで画像を生成するためのプロンプトを英語で作成してください。
この生徒の理想の未来、やりたいことを象徴的に表現する画像のプロンプトです。

形式：
===分析===
（上記1-4の内容を自然な文章で）

===画像プロンプト===
（英語で100語程度の画像生成プロンプト）
`;
    }

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({ analysis: text });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
}
