'use client';

import { useState, useEffect } from 'react';
import { Step, Answer, SessionState, SupportPreference, PastRecord, DeepQuestion } from '@/types';
import { getQuestionsByStep, questions } from '@/lib/questions';

// 初回・「見つかっている」向けの固定質問
const FIXED_DEEP_QUESTIONS: DeepQuestion[] = [
  {
    id: 'd1',
    question: 'あなたの「やりたいこと」は何ですか？できるだけ具体的に教えてください。',
    placeholder: '例：ゲーム実況の動画を作って発信したい、イラストレーターになりたい など',
  },
  {
    id: 'd2',
    question: 'それについて、今どんなことをしていますか？どこまで進んでいますか？',
    placeholder: '例：週末に動画を撮って編集の練習をしている、まだ何もできていない など',
  },
  {
    id: 'd3',
    question: 'これからどうやって発展させていけそうですか？やってみたいことはありますか？',
    placeholder: '例：SNSに投稿して反応をもらいたい、コンテストに応募してみたい など',
  },
  {
    id: 'd4',
    question: 'それを将来の「生きる糧」（仕事や人生の軸）にするには、何が必要だと思いますか？',
    placeholder: '例：技術をもっと磨く、収入につなげる方法を知る、仲間を見つける など',
  },
];

// 過去記録をAIに渡す用のテキストにまとめる
const buildPastSummary = (records: PastRecord[]): string => {
  return records
    .map((r, i) => {
      const parts = [`■ 記録${i + 1}（${r.timestamp}）`];
      if (r.diagnosisType) parts.push(`診断タイプ: ${r.diagnosisType}`);
      if (r.status) parts.push(`ステータス: ${r.status}`);
      if (r.yaritaikoto) parts.push(`やりたいこと: ${r.yaritaikoto}`);
      if (r.values) parts.push(`価値観の分析: ${r.values.slice(0, 300)}`);
      if (r.talents) parts.push(`才能の分析: ${r.talents.slice(0, 300)}`);
      if (r.passion) parts.push(`情熱の分析: ${r.passion.slice(0, 300)}`);
      if (r.final) parts.push(`分析結果: ${r.final.slice(0, 500)}`);
      if (r.firstAction) parts.push(`前回決めたアクション: ${r.firstAction}`);
      if (r.qaLog) parts.push(`前回のQ&A: ${r.qaLog.slice(0, 500)}`);
      return parts.join('\n');
    })
    .join('\n\n');
};

// クラーク博士の考え中アニメーション
const ClarkThinking = () => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 2);
    }, 800); // 0.8秒ごとに切り替え
    return () => clearInterval(interval);
  }, []);

  return (
    <img
      src={frame === 0 ? '/images/clark-thinking-1.png' : '/images/clark-thinking-2.png'}
      alt="クラーク博士が考え中"
      className="w-48 h-auto"
    />
  );
};

// クラーク博士の喋りアニメーション（テキストと同期）
const ClarkTalking = ({ isAnimating }: { isAnimating: boolean }) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!isAnimating) {
      setFrame(0); // 口を閉じた状態
      return;
    }

    const interval = setInterval(() => {
      setFrame(f => (f + 1) % 2);
    }, 150); // 0.15秒ごとに口パク
    return () => clearInterval(interval);
  }, [isAnimating]);

  return (
    <img
      src={frame === 0 ? '/images/clark-talk-closed.png' : '/images/clark-talk-open.png'}
      alt="クラーク博士"
      className="w-32 h-auto flex-shrink-0"
    />
  );
};

// クラーク博士の喋りアニメーション付き分析表示
const AnalysisWithClark = ({ text, isDark = false }: { text: string; isDark?: boolean }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    setDisplayedText('');
    setIsAnimating(true);
    let index = 0;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 40); // 1文字40ms

    return () => clearInterval(interval);
  }, [text]);

  const lines = displayedText.split('\n');
  const textColor = isDark ? 'text-gray-200' : 'text-gray-700';
  const titleColor = isDark ? 'text-white' : 'text-[#004097]';

  return (
    <div className="flex gap-4 items-start">
      <ClarkTalking isAnimating={isAnimating} />
      <div className="flex-1 space-y-3">
        {lines.map((line, index) => {
          const trimmedLine = line.trim();
          if (!trimmedLine) return null;

          if (trimmedLine.startsWith('〜') && trimmedLine.endsWith('〜')) {
            return (
              <div key={index} className={`font-bold ${titleColor} text-base border-b ${isDark ? 'border-gray-600' : 'border-gray-200'} pb-2 mt-4 first:mt-0`}>
                {trimmedLine}
              </div>
            );
          }

          if (trimmedLine.startsWith('・')) {
            return (
              <div key={index} className={`${textColor} pl-4 flex items-start gap-2`}>
                <span className={isDark ? 'text-[#01654d]' : 'text-[#004097]'}>●</span>
                <span>{trimmedLine.substring(1).trim()}</span>
              </div>
            );
          }

          return (
            <p key={index} className={`${textColor} leading-relaxed`}>
              {trimmedLine}
            </p>
          );
        })}
        {isAnimating && <span className="animate-pulse text-[#004097]">|</span>}
      </div>
    </div>
  );
};

