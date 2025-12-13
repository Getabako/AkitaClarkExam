// 質問ステップの定義
export type Step = 'intro' | 'values' | 'talents' | 'passion' | 'analysis' | 'result' | 'choice';

// 各ステップの質問
export interface Question {
  id: string;
  step: Step;
  question: string;
  placeholder?: string;
  subQuestions?: string[];
}

// ユーザーの回答
export interface Answer {
  questionId: string;
  answer: string;
}

// 分析結果
export interface AnalysisResult {
  // ステップ1: 価値観
  values: {
    coreValues: string[];
    ranking: string[];
    workPurpose: string;
  };
  // ステップ2: 才能
  talents: {
    naturalAbilities: string[];
    hiddenTalents: string[];
    coreStrengths: string[];
  };
  // ステップ3: 情熱
  passion: {
    truePassions: string[];
    interests: string[];
    direction: string;
  };
  // ステップ4: やりたいこと
  finalResult: {
    ideas: string[];
    recommendation: string;
    actionPlan: string[];
    imagePrompt: string;
  };
}

// セッション状態
export interface SessionState {
  studentName: string;
  currentStep: Step;
  answers: Answer[];
  stepAnalysis: {
    values?: string;
    talents?: string;
    passion?: string;
    final?: string;
  };
  finalAnalysis?: AnalysisResult;
  generatedImage?: string;
  wantsSupport?: boolean;
}
