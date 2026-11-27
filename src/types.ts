import { Timestamp } from 'firebase/firestore';

export const ADMIN_EMAIL = 'codyjo@geminiedu.site';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const URL_REGEX = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:[0-9]{1,5})?(\/.*)?$/;
export const STUDENT_ID_REGEX = /^([1-9]|[12][0-9]|30)$/;

export const FIELD_LIMITS = {
  studentNameMin: 1,
  studentNameMax: 40,
  projectTitleMin: 1,
  projectTitleMax: 80,
  homepageUrlMin: 8,
  homepageUrlMax: 300,
  descriptionMax: 240,
  judgeDisplayNameMin: 1,
  judgeDisplayNameMax: 40,
  judgeAffiliationMax: 60,
  judgeSpecialtyMax: 40,
  commentMax: 500,
  maxRubricScore: 25,
  totalStudents: 30,
} as const;

export const RUBRIC_CRITERIA = [
  {
    key: 'designScore',
    label: '디자인 및 UI/UX',
    shortLabel: '디자인',
    description: '시각적 완성도, 레이아웃 균형, 가독성 및 사용자 경험',
    max: 25,
  },
  {
    key: 'creativityScore',
    label: '창의성 및 기획력',
    shortLabel: '창의성',
    description: '주제 해석의 독창성, 아이디어 차별성 및 스토리텔링',
    max: 25,
  },
  {
    key: 'functionalityScore',
    label: '기능 구현 및 반응형',
    shortLabel: '기능구현',
    description: '인터랙션 동작, 링크 무결성, 모바일·데스크톱 대응',
    max: 25,
  },
  {
    key: 'contentScore',
    label: '콘텐츠 및 웹 접근성',
    shortLabel: '콘텐츠',
    description: '정보 구성의 충실도, 시맨틱 구조 및 접근성 배려',
    max: 25,
  },
] as const;

export type RubricKey = (typeof RUBRIC_CRITERIA)[number]['key'];