const stepTitles: Record<Step, string> = {
  intro: 'はじめに',
  branch: 'やりたいことについて',
  deepQuestions: 'やりたいことを深掘りする',
  deepResult: '深掘りの結果',
  values: 'STEP 1: 価値観を知る',
  talents: 'STEP 2: 才能を知る',
  passion: 'STEP 3: 情熱を知る',
  analysis: '分析中',
  result: '分析結果',
  firstAction: '今日のファーストアクション',
  confirm: '送信内容の確認',
  complete: '完了',
};

// 意思表示の選択肢
const supportPreferenceOptions: { value: SupportPreference; label: string; description: string }[] = [
  { value: 'want_guidance', label: '教わりたいことがある', description: '具体的に学びたいこと、相談したいことがある' },
  { value: 'need_direction', label: 'やりたいけど何をすればいいかわからない', description: '興味はあるけど、どう始めればいいか迷っている' },
  { value: 'already_decided', label: 'やりたいことがバッチリ決まっている', description: '自分で進められるので、見守ってほしい' },
  { value: 'leave_me_alone', label: '今は放っておいてほしい', description: '自分のペースで考えたい' },
];

const getSupportPreferenceLabel = (value: SupportPreference | undefined): string => {
  const option = supportPreferenceOptions.find(o => o.value === value);
  return option?.label || '';
};

const stepDescriptions: Record<Step, string> = {
  intro: '',
  branch: '',
  deepQuestions: '',
  deepResult: '',
  values: '価値観とは、自分が「どうありたいか」「どういう状態だと気持ちが良いか」という、行動の土台となるものです。',
  talents: '才能とは、自分にとっては当たり前で楽にできてしまうこと（天性の能力）です。後から身につけたスキルとは違います。',
  passion: '情熱とは、生産性や合理性を無視してでも惹きつけられる、個人的な興味関心です。',
  analysis: '',
  result: '',
  firstAction: '',
  confirm: '',
  complete: '',
};

