'use client';

import { useState } from 'react';
import { Step, Answer, SessionState } from '@/types';
import { getQuestionsByStep } from '@/lib/questions';

const stepTitles: Record<Step, string> = {
  intro: 'はじめに',
  values: 'STEP 1: 価値観を知る',
  talents: 'STEP 2: 才能を知る',
  passion: 'STEP 3: 情熱を知る',
  analysis: '分析中',
  result: '分析結果',
  firstAction: '今日のファーストアクション',
  complete: '完了',
};

const stepDescriptions: Record<Step, string> = {
  intro: '',
  values: '価値観とは、自分が「どうありたいか」「どういう状態だと気持ちが良いか」という、行動の土台となるものです。',
  talents: '才能とは、自分にとっては当たり前で楽にできてしまうこと（天性の能力）です。後から身につけたスキルとは違います。',
  passion: '情熱とは、生産性や合理性を無視してでも惹きつけられる、個人的な興味関心です。',
  analysis: '',
  result: '',
  firstAction: '',
  complete: '',
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
      const imagePromptMatch = finalAnalysis.match(/===画像プロンプト===\s*([\s\S]*?)$/);
      const imagePrompt = imagePromptMatch ? imagePromptMatch[1].trim() : '';

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
    setError(null);
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

      const data = await response.json();

      if (response.ok) {
        setSession(prev => ({ ...prev, currentStep: 'firstAction' }));
      } else {
        throw new Error(data.error || '保存に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const [firstActionInput, setFirstActionInput] = useState('');

  const handleFirstActionSubmit = () => {
    if (firstActionInput.trim()) {
      setSession(prev => ({ ...prev, firstAction: firstActionInput, currentStep: 'complete' }));
    }
  };

  // イントロ画面
  if (session.currentStep === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10 max-w-2xl w-full border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[#004097] tracking-tight">
              やりたいことを見つけよう
            </h1>
            <div className="w-20 h-1 bg-gradient-to-r from-[#004097] to-[#01654d] mx-auto mt-4 rounded-full"></div>
          </div>


          <div className="space-y-4 mb-8 text-gray-600">
            <p className="text-gray-700">このワークでは、3つの視点から自分を分析します：</p>
            <ul className="space-y-3 ml-4">
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-[#004097] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">V</span>
                <span><strong className="text-[#004097]">価値観</strong>：何を大切にしているか</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-[#01654d] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">T</span>
                <span><strong className="text-[#01654d]">才能</strong>：何が得意か（自覚してないものも）</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-6 h-6 bg-gradient-to-r from-[#004097] to-[#01654d] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">P</span>
                <span><strong className="text-gray-700">情熱</strong>：何に惹かれるか</span>
              </li>
            </ul>
            <p className="text-gray-700 mt-4">この3つが重なるところに、あなたの「やりたいこと」があります。</p>
            <p className="text-sm text-gray-500 mt-2">所要時間：約30分</p>
          </div>

          <form onSubmit={handleNameSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                名前を入力してください
              </label>
              <input
                type="text"
                value={session.studentName}
                onChange={e => setSession(prev => ({ ...prev, studentName: e.target.value }))}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004097] focus:border-[#004097] text-gray-900 transition-all"
                placeholder="例：山田太郎"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-[#004097] border-t-transparent animate-spin"></div>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">AIが分析中</h2>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[#004097]">
                {session.studentName}さんの分析結果
              </h1>
              <div className="w-20 h-1 bg-gradient-to-r from-[#004097] to-[#01654d] mx-auto mt-4 rounded-full"></div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-6 mb-8">
              <div className="bg-[#004097]/5 rounded-2xl p-6 border border-[#004097]/10">
                <h3 className="font-bold text-[#004097] mb-4 text-lg flex items-center gap-2">
                  <span className="w-8 h-8 bg-[#004097] text-white rounded-full flex items-center justify-center text-sm">V</span>
                  価値観
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{session.stepAnalysis.values}</p>
              </div>

              <div className="bg-[#01654d]/5 rounded-2xl p-6 border border-[#01654d]/10">
                <h3 className="font-bold text-[#01654d] mb-4 text-lg flex items-center gap-2">
                  <span className="w-8 h-8 bg-[#01654d] text-white rounded-full flex items-center justify-center text-sm">T</span>
                  才能
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{session.stepAnalysis.talents}</p>
              </div>

              <div className="bg-gradient-to-r from-[#004097]/5 to-[#01654d]/5 rounded-2xl p-6 border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 text-lg flex items-center gap-2">
                  <span className="w-8 h-8 bg-gradient-to-r from-[#004097] to-[#01654d] text-white rounded-full flex items-center justify-center text-sm">P</span>
                  情熱
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{session.stepAnalysis.passion}</p>
              </div>

              <div className="bg-slate-800 rounded-2xl p-6 text-white">
                <h3 className="font-bold mb-4 text-lg flex items-center gap-2">
                  <span className="w-8 h-8 bg-white text-slate-800 rounded-full flex items-center justify-center text-sm font-bold">!</span>
                  やりたいこと（V × T × P）
                </h3>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-200">{mainAnalysis}</p>
              </div>
            </div>

            {session.generatedImage && (
              <div className="mb-8">
                <h3 className="font-bold text-gray-800 mb-4 text-center text-lg">あなたの未来のビジョン</h3>
                <div className="flex justify-center">
                  <img
                    src={session.generatedImage}
                    alt="Generated vision"
                    className="rounded-2xl shadow-xl max-w-full h-auto border-4 border-white"
                    style={{ maxHeight: '400px' }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSaveToDrive}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg disabled:opacity-50"
            >
              結果を保存して次へ進む
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ファーストアクション入力画面
  if (session.currentStep === 'firstAction') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#004097]">
              今日のファーストアクション
            </h1>
            <div className="w-20 h-1 bg-gradient-to-r from-[#004097] to-[#01654d] mx-auto mt-4 rounded-full"></div>
          </div>

          <div className="bg-[#01654d]/10 border-l-4 border-[#01654d] p-4 mb-8 rounded-r-lg">
            <p className="text-[#01654d]">
              分析結果はGoogle Driveの「{session.studentName}」フォルダに保存されました。
            </p>
          </div>

          <div className="space-y-4 mb-8 text-gray-700">
            <p className="text-lg font-medium">
              分析結果を踏まえて、今日できる小さな一歩を決めよう
            </p>
            <p className="text-sm text-gray-500">
              大きなことでなくてOK。「調べてみる」「誰かに話してみる」「5分だけやってみる」など、<br />
              今日中にできる具体的なアクションを書いてください。
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-gray-800 font-medium text-lg mb-3">
                今日、何をする？
              </label>
              <textarea
                value={firstActionInput}
                onChange={e => setFirstActionInput(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004097] focus:border-[#004097] min-h-[120px] text-gray-900 transition-all resize-none"
                placeholder="例：プログラミングについてYouTubeで1本動画を見てみる"
              />
            </div>

            <button
              onClick={handleFirstActionSubmit}
              disabled={!firstActionInput.trim()}
              className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg disabled:opacity-50"
            >
              決定して完了する
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 完了画面
  if (session.currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10 max-w-2xl w-full text-center">
          <div className="mb-8">
            <div className="w-20 h-20 bg-gradient-to-r from-[#004097] to-[#01654d] rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#004097]">
              お疲れさまでした
            </h1>
            <div className="w-20 h-1 bg-gradient-to-r from-[#004097] to-[#01654d] mx-auto mt-4 rounded-full"></div>
          </div>

          <div className="bg-slate-800 rounded-2xl p-6 text-white mb-8 text-left">
            <h3 className="font-bold mb-3 text-lg">今日のファーストアクション</h3>
            <p className="text-gray-200 whitespace-pre-wrap">{session.firstAction}</p>
          </div>

          <p className="text-gray-600 mb-6">
            この小さな一歩が、あなたの「やりたいこと」への第一歩です。<br />
            今日中に実行してみてください。
          </p>

          <p className="text-sm text-gray-500">
            ブラウザを閉じても大丈夫です。結果はDriveに保存されています。
          </p>
        </div>
      </div>
    );
  }

  // 質問画面（values, talents, passion）
  const currentQuestions = getQuestionsByStep(session.currentStep);
  const stepIndex = ['values', 'talents', 'passion'].indexOf(session.currentStep) + 1;
  const totalSteps = 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10">
          {/* プログレスバー */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-500 mb-3">
              <span className="font-medium">STEP {stepIndex} / {totalSteps}</span>
              <span>{stepTitles[session.currentStep]}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-2 bg-gradient-to-r from-[#004097] to-[#01654d] rounded-full transition-all duration-500"
                style={{ width: `${(stepIndex / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-bold text-[#004097] mb-3">
              {stepTitles[session.currentStep]}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {stepDescriptions[session.currentStep]}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-8">
            {currentQuestions.map((q, index) => (
              <div key={q.id} className="space-y-3">
                <label className="block text-gray-800 font-medium text-lg">
                  Q{index + 1}. {q.question}
                </label>
                {q.subQuestions && (
                  <ul className="text-sm text-gray-500 ml-4 space-y-1">
                    {q.subQuestions.map((sq, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#004097]">・</span>
                        {sq}
                      </li>
                    ))}
                  </ul>
                )}
                <textarea
                  value={currentAnswers[q.id] || ''}
                  onChange={e => handleAnswerChange(q.id, e.target.value)}
                  className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004097] focus:border-[#004097] min-h-[140px] text-gray-900 transition-all resize-none"
                  placeholder={q.placeholder}
                />
              </div>
            ))}
          </div>

          <div className="mt-10">
            {session.currentStep === 'passion' ? (
              <button
                onClick={async () => {
                  await handleStepSubmit();
                  await handleFinalAnalysis();
                }}
                className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg"
              >
                分析結果を見る
              </button>
            ) : (
              <button
                onClick={handleStepSubmit}
                className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg"
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
