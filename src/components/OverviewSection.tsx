import React, { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  Download,
  ExternalLink,
  Search,
  Trophy,
  Users,
} from 'lucide-react';
import {
  CompetitionStats,
  formatStudentNumber,
  StudentAggregate,
} from '../types';

interface OverviewSectionProps {
  slots: StudentAggregate[];
  rankedEvaluated: StudentAggregate[];
  topThree: StudentAggregate[];
  stats: CompetitionStats;
  onGoToJudge: (studentNumber: number) => void;
  onOpenSubmitModal: (studentNumber: number) => void;
}

const PODIUM_STYLES: Record<
  number,
  {
    rankLabel: string;
    awardLabel: string;
    headerBg: string;
    rankText: string;
    border: string;
  }
> = {
  1: {
    rankLabel: '1등',
    awardLabel: '최우수상 후보',
    headerBg: 'bg-amber-50',
    rankText: 'text-amber-700',
    border: 'border-amber-300',
  },
  2: {
    rankLabel: '2등',
    awardLabel: '우수상 후보',
    headerBg: 'bg-slate-100',
    rankText: 'text-slate-700',
    border: 'border-slate-300',
  },
  3: {
    rankLabel: '3등',
    awardLabel: '장려상 후보',
    headerBg: 'bg-orange-50',
    rankText: 'text-orange-800',
    border: 'border-orange-200',
  },
};

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  slots,
  rankedEvaluated,
  topThree,
  stats,
  onGoToJudge,
  onOpenSubmitModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tableFilter, setTableFilter] = useState<'evaluated' | 'submitted' | 'all'>('evaluated');

  const filteredTableRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list: StudentAggregate[];
    if (tableFilter === 'evaluated') {
      list = rankedEvaluated;
    } else if (tableFilter === 'submitted') {
      const submittedOnly = slots.filter((s) => s.submission !== null);
      list = submittedOnly.sort((a, b) => {
        if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
        if (a.rank !== null) return -1;
        if (b.rank !== null) return 1;
        return a.studentNumber - b.studentNumber;
      });
    } else {
      list = slots;
    }

    if (!q) return list;
    return list.filter((s) => {
      const numStr = `${s.studentNumber}번 ${formatStudentNumber(s.studentNumber)}`;
      const name = s.submission?.studentName.toLowerCase() ?? '';
      const title = s.submission?.projectTitle.toLowerCase() ?? '';
      const url = s.submission?.homepageUrl.toLowerCase() ?? '';
      return (
        numStr.includes(q) ||
        name.includes(q) ||
        title.includes(q) ||
        url.includes(q)
      );
    });
  }, [slots, rankedEvaluated, tableFilter, searchQuery]);

  const maxBucketCount = Math.max(
    1,
    ...stats.scoreBuckets.map((b) => b.count)
  );

  const handleDownloadCsv = () => {
    const headers = [
      '순위',
      '번호',
      '학생이름',
      '홈페이지제목',
      '홈페이지URL',
      '디자인(25)',
      '창의성(25)',
      '기능구현(25)',
      '콘텐츠(25)',
      '평균총점(100)',
      '심사참여수',
    ];
    const rows = slots.map((s) => [
      s.rank !== null ? String(s.rank) : '-',
      `${formatStudentNumber(s.studentNumber)}번`,
      s.submission?.studentName ?? '미제출',
      s.submission?.projectTitle ?? '-',
      s.submission?.homepageUrl ?? '-',
      s.evaluationCount > 0 ? s.avgDesign.toFixed(1) : '-',
      s.evaluationCount > 0 ? s.avgCreativity.toFixed(1) : '-',
      s.evaluationCount > 0 ? s.avgFunctionality.toFixed(1) : '-',
      s.evaluationCount > 0 ? s.avgContent.toFixed(1) : '-',
      s.evaluationCount > 0 ? s.avgTotal.toFixed(1) : '-',
      String(s.evaluationCount),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `homepage-contest-results.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            경진대회 종합 순위 및 통계
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            1~30번 학생들의 홈페이지 제출 현황과 심사위원 점수를 실시간으로 집계합니다.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onOpenSubmitModal(1)}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            홈페이지 URL 등록
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>결과 CSV 내보내기</span>
          </button>
        </div>
      </div>

      {/* Top 3 Winners Podium */}
      <section aria-labelledby="podium-heading">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-600" />
            <h2 id="podium-heading" className="text-lg font-semibold text-slate-900">
              현재 1·2·3등 수상 순위
            </h2>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            평가 완료 {stats.evaluatedStudentCount}명 기준 실시간 반영
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((position) => {
            const candidate = topThree[position - 1];
            const style = PODIUM_STYLES[position];

            if (!candidate || !candidate.submission) {
              return (
                <div
                  key={position}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between min-h-[210px]"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
                      <span className="font-semibold text-slate-700">{position}등</span>
                      <span>{style.awardLabel}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-500 mt-4">
                      아직 {position}등 집계를 위한 평가 데이터가 없습니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onGoToJudge(1)}
                    className="mt-4 self-start text-xs font-medium text-blue-600 hover:underline"
                  >
                    심사평가 시작하기
                  </button>
                </div>
              );
            }

            const sub = candidate.submission;
            const displayRank = candidate.rank ?? position;

            return (
              <div
                key={position}
                className={`bg-white border ${style.border} rounded-xl overflow-hidden flex flex-col justify-between`}
              >
                <div className={`${style.headerBg} px-5 py-3 border-b ${style.border} flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <Award className={`w-4 h-4 ${style.rankText}`} />
                    <span className={`text-sm font-bold tabular-nums ${style.rankText}`}>
                      {displayRank}등
                    </span>
                    <span className="text-xs text-slate-600">
                      · {PODIUM_STYLES[Math.min(displayRank, 3)]?.awardLabel ?? '상위권'}
                    </span>
                  </div>
                  <span className="font-mono-nums text-xs font-semibold text-slate-700">
                    {formatStudentNumber(candidate.studentNumber)}번
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {sub.studentName}
                      </h3>
                      <div className="text-right shrink-0">
                        <span className="font-mono-nums text-2xl font-bold text-slate-900">
                          {candidate.avgTotal.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-500 ml-0.5">/ 100</span>
                      </div>
                    </div>

                    <p className="text-sm font-medium text-slate-700 mt-1 truncate">
                      {sub.projectTitle}
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <span>심사위원 {candidate.evaluationCount}명 참여</span>
                      <span aria-hidden="true">·</span>
                      <a
                        href={sub.homepageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline truncate"
                      >
                        <span className="truncate max-w-[170px]">{sub.homepageUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>

                  {/* Mini criterion breakdown */}
                  <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-4 gap-2 text-center">
                    <div>
                      <div className="text-[11px] text-slate-500">디자인</div>
                      <div className="font-mono-nums text-xs font-semibold text-slate-800 mt-0.5">
                        {candidate.avgDesign.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">창의성</div>
                      <div className="font-mono-nums text-xs font-semibold text-slate-800 mt-0.5">
                        {candidate.avgCreativity.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">기능</div>
                      <div className="font-mono-nums text-xs font-semibold text-slate-800 mt-0.5">
                        {candidate.avgFunctionality.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">콘텐츠</div>
                      <div className="font-mono-nums text-xs font-semibold text-slate-800 mt-0.5">
                        {candidate.avgContent.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4-Column KPI Strip */}
      <section aria-label="대회 핵심 통계" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">홈페이지 URL 제출</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-nums text-2xl font-bold text-slate-900">
              {stats.submittedCount}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              / {stats.totalSlots}명 ({stats.submissionRate.toFixed(0)}%)
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${Math.min(100, stats.submissionRate)}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">심사 완료 학생</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-nums text-2xl font-bold text-slate-900">
              {stats.evaluatedStudentCount}
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              / 제출 {stats.submittedCount}명 ({stats.evaluationProgressRate.toFixed(0)}%)
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${Math.min(100, stats.evaluationProgressRate)}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">등록 심사위원 · 누적 평가</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-nums text-2xl font-bold text-slate-900">
              {stats.activeJudgesCount}명
            </span>
            <span className="text-xs text-slate-500 tabular-nums">
              · 총 {stats.totalEvaluationsCount}건 채점
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>심사위원별 중복 없이 1회 평가</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs font-medium text-slate-500">전체 평균 점수</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono-nums text-2xl font-bold text-slate-900">
              {stats.evaluatedStudentCount > 0 ? stats.overallAverageScore.toFixed(1) : '-'}
            </span>
            <span className="text-xs text-slate-500">/ 100점</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 tabular-nums">
            {stats.evaluatedStudentCount > 0
              ? `최고 ${stats.highestScore.toFixed(1)}점 · 최저 ${stats.lowestScore.toFixed(1)}점`
              : '아직 채점된 점수가 없습니다'}
          </div>
        </div>
      </section>

      {/* Two-Column Analytics Charts */}
      <section aria-label="세부 통계 차트" className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Criterion Averages */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                심사 항목별 전체 평균 (각 25점 만점)
              </h3>
            </div>
            <span className="text-xs text-slate-500">100점 환산 기준</span>
          </div>

          <div className="space-y-4">
            {stats.criterionAverages.map((item) => {
              const pct = (item.average / item.max) * 100;
              return (
                <div key={item.key}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="font-mono-nums font-semibold text-slate-900">
                      {stats.evaluatedStudentCount > 0 ? item.average.toFixed(1) : '0.0'}{' '}
                      <span className="text-slate-400 font-normal">/ {item.max}</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score Distribution Histogram */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-900">
              점수대별 학생 분포 통계
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              평가 완료 {stats.evaluatedStudentCount}명
            </span>
          </div>

          <div className="grid grid-cols-5 gap-3 items-end h-44 pt-4 border-b border-slate-200 pb-2">
            {stats.scoreBuckets.map((bucket) => {
              const heightPct =
                stats.evaluatedStudentCount > 0
                  ? Math.max(bucket.count > 0 ? 12 : 4, (bucket.count / maxBucketCount) * 100)
                  : 4;
              return (
                <div
                  key={bucket.range}
                  className="flex flex-col items-center justify-end h-full gap-1.5"
                >
                  <span className="font-mono-nums text-xs font-semibold text-slate-800">
                    {bucket.count}명
                  </span>
                  <div className="w-full max-w-[44px] flex-1 flex items-end justify-center">
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        bucket.count > 0 ? 'bg-slate-800' : 'bg-slate-200'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-5 gap-3 pt-2 text-center">
            {stats.scoreBuckets.map((bucket) => (
              <div key={bucket.range}>
                <div className="text-xs font-medium text-slate-700">{bucket.label}</div>
                <div className="font-mono-nums text-[11px] text-slate-400">
                  {bucket.range}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Full Ranking & Scoreboard Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              전체 순위 및 세부 점수표
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              각 학생의 평균 점수와 심사 참여 현황을 확인하고 바로 평가할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'evaluated', label: '순위 집계' },
                  { id: 'submitted', label: '제출 학생' },
                  { id: 'all', label: '전체 1~30번' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTableFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    tableFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="번호, 이름, 제목 검색"
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 w-48"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">순위</th>
                <th className="py-3 px-4 whitespace-nowrap">번호</th>
                <th className="py-3 px-4 whitespace-nowrap">학생</th>
                <th className="py-3 px-4">홈페이지 및 주소</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">디자인</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">창의성</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">기능</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">콘텐츠</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">평균 총점</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">심사수</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredTableRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-sm text-slate-500">
                    {tableFilter === 'evaluated'
                      ? '아직 평가가 완료된 학생이 없습니다. 심사평가 탭에서 채점을 시작해 보세요.'
                      : '조건에 해당하는 학생이 없습니다.'}
                  </td>
                </tr>
              ) : (
                filteredTableRows.map((row) => {
                  const isTop3 = row.rank !== null && row.rank <= 3;
                  return (
                    <tr
                      key={row.studentNumber}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono-nums text-xs whitespace-nowrap">
                        {row.rank !== null ? (
                          <span
                            className={
                              isTop3
                                ? 'font-bold text-amber-700'
                                : 'font-medium text-slate-700'
                            }
                          >
                            {row.rank}등
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono-nums text-xs font-semibold text-slate-700 whitespace-nowrap">
                        {formatStudentNumber(row.studentNumber)}번
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-900 whitespace-nowrap">
                        {row.submission ? (
                          row.submission.studentName
                        ) : (
                          <span className="text-slate-400 font-normal">미등록</span>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[280px]">
                        {row.submission ? (
                          <div>
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {row.submission.projectTitle}
                            </div>
                            <a
                              href={row.submission.homepageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline truncate max-w-full"
                            >
                              <span className="truncate">{row.submission.homepageUrl}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            홈페이지 주소 미제출
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-nums text-xs text-slate-600">
                        {row.evaluationCount > 0 ? row.avgDesign.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-nums text-xs text-slate-600">
                        {row.evaluationCount > 0 ? row.avgCreativity.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-nums text-xs text-slate-600">
                        {row.evaluationCount > 0 ? row.avgFunctionality.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-nums text-xs text-slate-600">
                        {row.evaluationCount > 0 ? row.avgContent.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-nums text-sm font-bold text-slate-900">
                        {row.evaluationCount > 0 ? row.avgTotal.toFixed(1) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-nums text-xs text-slate-500">
                        {row.evaluationCount}명
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {row.submission ? (
                          <button
                            type="button"
                            onClick={() => onGoToJudge(row.studentNumber)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            평가하기
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpenSubmitModal(row.studentNumber)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
                          >
                            URL 등록
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
