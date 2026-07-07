import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

interface AnswerWithQuestion {
  questionId: string;
  question: string;
  answer: string;
}

// DeepSeek API（OpenAI互換）
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export async function POST(request: NextRequest) {
  try {
    const { step, answers, previousAnalysis, pastSummary, found } = await request.json();

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
`;
    } else if (step === 'deepdive') {
      prompt = `
${baseInstruction}

あなたは高校生に寄り添うキャリアカウンセラーです。
この生徒には既に「やりたいこと」があります。以下の質問と回答を読んで、
やりたいことの現在地を整理し、発展させる道筋を一緒に考えてください。
${pastSummary ? `\n【この生徒の前回までの記録】\n${pastSummary}\n（前回の内容と今回の回答のつながりや変化・成長に必ず触れること）\n` : ''}
${formatAnswers(answers)}

【出力形式】必ずこの形式で書いてください：

～あなたの話から～
（生徒が書いた内容を具体的に引用しながら2-3文で要約。「〜なんだね」という共感の言葉で）

～現在地の整理～
（やりたいことに対して今どの段階にいるか、できていること・これからのことを2-3文で）

～発展させるヒント～
・（具体的なヒント1）
・（具体的なヒント2）
・（具体的なヒント3）

～生きる糧にするために～
（将来、仕事や人生の軸にしていくための道筋を2-3文で。収入につなげる視点や、力の伸ばし方など具体的に）

～おすすめの次のアクション～
（今日から1週間以内にできる具体的なアクションを1つ、30字以内で）

【重要】
- 回答に書かれている具体的な内容を必ず使う
- 抽象論ではなく、この生徒のやりたいことに即した具体的な提案をする
`;
    } else if (step === 'explore_deep') {
      prompt = `
${baseInstruction}

あなたは高校生に寄り添うキャリアカウンセラーです。
この生徒はまだ「やりたいこと」が見つかっていませんが、前回の診断記録があります。
今回の回答と前回の記録を合わせて、やりたいことの候補を一緒に見つけてください。

【この生徒の前回までの記録】
${pastSummary || '（記録なし）'}

${formatAnswers(answers)}

【出力形式】必ずこの形式で書いてください：

～あなたの話から～
（今回の回答を具体的に引用しながら2-3文で要約。前回からの変化にも触れて）

～見えてきた方向性～
（前回の記録と今回の回答を組み合わせて見える方向性を2-3文で）

～やりたいことの候補～
・（具体的な候補1：一言＋理由を短く）
・（具体的な候補2：一言＋理由を短く）
・（具体的な候補3：一言＋理由を短く）

～おすすめの次のアクション～
（候補を試すために今日からできる具体的なアクションを1つ、30字以内で）

【重要】
- 前回の記録の内容（価値観・才能・情熱・回答）を必ず活かす
- 候補は具体的な活動名で書く（「クリエイティブな仕事」のような抽象語は避ける）
`;
    } else if (step === 'followup_questions') {
      prompt = `
${baseInstruction}

あなたは高校生に寄り添うキャリアカウンセラーです。
この生徒は2回目以降の利用者です。前回までの記録が以下にあります。

【前回までの記録】
${pastSummary || '（記録なし）'}

【今回の状況】
${found
  ? 'この生徒は「やりたいことが見つかっている・決まっている」と答えました。前回の記録を踏まえて、やりたいことをさらに掘り下げ、前回からの進展を確認し、次の一歩を考えられるような質問を作ってください。'
  : 'この生徒は「やりたいことがまだ見つかっていない」と答えました。前回の記録（価値観・才能・情熱など）を踏まえて、やりたいことを決められるように導く質問を作ってください。'}

【出力形式】
質問を4つ、1行に1つずつ書いてください。番号や記号は付けず、質問文のみを書くこと。
各質問は高校生が答えやすい具体的な聞き方にすること。
前回の記録に出てきた具体的な内容（好きなこと、才能、前回のアクションなど）を質問に織り込むこと。
1つ目の質問は必ず「${found ? '今のやりたいこと（決まっていること）は何か、前回から変わったか' : '前回から今日までの間にあった変化や、少しでも興味を持ったこと'}」を聞く質問にすること。
`;

      const completion = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
      });
      const text = completion.choices[0]?.message?.content || '';
      const questions = text
        .split('\n')
        .map((l: string) => l.replace(/^[\d\.\)．、・\-\s]+/, '').trim())
        .filter((l: string) => l.length > 5)
        .slice(0, 4);

      return NextResponse.json({ questions });
    }

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
    });
    const text = completion.choices[0]?.message?.content || '';

    return NextResponse.json({ analysis: text });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    );
  }
}
