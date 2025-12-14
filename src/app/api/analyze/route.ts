import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AnswerWithQuestion {
  questionId: string;
  question: string;
  answer: string;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { step, answers, previousAnalysis } = await request.json();

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let prompt = '';

    // 回答をフォーマット（質問と回答のペア）
    const formatAnswers = (answerList: AnswerWithQuestion[]) => {
      return answerList.map((a: AnswerWithQuestion) =>
        `【質問】${a.question}\n【回答】${a.answer || '（未回答）'}`
      ).join('\n\n');
    };

    const baseInstruction = `
【絶対に守るルール】
- 「はい、承知しました」「任せてください」などの前置きは絶対に書かない
- マークダウン記法（**太字**、##見出し など）は絶対に使わない
- 絵文字は絶対に使わない
- ユーザーが書いていないことを勝手に追加しない
- ユーザーの回答に書かれている内容だけを元に分析する
- 回答が短い・抽象的な場合でも、書かれている内容から最大限読み取る
`;

    if (step === 'values') {
      prompt = `
${baseInstruction}

あなたは高校生に寄り添うキャリアカウンセラーです。
以下の質問と回答を読んで、この生徒の価値観を分析してください。

${formatAnswers(answers)}

【出力形式】必ずこの形式で書いてください：

～あなたの回答から～
（生徒が書いた内容を具体的に引用しながら2-3文で要約。「〜なんだね」「〜と感じているんだね」という共感の言葉で）

～大切にしている価値観～
（回答から読み取れる価値観を3つ、それぞれ一言で。例：「自由」「成長」「つながり」）

～まとめ～
（上記の価値観を踏まえて、この生徒が仕事で大切にしそうなことを50字以内で）

【重要】
- 回答に書かれている具体的なキーワードや表現を必ず使う
- 「自由でいたい」と書いてあれば「自由」を価値観として抽出する
- 回答が短くても、書かれている内容から価値観を読み取る
`;
    } else if (step === 'talents') {
      prompt = `
${baseInstruction}

あなたは高校生に寄り添うキャリアカウンセラーです。
以下の質問と回答を読んで、この生徒の才能を分析してください。

${formatAnswers(answers)}

【出力形式】必ずこの形式で書いてください：

～あなたの回答から～
（生徒が書いた内容を具体的に引用しながら2-3文で要約。「〜なんだね」という共感の言葉で）

～見えてきた才能～
（回答から読み取れる才能を3つ、それぞれ一言で。例：「集中力」「分析力」「共感力」）

～まとめ～
（この才能を活かせる場面を50字以内で）

【重要】
- 充実体験からは「何をしている時に充実を感じるか」を才能として抽出
- イライラからは「自分には当たり前にできること」を才能として抽出
- 短所からは「だからこそ」で強みに変換
`;
    } else if (step === 'passion') {
      prompt = `
${baseInstruction}

あなたは高校生に寄り添うキャリアカウンセラーです。
以下の質問と回答を読んで、この生徒の情熱を分析してください。

${formatAnswers(answers)}

【出力形式】必ずこの形式で書いてください：

～あなたの回答から～
（生徒が書いた内容を具体的に引用しながら2-3文で要約。「〜が好きなんだね」という共感の言葉で）

～情熱のポイント～
（回答から読み取れる興味・関心を3つ、それぞれ一言で）

～まとめ～
（この情熱の本質を50字以内で）

【重要】
- 回答に書かれている具体的な活動や興味を必ず抽出する
- 「ゲーム」「絵を描く」など具体的なものがあればそれを使う
`;
    } else if (step === 'final') {
      prompt = `
${baseInstruction}

あなたは高校生に寄り添うキャリアカウンセラーです。
これまでの分析を統合して「やりたいこと」を導き出してください。

【価値観】
${previousAnalysis.values}

【才能】
${previousAnalysis.talents}

【情熱】
${previousAnalysis.passion}

【出力形式】必ずこの形式で書いてください：

～3つの要素をかけ合わせると～
（価値観×才能×情熱を組み合わせた方向性を2-3文で）

～おすすめの活動～
・（具体的な活動1）
・（具体的な活動2）
・（具体的な活動3）

～今日からできる第一歩～
（すぐに始められる具体的なアクションを1つ、30字以内で）

===画像プロンプト===
（この生徒の理想の未来を表現する画像の英語プロンプト、50語程度）
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
