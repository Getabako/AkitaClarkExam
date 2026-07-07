// 質問ステップの定義
export type Step = 'intro' | 'branch' | 'deepQuestions' | 'deepResult' | 'values' | 'talents' | 'passion' | 'analysis' | 'result' | 'firstAction' | 'confirm' | 'complete';

// 診断モード
export type DiagnosisMode = 'vtp' | 'deep';

// 過去の記録（シートから取得）
export interface PastRecord {
  timestamp: string;
  name: string;
  values: string;
  talents: string;
  passion: string;
  final: string;
  firstAction: string;
  supportPreferenceLabel: string;
  diagnosisType: string;
  yaritaikoto: string;
  status: string;
  qaLog: string;
}

// 深掘り用の質問
export interface DeepQuestion {
  id: string;
  question: string;
  placeholder?: string;
}

// 意思表示の選択肢
export type SupportPreference =
  | 'want_guidance'      // 教わりたいことがある
  | 'need_direction'     // やりたいけど何をすればいいかわからない
  | 'already_decided'    // やりたいことがバッチリ決まっている
  | 'leave_me_alone';    // 何もやりたくないし放っておいてほしい

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
  firstAction?: string;
  supportPreference?: SupportPreference;
  // 分岐・深掘り関連
  mode?: DiagnosisMode;
  foundChoice?: 'found' | 'not_found';
  pastRecords?: PastRecord[];
  deepQuestions?: DeepQuestion[];
  deepAnalysis?: string;
  yaritaikoto?: string;
}