// 分析結果を見やすく整形するコンポーネント
const FormattedAnalysis = ({ text, isDark = false }: { text: string; isDark?: boolean }) => {
  const lines = text.split('\n');
  const textColor = isDark ? 'text-gray-200' : 'text-gray-700';
  const titleColor = isDark ? 'text-white' : 'text-[#004097]';

  return (
    <div className="space-y-3">
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return null;

        // セクションタイトル（〜で始まり〜で終わる）
        if (trimmedLine.startsWith('〜') && trimmedLine.endsWith('〜')) {
          return (
            <div key={index} className={`font-bold ${titleColor} text-base border-b ${isDark ? 'border-gray-600' : 'border-gray-200'} pb-2 mt-4 first:mt-0`}>
              {trimmedLine}
            </div>
          );
        }

        // 箇条書き（・で始まる）
        if (trimmedLine.startsWith('・')) {
          return (
            <div key={index} className={`${textColor} pl-4 flex items-start gap-2`}>
              <span className={isDark ? 'text-[#01654d]' : 'text-[#004097]'}>●</span>
              <span>{trimmedLine.substring(1).trim()}</span>
            </div>
          );
        }

        // 通常のテキスト
        return (
          <p key={index} className={`${textColor} leading-relaxed`}>
            {trimmedLine}
          </p>
        );
      })}
    </div>
  );
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
  const [additionalInput, setAdditionalInput] = useState<Record<string, string>>({});
  const [showAdditionalInput, setShowAdditionalInput] = useState<string | null>(null);
  const [firstActionInput, setFirstActionInput] = useState('');
  const [supportPreference, setSupportPreference] = useState<SupportPreference | null>(null);
  const [deepAnswers, setDeepAnswers] = useState<Record<string, string>>({});
  const [yaritaikotoInput, setYaritaikotoInput] = useState('');
  const [isCheckingHistory, setIsCheckingHistory] = useState(false);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session.studentName.trim()) return;

    // シートから同じ名前の過去記録を検索
    setIsCheckingHistory(true);
    let records: PastRecord[] = [];
    try {
      const res = await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: session.studentName }),
      });
      if (res.ok) {
        const data = await res.json();
        records = data.records || [];
      }
    } catch (err) {
      console.error('History check failed:', err);
    }
    setIsCheckingHistory(false);

    setSession(prev => ({ ...prev, pastRecords: records, currentStep: 'branch' }));
  };

  // 「見つかっている / 見つかっていない」の選択
  const handleBranchChoice = async (found: boolean) => {
    const records = session.pastRecords || [];
    const isRepeat = records.length > 0;

    if (!isRepeat && !found) {
      // 初回＆見つかっていない → 従来のVTP診断
      setSession(prev => ({ ...prev, mode: 'vtp', foundChoice: 'not_found', currentStep: 'values' }));
      return;
    }

    if (!isRepeat && found) {
      // 初回＆見つかっている → 固定の深掘り質問
      setSession(prev => ({
        ...prev,
        mode: 'deep',
        foundChoice: 'found',
        deepQuestions: FIXED_DEEP_QUESTIONS,
        currentStep: 'deepQuestions',
      }));
      return;
    }

    // 2回目以降 → 前回の記録をもとにAIが質問を生成
    setIsLoading(true);
    setError(null);
    setSession(prev => ({
      ...prev,
      mode: 'deep',
      foundChoice: found ? 'found' : 'not_found',
      currentStep: 'analysis',
    }));

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'followup_questions',
          pastSummary: buildPastSummary(records),
          found,
        }),
      });
      if (!res.ok) throw new Error('質問の生成に失敗しました');
      const data = await res.json();
      const qs: DeepQuestion[] = (data.questions || []).map((q: string, i: number) => ({
        id: `f${i + 1}`,
        question: q,
      }));
      if (qs.length === 0) throw new Error('質問の生成に失敗しました');

      setSession(prev => ({ ...prev, deepQuestions: qs, currentStep: 'deepQuestions' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setSession(prev => ({ ...prev, currentStep: 'branch' }));
    } finally {
      setIsLoading(false);
    }
  };

  // 深掘り質問の回答を分析
  const handleDeepSubmit = async () => {
    const qs = session.deepQuestions || [];
    const qa = qs.map(q => ({
      questionId: q.id,
      question: q.question,
      answer: deepAnswers[q.id] || '',
    }));

    setIsLoading(true);
    setError(null);
    setSession(prev => ({ ...prev, currentStep: 'analysis' }));

    try {
      const isRepeat = (session.pastRecords || []).length > 0;
      const step = session.foundChoice === 'found' ? 'deepdive' : 'explore_deep';

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          answers: qa,
          pastSummary: isRepeat ? buildPastSummary(session.pastRecords || []) : undefined,
        }),
      });
      if (!res.ok) throw new Error('分析に失敗しました');
      const data = await res.json();

      // 「やりたいこと」の初期値：見つかっている場合は最初の質問の回答
      if (session.foundChoice === 'found' && !yaritaikotoInput) {
        setYaritaikotoInput(deepAnswers[qs[0]?.id] || '');
      }

      setSession(prev => ({ ...prev, deepAnalysis: data.analysis, currentStep: 'deepResult' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析中にエラーが発生しました');
      setSession(prev => ({ ...prev, currentStep: 'deepQuestions' }));
    } finally {
      setIsLoading(false);
    }
  };

  // 深掘りQ&Aをシート記録用テキストにする
  const buildQaLog = (): string => {
    const qs = session.deepQuestions || [];
    if (session.mode !== 'deep' || qs.length === 0) return '';
    return qs
      .map(q => `Q. ${q.question}\nA. ${deepAnswers[q.id] || '（未回答）'}`)
      .join('\n\n');
  };

  // 診断タイプのラベル
  const getDiagnosisType = (): string => {
    const isRepeat = (session.pastRecords || []).length > 0;
    if (session.mode === 'deep') {
      if (session.foundChoice === 'found') {
        return isRepeat ? '深掘り（2回目以降・見つかっている）' : '深掘り（初回・見つかっている）';
      }
      return 'やりたいこと探し（2回目以降・前回の続き）';
    }
    return 'やりたいこと探し（VTP診断・見つかっていない）';
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const analyzeStep = async (step: 'values' | 'talents' | 'passion' | 'final', answersToUse?: Answer[]) => {
    setIsLoading(true);
    setError(null);

    try {
      // 渡された回答を使用、なければsession.answersを使用
      const allAnswers = answersToUse || session.answers;

      // 質問と回答をペアにして渡す
      const answersForStep = step === 'final'
        ? allAnswers
        : allAnswers.filter(a => a.questionId.startsWith(step[0]));

      // 質問内容も含めたデータを作成
      const answersWithQuestions = answersForStep.map(a => {
        const q = questions.find(q => q.id === a.questionId);
        return {
          questionId: a.questionId,
          question: q?.question || '',
          answer: a.answer,
        };
      });

      console.log('Sending to API:', { step, answers: answersWithQuestions }); // デバッグ用

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          answers: answersWithQuestions,
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

    // 更新後の回答リストを作成
    const updatedAnswers = [...session.answers, ...newAnswers];

    // 先にセッションを更新
    setSession(prev => ({ ...prev, answers: updatedAnswers, currentStep: 'analysis' }));

    const stepKey = session.currentStep as 'values' | 'talents' | 'passion';

    // 更新後の回答を明示的に渡して分析
    const analysis = await analyzeStep(stepKey, updatedAnswers);

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
      setSession(prev => ({
        ...prev,
        stepAnalysis: { ...prev.stepAnalysis, final: finalAnalysis },
        currentStep: 'result',
      }));
    }

    setIsLoading(false);
  };

  const handleSendResult = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/send-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: session.studentName,
          answers: session.mode === 'deep' ? [] : session.answers.map(a => {
            const q = questions.find(q => q.id === a.questionId);
            return { questionId: a.questionId, question: q?.question || '', answer: a.answer };
          }),
          analysis: session.mode === 'deep'
            ? { final: session.deepAnalysis }
            : {
                values: session.stepAnalysis.values,
                talents: session.stepAnalysis.talents,
                passion: session.stepAnalysis.passion,
                final: session.stepAnalysis.final,
              },
          firstAction: firstActionInput,
          supportPreference: supportPreference,
          supportPreferenceLabel: getSupportPreferenceLabel(supportPreference || undefined),
          diagnosisType: getDiagnosisType(),
          yaritaikoto: yaritaikotoInput.trim(),
          status: yaritaikotoInput.trim() ? '決定済み' : '探索中',
          qaLog: buildQaLog(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSession(prev => ({
          ...prev,
          currentStep: 'complete',
          firstAction: firstActionInput,
          supportPreference: supportPreference || undefined,
        }));
      } else {
        throw new Error(data.error || '送信に失敗しました');
      }
    } catch (err) {
      console.error('Send result error:', err);
      setError(err instanceof Error ? err.message : '送信中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  // 追加入力で再分析
  const handleReanalyze = async (stepKey: 'values' | 'talents' | 'passion') => {
    const additionalText = additionalInput[stepKey];
    if (!additionalText?.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // 既存の回答を取得
      const existingAnswers = session.answers.filter(a => a.questionId.startsWith(stepKey[0]));

      // 追加入力を含めた回答を作成
      const answersWithQuestions = existingAnswers.map(a => {
        const q = questions.find(q => q.id === a.questionId);
        return {
          questionId: a.questionId,
          question: q?.question || '',
          answer: a.answer,
        };
      });

      // 追加情報を付加
      answersWithQuestions.push({
        questionId: `${stepKey[0]}_additional`,
        question: '追加で教えてくれたこと',
        answer: additionalText,
      });

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: stepKey,
          answers: answersWithQuestions,
          previousAnalysis: session.stepAnalysis,
        }),
      });

      if (!response.ok) throw new Error('再分析に失敗しました');

      const data = await response.json();

      // 分析結果を更新
      setSession(prev => ({
        ...prev,
        stepAnalysis: { ...prev.stepAnalysis, [stepKey]: data.analysis },
      }));

      // 追加入力をクリア
      setAdditionalInput(prev => ({ ...prev, [stepKey]: '' }));
      setShowAdditionalInput(null);

      // 最終分析も再実行
      const finalResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'final',
          answers: session.answers.map(a => {
            const q = questions.find(q => q.id === a.questionId);
            return { questionId: a.questionId, question: q?.question || '', answer: a.answer };
          }),
          previousAnalysis: {
            ...session.stepAnalysis,
            [stepKey]: data.analysis,
          },
        }),
      });

      if (finalResponse.ok) {
        const finalData = await finalResponse.json();
        setSession(prev => ({
          ...prev,
          stepAnalysis: { ...prev.stepAnalysis, final: finalData.analysis },
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '再分析中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

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
              disabled={isCheckingHistory}
              className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg disabled:opacity-50"
            >
              {isCheckingHistory ? '記録を確認中...' : 'はじめる'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 分岐画面（やりたいことが見つかっているか）
  if (session.currentStep === 'branch') {
    const records = session.pastRecords || [];
    const isRepeat = records.length > 0;
    const latest = records[0];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10 max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#004097]">
              {isRepeat ? `おかえりなさい、${session.studentName}さん` : `${session.studentName}さん、最初の質問です`}
            </h1>
            <div className="w-20 h-1 bg-gradient-to-r from-[#004097] to-[#01654d] mx-auto mt-4 rounded-full"></div>
          </div>

          {isRepeat && latest && (
            <div className="bg-[#004097]/5 border border-[#004097]/15 rounded-2xl p-5 mb-8">
              <p className="text-sm font-bold text-[#004097] mb-2">前回の記録（{latest.timestamp.split(' ')[0]}）</p>
              {latest.yaritaikoto ? (
                <p className="text-gray-700 text-sm">やりたいこと：<span className="font-medium">{latest.yaritaikoto}</span></p>
              ) : (
                <p className="text-gray-700 text-sm">前回はやりたいことを探しているところでした。</p>
              )}
              {latest.firstAction && (
                <p className="text-gray-600 text-sm mt-1">前回決めたアクション：{latest.firstAction}</p>
              )}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <p className="text-gray-700 text-lg font-medium mb-6 text-center">
            {isRepeat
              ? 'その後、「やりたいこと」は見つかりましたか？'
              : 'あなたには今、「やりたいこと」がありますか？'}
          </p>

          <div className="space-y-4">
            <button
              onClick={() => handleBranchChoice(true)}
              disabled={isLoading}
              className="w-full p-5 rounded-xl border-2 border-[#01654d] bg-[#01654d]/5 hover:bg-[#01654d]/10 transition-all text-left disabled:opacity-50"
            >
              <p className="font-bold text-[#01654d] text-lg">見つかっている！</p>
              <p className="text-sm text-gray-600 mt-1">
                {isRepeat
                  ? 'やりたいことが決まっている・見つかった → さらに深掘りして次の一歩を考えます'
                  : 'やりたいことがある → それを深掘りして、発展させる道筋を一緒に考えます'}
              </p>
            </button>
            <button
              onClick={() => handleBranchChoice(false)}
              disabled={isLoading}
              className="w-full p-5 rounded-xl border-2 border-[#004097] bg-[#004097]/5 hover:bg-[#004097]/10 transition-all text-left disabled:opacity-50"
            >
              <p className="font-bold text-[#004097] text-lg">まだ見つかっていない</p>
              <p className="text-sm text-gray-600 mt-1">
                {isRepeat
                  ? '前回の記録をもとに、やりたいことを決められるよう一緒に考えます'
                  : '価値観・才能・情熱の3つの視点から、やりたいことを一緒に見つけます'}
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 深掘り質問画面
  if (session.currentStep === 'deepQuestions') {
    const qs = session.deepQuestions || [];
    const allAnswered = qs.every(q => (deepAnswers[q.id] || '').trim());

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10">
            <div className="mb-8">
              <h2 className="text-xl font-bold text-[#004097] mb-3">
                {session.foundChoice === 'found' ? 'やりたいことを深掘りしよう' : 'やりたいことを見つけよう'}
              </h2>
              <p className="text-gray-600 leading-relaxed">
                {session.foundChoice === 'found'
                  ? 'あなたの「やりたいこと」について教えてください。現状を整理して、発展させる道筋を一緒に考えます。'
                  : '前回の記録をもとにした質問です。思いつくままに答えてみてください。'}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-8">
              {qs.map((q, index) => (
                <div key={q.id} className="space-y-3">
                  <label className="block text-gray-800 font-medium text-lg">
                    Q{index + 1}. {q.question}
                  </label>
                  <textarea
                    value={deepAnswers[q.id] || ''}
                    onChange={e => setDeepAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004097] focus:border-[#004097] min-h-[120px] text-gray-900 transition-all resize-none"
                    placeholder={q.placeholder || '思いつくままに書いてみてください'}
                  />
                </div>
              ))}
            </div>

            <div className="mt-10">
              <button
                onClick={handleDeepSubmit}
                disabled={!allAnswered || isLoading}
                className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg disabled:opacity-50"
              >
                クラーク博士に相談する
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 深掘り結果画面
  if (session.currentStep === 'deepResult') {
    const qs = session.deepQuestions || [];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[#004097]">
                {session.studentName}さんの深掘り結果
              </h1>
              <div className="w-20 h-1 bg-gradient-to-r from-[#004097] to-[#01654d] mx-auto mt-4 rounded-full"></div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            {/* あなたの回答 */}
            <div className="bg-white rounded-lg p-4 mb-6 border border-[#004097]/20">
              <p className="text-xs text-gray-500 mb-2 font-medium">あなたの回答：</p>
              <div className="space-y-2">
                {qs.map((q, i) => (
                  <div key={q.id} className="text-sm">
                    <p className="text-gray-500 text-xs">Q{i + 1}. {q.question}</p>
                    <p className="text-gray-800 bg-gray-50 p-2 rounded mt-1">{deepAnswers[q.id] || '（未回答）'}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-2 font-medium">クラーク博士の分析：</p>
            <div className="bg-[#004097]/5 rounded-2xl p-6 border border-[#004097]/10 mb-8">
              <AnalysisWithClark text={session.deepAnalysis || ''} />
            </div>

            <button
              onClick={() => setSession(prev => ({ ...prev, currentStep: 'firstAction' }))}
              className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg"
            >
              次へ進む
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 分析中画面
  if (session.currentStep === 'analysis' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <ClarkThinking />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">クラーク博士が分析中...</h2>
          <p className="text-gray-600">あなたの回答を読み解いています</p>
        </div>
      </div>
    );
  }

  // 結果画面
  if (session.currentStep === 'result') {
    const analysisText = session.stepAnalysis.final || '';
    const mainAnalysis = analysisText.split('===画像プロンプト===')[0].replace('===分析===', '').trim();

    // 各ステップの回答を取得するヘルパー関数
    const getAnswersForStep = (stepPrefix: string) => {
      return session.answers
        .filter(a => a.questionId.startsWith(stepPrefix))
        .map(a => {
          const q = questions.find(q => q.id === a.questionId);
          return { question: q?.question || '', answer: a.answer };
        });
    };

    const valuesAnswers = getAnswersForStep('v');
    const talentsAnswers = getAnswersForStep('t');
    const passionAnswers = getAnswersForStep('p');

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
              {/* 価値観 */}
              <div className="bg-[#004097]/5 rounded-2xl p-6 border border-[#004097]/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#004097] text-lg flex items-center gap-2">
                    <span className="w-10 h-10 bg-[#004097] text-white rounded-full flex items-center justify-center text-base font-bold">V</span>
                    <span>価値観</span>
                  </h3>
                  <button
                    onClick={() => setShowAdditionalInput(showAdditionalInput === 'values' ? null : 'values')}
                    className="text-sm text-[#004097] hover:underline"
                  >
                    {showAdditionalInput === 'values' ? '閉じる' : '情報を追加する'}
                  </button>
                </div>

                {/* あなたの回答 */}
                <div className="bg-white rounded-lg p-4 mb-4 border border-[#004097]/20">
                  <p className="text-xs text-gray-500 mb-2 font-medium">あなたの回答：</p>
                  {valuesAnswers.length > 0 ? (
                    <div className="space-y-2">
                      {valuesAnswers.map((a, i) => (
                        <div key={i} className="text-sm">
                          <p className="text-gray-500 text-xs">Q{i + 1}. {a.question}</p>
                          <p className="text-gray-800 bg-gray-50 p-2 rounded mt-1">{a.answer || '（未回答）'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">回答データがありません</p>
                  )}
                </div>

                <p className="text-xs text-gray-500 mb-2 font-medium">クラーク博士の分析：</p>
                <AnalysisWithClark text={session.stepAnalysis.values || ''} />
                {showAdditionalInput === 'values' && (
                  <div className="mt-4 pt-4 border-t border-[#004097]/20">
                    <p className="text-sm text-gray-600 mb-2">もっと詳しく教えてください（例：どんな時に自由を感じる？誰と一緒にいたい？）</p>
                    <textarea
                      value={additionalInput.values || ''}
                      onChange={e => setAdditionalInput(prev => ({ ...prev, values: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm"
                      placeholder="例：一人で好きなことに没頭している時が一番心地いい"
                      rows={3}
                    />
                    <button
                      onClick={() => handleReanalyze('values')}
                      disabled={!additionalInput.values?.trim() || isLoading}
                      className="mt-2 px-4 py-2 bg-[#004097] text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      再分析する
                    </button>
                  </div>
                )}
              </div>

              {/* 才能 */}
              <div className="bg-[#01654d]/5 rounded-2xl p-6 border border-[#01654d]/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#01654d] text-lg flex items-center gap-2">
                    <span className="w-10 h-10 bg-[#01654d] text-white rounded-full flex items-center justify-center text-base font-bold">T</span>
                    <span>才能</span>
                  </h3>
                  <button
                    onClick={() => setShowAdditionalInput(showAdditionalInput === 'talents' ? null : 'talents')}
                    className="text-sm text-[#01654d] hover:underline"
                  >
                    {showAdditionalInput === 'talents' ? '閉じる' : '情報を追加する'}
                  </button>
                </div>

                {/* あなたの回答 */}
                <div className="bg-white rounded-lg p-4 mb-4 border border-[#01654d]/20">
                  <p className="text-xs text-gray-500 mb-2 font-medium">あなたの回答：</p>
                  {talentsAnswers.length > 0 ? (
                    <div className="space-y-2">
                      {talentsAnswers.map((a, i) => (
                        <div key={i} className="text-sm">
                          <p className="text-gray-500 text-xs">Q{i + 1}. {a.question}</p>
                          <p className="text-gray-800 bg-gray-50 p-2 rounded mt-1">{a.answer || '（未回答）'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">回答データがありません</p>
                  )}
                </div>

                <p className="text-xs text-gray-500 mb-2 font-medium">クラーク博士の分析：</p>
                <AnalysisWithClark text={session.stepAnalysis.talents || ''} />
                {showAdditionalInput === 'talents' && (
                  <div className="mt-4 pt-4 border-t border-[#01654d]/20">
                    <p className="text-sm text-gray-600 mb-2">もっと詳しく教えてください（例：夢中になった経験、周りから褒められること）</p>
                    <textarea
                      value={additionalInput.talents || ''}
                      onChange={e => setAdditionalInput(prev => ({ ...prev, talents: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm"
                      placeholder="例：友達の相談に乗るのが得意とよく言われる"
                      rows={3}
                    />
                    <button
                      onClick={() => handleReanalyze('talents')}
                      disabled={!additionalInput.talents?.trim() || isLoading}
                      className="mt-2 px-4 py-2 bg-[#01654d] text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      再分析する
                    </button>
                  </div>
                )}
              </div>

              {/* 情熱 */}
              <div className="bg-gradient-to-r from-[#004097]/5 to-[#01654d]/5 rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <span className="w-10 h-10 bg-gradient-to-r from-[#004097] to-[#01654d] text-white rounded-full flex items-center justify-center text-base font-bold">P</span>
                    <span>情熱</span>
                  </h3>
                  <button
                    onClick={() => setShowAdditionalInput(showAdditionalInput === 'passion' ? null : 'passion')}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    {showAdditionalInput === 'passion' ? '閉じる' : '情報を追加する'}
                  </button>
                </div>

                {/* あなたの回答 */}
                <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2 font-medium">あなたの回答：</p>
                  {passionAnswers.length > 0 ? (
                    <div className="space-y-2">
                      {passionAnswers.map((a, i) => (
                        <div key={i} className="text-sm">
                          <p className="text-gray-500 text-xs">Q{i + 1}. {a.question}</p>
                          <p className="text-gray-800 bg-gray-50 p-2 rounded mt-1">{a.answer || '（未回答）'}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">回答データがありません</p>
                  )}
                </div>

                <p className="text-xs text-gray-500 mb-2 font-medium">クラーク博士の分析：</p>
                <AnalysisWithClark text={session.stepAnalysis.passion || ''} />
                {showAdditionalInput === 'passion' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">もっと詳しく教えてください（例：好きなこと、時間を忘れて没頭すること）</p>
                    <textarea
                      value={additionalInput.passion || ''}
                      onChange={e => setAdditionalInput(prev => ({ ...prev, passion: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm"
                      placeholder="例：ゲームの攻略法を考えるのが好き、動画編集にハマっている"
                      rows={3}
                    />
                    <button
                      onClick={() => handleReanalyze('passion')}
                      disabled={!additionalInput.passion?.trim() || isLoading}
                      className="mt-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      再分析する
                    </button>
                  </div>
                )}
              </div>

              {/* やりたいこと */}
              <div className="bg-slate-800 rounded-2xl p-6 text-white">
                <h3 className="font-bold mb-4 text-lg flex items-center gap-2">
                  <span className="w-10 h-10 bg-gradient-to-r from-yellow-400 to-orange-500 text-slate-800 rounded-full flex items-center justify-center text-base font-bold">!</span>
                  <span>やりたいこと（V × T × P）</span>
                </h3>
                <AnalysisWithClark text={mainAnalysis} isDark={true} />
              </div>
            </div>

            <button
              onClick={() => setSession(prev => ({ ...prev, currentStep: 'firstAction' }))}
              className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg"
            >
              次へ進む
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ファーストアクション＆意思表示入力画面
  if (session.currentStep === 'firstAction') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[#004097]">
                最後の質問
              </h1>
              <div className="w-20 h-1 bg-gradient-to-r from-[#004097] to-[#01654d] mx-auto mt-4 rounded-full"></div>
            </div>

            {/* やりたいこと（ブラッシュアップ） */}
            <div className="mb-10">
              <h2 className="text-lg font-bold text-gray-800 mb-2">
                今の時点での「やりたいこと」
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {session.foundChoice === 'found'
                  ? '分析を踏まえて、自分の言葉で書き直して（ブラッシュアップして）OKです。'
                  : '今日の結果を見て「これかも」と思えるものがあれば書いてください。まだ無くても大丈夫です。'}
              </p>
              <textarea
                value={yaritaikotoInput}
                onChange={e => setYaritaikotoInput(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#01654d] focus:border-[#01654d] min-h-[80px] text-gray-900 transition-all resize-none"
                placeholder={session.foundChoice === 'found' ? '例：ゲーム実況動画を作って発信する' : '（まだ決まっていなければ空欄でOK）'}
              />
            </div>

            {/* ファーストアクション */}
            <div className="mb-10">
              <h2 className="text-lg font-bold text-gray-800 mb-2">
                今日のファーストアクション
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                大きなことでなくてOK。「調べてみる」「誰かに話してみる」「5分だけやってみる」など、<br />
                今日中にできる具体的なアクションを書いてください。
              </p>
              <textarea
                value={firstActionInput}
                onChange={e => setFirstActionInput(e.target.value)}
                className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#004097] focus:border-[#004097] min-h-[100px] text-gray-900 transition-all resize-none"
                placeholder="例：プログラミングについてYouTubeで1本動画を見てみる"
              />
            </div>

            {/* 意思表示 */}
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-2">
                今後の関わり方について
              </h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  どれを選んでも成績には一切影響しません。
                </p>
                <p className="text-sm text-gray-600">
                  正直なところ、どのような関わりが良いのか先生もわからないことが多いです。<br />
                  あなたの素直な気持ちを教えてください。
                </p>
              </div>
              <div className="space-y-3">
                {supportPreferenceOptions.map(option => (
                  <label
                    key={option.value}
                    className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      supportPreference === option.value
                        ? 'border-[#004097] bg-[#004097]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="supportPreference"
                        value={option.value}
                        checked={supportPreference === option.value}
                        onChange={() => setSupportPreference(option.value)}
                        className="mt-1 w-4 h-4 text-[#004097] focus:ring-[#004097]"
                      />
                      <div>
                        <p className="font-medium text-gray-800">{option.label}</p>
                        <p className="text-sm text-gray-500">{option.description}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSession(prev => ({ ...prev, currentStep: 'confirm' }))}
              disabled={!firstActionInput.trim() || !supportPreference}
              className="w-full bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg disabled:opacity-50"
            >
              確認画面へ進む
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 送信前確認画面
  if (session.currentStep === 'confirm') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#004097] to-[#01654d] py-10 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-2xl p-10">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-[#004097]">
                送信内容の確認
              </h1>
              <div className="w-20 h-1 bg-gradient-to-r from-[#004097] to-[#01654d] mx-auto mt-4 rounded-full"></div>
            </div>

            <p className="text-gray-600 mb-6 text-center">
              以下の内容を先生にメールで送信します。<br />
              内容を確認してください。
            </p>

            <div className="space-y-6 mb-8">
              {/* やりたいこと */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-2">今の時点での「やりたいこと」</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{yaritaikotoInput.trim() || '（まだ探索中）'}</p>
              </div>

              {/* ファーストアクション */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-2">今日のファーストアクション</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{firstActionInput}</p>
              </div>

              {/* 意思表示 */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-2">今後の関わり方</h3>
                <p className="text-gray-700">{getSupportPreferenceLabel(supportPreference || undefined)}</p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                <p className="text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => setSession(prev => ({ ...prev, currentStep: 'firstAction' }))}
                className="flex-1 bg-gray-200 text-gray-700 py-4 px-6 rounded-xl hover:bg-gray-300 transition-all font-medium text-lg"
              >
                戻って修正
              </button>
              <button
                onClick={handleSendResult}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-[#004097] to-[#01654d] text-white py-4 px-6 rounded-xl hover:opacity-90 transition-all font-medium text-lg shadow-lg disabled:opacity-50"
              >
                {isLoading ? '送信中...' : '送信する'}
              </button>
            </div>
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

          <div className="bg-[#01654d]/10 border-l-4 border-[#01654d] p-4 mb-8 rounded-r-lg text-left">
            <p className="text-[#01654d]">
              結果は先生にメールで送信されました。
            </p>
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
            ブラウザを閉じても大丈夫です。
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
