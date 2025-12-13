'use client';

import { useState } from 'react';
import { Step, Answer, SessionState } from '@/types';
import { questions, getQuestionsByStep } from '@/lib/questions';

const stepTitles: Record<Step, string> = {
  intro: 'はじめに',
  values: 'ステップ1: 価値観を知る',
  talents: 'ステップ2: 才能を知る',
  passion: 'ステップ3: 情熱を知る',
  analysis: '分析中...',
  result: '分析結果',
  choice: '最後に',
};

const stepDescriptions: Record<Step, string> = {
  intro: '',
  values: '価値観とは、自分が「どうありたいか」「どういう状態だと気持ちが良いか」という、行動の土台となるものです。',
  talents: '才能とは、自分にとっては当たり前で楽にできてしまうこと（天性の能力）です。後から身につけたスキルとは違います。',
  passion: '情熱とは、生産性や合理性を無視してでも惹きつけられる、個人的な興味関心です。',
  analysis: '',
  result: '',
  choice: '',
};

export default function Home() {
  const [session, setSession] = useState<SessionState>({
    studentName: '',
    currentStep: 'intro',
    answers: [],
    stepAnalysis: {},
  });
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (session.studentName.trim()) {
      setSession(prev => ({ ...prev, currentStep: 'values' }));
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const analyzeStep = async (step: 'values' | 'talents' | 'passion' | 'final') => {
    setIsLoading(true);
    setError(null);

    try {
      const answersForStep = step === 'final'
        ? session.answers
        : session.answers.filter(a => a.questionId.startsWith(step[0]));

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          answers: answersForStep,
          previousAnalysis: session.stepAnalysis,
        }),
      });

      if (!response.ok) throw new Error('分析に失敗しました');

      const data = await response.json();
      return data.analysis;
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析中にエラーが発生しました');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleStepSubmit = async () => {
    const stepQuestions = getQuestionsByStep(session.currentStep);
    const newAnswers: Answer[] = stepQuestions.map(q => ({
      questionId: q.id,
      answer: currentAnswers[q.id] || '',
    }));

    const updatedAnswers = [...session.answers, ...newAnswers];
    setSession(prev => ({ ...prev, answers: updatedAnswers }));

    // 各ステップの分析
    const stepKey = session.currentStep as 'values' | 'talents' | 'passion';
    setSession(prev => ({ ...prev, currentStep: 'analysis' }));

    const analysis = await analyzeStep(stepKey);

    if (analysis) {
      setSession(prev => ({
        ...prev,
        stepAnalysis: { ...prev.stepAnalysis, [stepKey]: analysis },
        currentStep: getNextStep(stepKey),
        answers: updatedAnswers,
      }));
      setCurrentAnswers({});
    } else {
      // エラー時は元のステップに戻す
      setSession(prev => ({ ...prev, currentStep: stepKey }));
    }
  };

  const getNextStep = (current: Step): Step => {
    const order: Step[] = ['intro', 'values', 'talents', 'passion', 'result'];
    const currentIndex = order.indexOf(current);
    return order[currentIndex + 1] || 'result';
  };

  const handleFinalAnalysis = async () => {
    setIsLoading(true);
    setSession(prev => ({ ...prev, currentStep: 'analysis' }));

    const finalAnalysis = await analyzeStep('final');

    if (finalAnalysis) {
      // 画像プロンプトを抽出
      const imagePromptMatch = finalAnalysis.match(/===画像プロンプト===\s*([\s\S]*?)$/);
      const imagePrompt = imagePromptMatch ? imagePromptMatch[1].trim() : '';

      // 画像生成
      let imageUrl = '';
      if (imagePrompt) {
        try {
          const imageResponse = await fetch('/api/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: imagePrompt }),
          });
          if (imageResponse.ok) {
            const imageData = await imageResponse.json();
            imageUrl = imageData.imageUrl;
          }
        } catch (err) {
          console.error('Image generation failed:', err);
        }
      }

      setSession(prev => ({
        ...prev,
        stepAnalysis: { ...prev.stepAnalysis, final: finalAnalysis },
        generatedImage: imageUrl,
        currentStep: 'result',
      }));
    }

    setIsLoading(false);
  };

  const handleSaveToDrive = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/save-to-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: session.studentName,
          analysis: {
            values: session.stepAnalysis.values,
            talents: session.stepAnalysis.talents,
            passion: session.stepAnalysis.passion,
            final: session.stepAnalysis.final,
          },
          imageUrl: session.generatedImage,
        }),
      });

      if (response.ok) {
        setSession(prev => ({ ...prev, currentStep: 'choice' }));
      } else {
        throw new Error('保存に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChoice = (wantsSupport: boolean) => {
    setSession(prev => ({ ...prev, wantsSupport }));
    // ここで選択結果を保存したり、先生に通知したりする処理を追加可能
    alert(wantsSupport
      ? '先生にサポートを依頼しました！授業で一緒に取り組んでいきましょう。'
      : '了解です！自分のペースで進めてください。困ったらいつでも声をかけてね。'
    );
  };

  // イントロ画面
  if (session.currentStep === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">
            🔍 やりたいことを見つけよう
          </h1>

          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ これは成績には一切関係ありません</strong><br />
              正直に、思ったことをそのまま書いてください。
            </p>
          </div>

          <div className="space-y-4 mb-8 text-gray-600">
            <p>このワークでは、3つの視点から自分を分析します：</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>価値観（V）</strong>：何を大切にしているか</li>
              <li><strong>才能（T）</strong>：何が得意か（自覚してないものも）</li>
              <li><strong>情熱（P）</strong>：何に惹かれるか</li>
            </ul>
            <p>この3つが重なるところに、あなたの「やりたいこと」があります。</p>
            <p className="text-sm text-gray-500">所要時間：約30分</p>
          </div>

          <form onSubmit={handleNameSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                名前を入力してください
              </label>
              <input
                type="text"
                value={session.studentName}
                onChange={e => setSession(prev => ({ ...prev, studentName: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-900"
                placeholder="例：山田太郎"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              はじめる
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 分析中画面
  if (session.currentStep === 'analysis' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-6"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">AIが分析中...</h2>
          <p className="text-gray-600">あなたの回答を読み解いています</p>
        </div>
      </div>
    );
  }

  // 結果画面
  if (session.currentStep === 'result') {
    const analysisText = session.stepAnalysis.final || '';
    const mainAnalysis = analysisText.split('===画像プロンプト===')[0].replace('===分析===', '').trim();

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
              🎯 {session.studentName}さんの分析結果
            </h1>

            {/* 各ステップの分析結果 */}
            <div className="space-y-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-6">
                <h3 className="font-bold text-blue-800 mb-3">💎 価値観</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{session.stepAnalysis.values}</p>
              </div>

              <div className="bg-green-50 rounded-lg p-6">
                <h3 className="font-bold text-green-800 mb-3">⭐ 才能</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{session.stepAnalysis.talents}</p>
              </div>

              <div className="bg-orange-50 rounded-lg p-6">
                <h3 className="font-bold text-orange-800 mb-3">🔥 情熱</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{session.stepAnalysis.passion}</p>
              </div>

              <div className="bg-purple-50 rounded-lg p-6">
                <h3 className="font-bold text-purple-800 mb-3">🚀 やりたいこと（V × T × P）</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{mainAnalysis}</p>
              </div>
            </div>

            {/* 生成された画像 */}
            {session.generatedImage && (
              <div className="mb-8">
                <h3 className="font-bold text-gray-800 mb-4 text-center">🖼️ あなたの未来のビジョン</h3>
                <div className="flex justify-center">
                  <img
                    src={session.generatedImage}
                    alt="Generated vision"
                    className="rounded-lg shadow-lg max-w-full h-auto"
                    style={{ maxHeight: '400px' }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSaveToDrive}
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
            >
              結果を保存して次へ進む
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 選択画面
  if (session.currentStep === 'choice') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-2xl w-full">
          <h1 className="text-2xl font-bold text-center mb-6 text-gray-800">
            ✨ 分析完了！
          </h1>

          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-8">
            <p className="text-green-800">
              結果はGoogle Driveの「{session.studentName}」フォルダに保存されました。
            </p>
          </div>

          <div className="space-y-4 mb-8 text-gray-700">
            <p className="text-lg font-medium">
              この分析で出てきた「やりたいこと」、授業でやってみる？
            </p>
            <p className="text-sm text-gray-500">
              どちらを選んでも成績には関係ありません。<br />
              やってみたいなら一緒に取り組むし、一人でやりたいなら見守ります。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => handleChoice(true)}
              className="bg-indigo-600 text-white py-4 px-6 rounded-lg hover:bg-indigo-700 transition font-medium"
            >
              👋 サポートしてほしい
              <span className="block text-sm font-normal mt-1">
                先生と一緒に取り組む
              </span>
            </button>
            <button
              onClick={() => handleChoice(false)}
              className="bg-gray-200 text-gray-800 py-4 px-6 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              🙋 自分でやってみる
              <span className="block text-sm font-normal mt-1">
                一人で進める（困ったら声かけてね）
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 質問画面（values, talents, passion）
  const currentQuestions = getQuestionsByStep(session.currentStep);
  const stepIndex = ['values', 'talents', 'passion'].indexOf(session.currentStep) + 1;
  const totalSteps = 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* プログレスバー */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>ステップ {stepIndex} / {totalSteps}</span>
              <span>{stepTitles[session.currentStep]}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-indigo-600 rounded-full transition-all"
                style={{ width: `${(stepIndex / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {stepTitles[session.currentStep]}
          </h2>
          <p className="text-gray-600 mb-6">
            {stepDescriptions[session.currentStep]}
          </p>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {currentQuestions.map((q, index) => (
              <div key={q.id} className="space-y-2">
                <label className="block text-gray-800 font-medium">
                  Q{index + 1}. {q.question}
                </label>
                {q.subQuestions && (
                  <ul className="text-sm text-gray-500 ml-4 list-disc list-inside mb-2">
                    {q.subQuestions.map((sq, i) => (
                      <li key={i}>{sq}</li>
                    ))}
                  </ul>
                )}
                <textarea
                  value={currentAnswers[q.id] || ''}
                  onChange={e => handleAnswerChange(q.id, e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[120px] text-gray-900"
                  placeholder={q.placeholder}
                />
              </div>
            ))}
          </div>

          <div className="mt-8">
            {session.currentStep === 'passion' ? (
              <button
                onClick={async () => {
                  await handleStepSubmit();
                  await handleFinalAnalysis();
                }}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                分析結果を見る
              </button>
            ) : (
              <button
                onClick={handleStepSubmit}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-medium"
              >
                次へ進む
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