export interface StudentSubmission {
  id: string; // '1' .. '30'
  studentNumber: number; // 1 .. 30
  studentName: string;
  projectTitle: string;
  homepageUrl: string;
  description: string;
  submittedByUid: string;
  submittedByName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface JudgeProfile {
  id: string; // uid
  uid: string;
  displayName: string;
  affiliation: string;
  specialty: string;
  status: 'active';
  registeredAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface EvaluationRecord {
  id: string; // `${judgeUid}_${studentId}`
  studentId: string;
  studentNumber: number;
  judgeUid: string;
  judgeName: string;
  designScore: number;
  creativityScore: number;
  functionalityScore: number;
  contentScore: number;
  totalScore: number;
  comment: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface StudentAggregate {
  studentNumber: number;
  studentId: string;
  submission: StudentSubmission | null;
  evaluations: EvaluationRecord[];
  evaluationCount: number;
  avgDesign: number;
  avgCreativity: number;
  avgFunctionality: number;
  avgContent: number;
  avgTotal: number;
  rank: number | null; // 1-based rank among evaluated students (ties share rank)
}

export interface ScoreBucket {
  label: string;
  range: string;
  count: number;
}

export interface CompetitionStats {
  totalSlots: number;
  submittedCount: number;
  submissionRate: number;
  evaluatedStudentCount: number;
  evaluationProgressRate: number;
  totalEvaluationsCount: number;
  activeJudgesCount: number;
  overallAverageScore: number;
  highestScore: number;
  lowestScore: number;
  criterionAverages: {
    key: RubricKey;
    label: string;
    shortLabel: string;
    average: number;
    max: number;
  }[];
  scoreBuckets: ScoreBucket[];
}

export function formatStudentNumber(num: number): string {
  return num.toString().padStart(2, '0');
}

export function computeCompetitionData(
  submissions: StudentSubmission[],
  judges: JudgeProfile[],
  evaluations: EvaluationRecord[]
): {
  slots: StudentAggregate[];
  rankedEvaluated: StudentAggregate[];
  topThree: StudentAggregate[];
  stats: CompetitionStats;
} {
  const submissionMap = new Map<number, StudentSubmission>();
  for (const s of submissions) {
    submissionMap.set(s.studentNumber, s);
  }

  const evalsByStudent = new Map<number, EvaluationRecord[]>();
  for (const ev of evaluations) {
    const list = evalsByStudent.get(ev.studentNumber) ?? [];
    list.push(ev);
    evalsByStudent.set(ev.studentNumber, list);
  }

  const slots: StudentAggregate[] = [];
  for (let num = 1; num <= FIELD_LIMITS.totalStudents; num++) {
    const submission = submissionMap.get(num) ?? null;
    const studentEvals = evalsByStudent.get(num) ?? [];
    const count = studentEvals.length;

    const avgDesign = count > 0 ? studentEvals.reduce((sum, e) => sum + e.designScore, 0) / count : 0;
    const avgCreativity = count > 0 ? studentEvals.reduce((sum, e) => sum + e.creativityScore, 0) / count : 0;
    const avgFunctionality = count > 0 ? studentEvals.reduce((sum, e) => sum + e.functionalityScore, 0) / count : 0;
    const avgContent = count > 0 ? studentEvals.reduce((sum, e) => sum + e.contentScore, 0) / count : 0;
    const avgTotal = count > 0 ? studentEvals.reduce((sum, e) => sum + e.totalScore, 0) / count : 0;

    slots.push({
      studentNumber: num,
      studentId: String(num),
      submission,
      evaluations: studentEvals,
      evaluationCount: count,
      avgDesign,
      avgCreativity,
      avgFunctionality,
      avgContent,
      avgTotal,
      rank: null,
    });
  }

  // Sort evaluated students by average total descending, then evaluation count desc, then studentNumber asc
  const evaluated = slots
    .filter((s) => s.submission !== null && s.evaluationCount > 0)
    .sort((a, b) => {
      if (Math.abs(b.avgTotal - a.avgTotal) > 0.0001) {
        return b.avgTotal - a.avgTotal;
      }
      if (b.evaluationCount !== a.evaluationCount) {
        return b.evaluationCount - a.evaluationCount;
      }
      return a.studentNumber - b.studentNumber;
    });

  // Assign competition ranks (standard competition ranking 1, 1, 3 or sequential for ties rounded to 2 decimals)
  let currentRank = 1;
  for (let i = 0; i < evaluated.length; i++) {
    if (i > 0 && Math.abs(evaluated[i].avgTotal - evaluated[i - 1].avgTotal) > 0.0001) {
      currentRank = i + 1;
    }
    evaluated[i].rank = currentRank;
  }

  const topThree = evaluated.slice(0, 3);

  const submittedCount = submissions.length;
  const evaluatedStudentCount = evaluated.length;
  const overallAverageScore =
    evaluatedStudentCount > 0
      ? evaluated.reduce((sum, s) => sum + s.avgTotal, 0) / evaluatedStudentCount
      : 0;

  const highestScore = evaluatedStudentCount > 0 ? evaluated[0].avgTotal : 0;
  const lowestScore = evaluatedStudentCount > 0 ? evaluated[evaluatedStudentCount - 1].avgTotal : 0;

  const criterionAverages = RUBRIC_CRITERIA.map((c) => {
    const avg =
      evaluatedStudentCount > 0
        ? evaluated.reduce((sum, s) => {
            if (c.key === 'designScore') return sum + s.avgDesign;
            if (c.key === 'creativityScore') return sum + s.avgCreativity;
            if (c.key === 'functionalityScore') return sum + s.avgFunctionality;
            return sum + s.avgContent;
          }, 0) / evaluatedStudentCount
        : 0;
    return {
      key: c.key,
      label: c.label,
      shortLabel: c.shortLabel,
      average: avg,
      max: c.max,
    };
  });

  const scoreBuckets: ScoreBucket[] = [
    { label: '90점 이상', range: '90–100', count: 0 },
    { label: '80점대', range: '80–89', count: 0 },
    { label: '70점대', range: '70–79', count: 0 },
    { label: '60점대', range: '60–69', count: 0 },
    { label: '60점 미만', range: '0–59', count: 0 },
  ];

  for (const s of evaluated) {
    if (s.avgTotal >= 90) scoreBuckets[0].count += 1;
    else if (s.avgTotal >= 80) scoreBuckets[1].count += 1;
    else if (s.avgTotal >= 70) scoreBuckets[2].count += 1;
    else if (s.avgTotal >= 60) scoreBuckets[3].count += 1;
    else scoreBuckets[4].count += 1;
  }

  return {
    slots,
    rankedEvaluated: evaluated,
    topThree,
    stats: {
      totalSlots: FIELD_LIMITS.totalStudents,
      submittedCount,
      submissionRate: (submittedCount / FIELD_LIMITS.totalStudents) * 100,
      evaluatedStudentCount,
      evaluationProgressRate: submittedCount > 0 ? (evaluatedStudentCount / submittedCount) * 100 : 0,
      totalEvaluationsCount: evaluations.length,
      activeJudgesCount: judges.length,
      overallAverageScore,
      highestScore,
      lowestScore,
      criterionAverages,
      scoreBuckets,
    },
  };
}
