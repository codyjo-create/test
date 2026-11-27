import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  Save,
  UserCheck,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  EvaluationRecord,
  FIELD_LIMITS,
  formatStudentNumber,
  JudgeProfile,
  RUBRIC_CRITERIA,
  RubricKey,
  StudentAggregate,
} from '../types';

interface JudgingWorkspaceProps {
  slots: StudentAggregate[];
  selectedStudentNumber: number;
  onSelectStudent: (num: number) => void;
  currentJudge: JudgeProfile | null;
  user: User;
  onOpenSubmitModal: (num: number) => void;
  onGoToJudgesTab: () => void;
}

export const JudgingWorkspace: React.FC<JudgingWorkspaceProps> = ({
  slots,
  selectedStudentNumber,
  onSelectStudent,
  currentJudge,
  user,
  onOpenSubmitModal,
  onGoToJudgesTab,
}) => {
  const [listFilter, setListFilter] = useState<'all' | 'submitted' | 'unscored_by_me'>('submitted');
  const [showPreviewFrame, setShowPreviewFrame] = useState(false);

  const [scores, setScores] = useState<Record<RubricKey, number>>({
    designScore: 20,
    creativityScore: 20,
    functionalityScore: 20,
    contentScore: 20,
  });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedSlot = useMemo(
    () => slots.find((s) => s.studentNumber === selectedStudentNumber) ?? slots[0],
    [slots, selectedStudentNumber]
  );

  const myExistingEvaluation: EvaluationRecord | undefined = useMemo(() => {
    if (!selectedSlot) return undefined;
    return selectedSlot.evaluations.find((ev) => ev.judgeUid === user.uid);
  }, [selectedSlot, user.uid]);

  useEffect(() => {
    setSaveMessage(null);
    setFormError(null);
    setShowPreviewFrame(false);
    if (myExistingEvaluation) {
      setScores({
        designScore: myExistingEvaluation.designScore,
        creativityScore: myExistingEvaluation.creativityScore,
        functionalityScore: myExistingEvaluation.functionalityScore,
        contentScore: myExistingEvaluation.contentScore,
      });
      setComment(myExistingEvaluation.comment);
    } else {
      setScores({
        designScore: 20,
        creativityScore: 20,
        functionalityScore: 20,
        contentScore: 20,
      });
      setComment('');
    }
  }, [selectedStudentNumber, myExistingEvaluation]);

  const filteredList = useMemo(() => {
    return slots.filter((slot) => {
      if (listFilter === 'submitted') return slot.submission !== null;
      if (listFilter === 'unscored_by_me') {
        const myEval = slot.evaluations.find((e) => e.judgeUid === user.uid);
        return slot.submission !== null && !myEval;
      }
      return true;
    });
  }, [slots, listFilter, user.uid]);

  const myEvaluatedCount = useMemo(
    () =>
      slots.filter((s) => s.evaluations.some((e) => e.judgeUid === user.uid))
        .length,
    [slots, user.uid]
  );
  const submittedTotalCount = useMemo(
    () => slots.filter((s) => s.submission !== null).length,
    [slots]
  );

  const totalScore =
    scores.designScore +
    scores.creativityScore +
    scores.functionalityScore +
    scores.contentScore;

  const handleScoreChange = (key: RubricKey, rawValue: number) => {
    const clamped = Math.max(
      0,
      Math.min(FIELD_LIMITS.maxRubricScore, Math.round(Number.isNaN(rawValue) ? 0 : rawValue))
    );
    setScores((prev) => ({ ...prev, [key]: clamped }));
  };

  const persistEvaluation = async (moveToNext: boolean) => {
    if (!currentJudge) {
      setFormError('먼저 심사위원 등록을 완료해 주세요.');
      return;
    }
    if (!selectedSlot.submission) {
      setFormError('아직 홈페이지 URL이 제출되지 않은 학생입니다.');
      return;
    }
    if (comment.trim().length > FIELD_LIMITS.commentMax) {
      setFormError(`심사평은 ${FIELD_LIMITS.commentMax}자 이내로 작성해 주세요.`);
      return;
    }

    setSaving(true);
    setFormError(null);
    setSaveMessage(null);

    const evalId = `${user.uid}_${selectedSlot.studentId}`;
    const evalPath = `evaluations/${evalId}`;
    const trimmedComment = comment.trim();

    try {
      if (myExistingEvaluation) {
        await updateDoc(doc(db, 'evaluations', evalId), {
          judgeName: currentJudge.displayName,
          designScore: scores.designScore,
          creativityScore: scores.creativityScore,
          functionalityScore: scores.functionalityScore,
          contentScore: scores.contentScore,
          totalScore,
          comment: trimmedComment,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'evaluations', evalId), {
          studentId: selectedSlot.studentId,
          studentNumber: selectedSlot.studentNumber,
          judgeUid: user.uid,
          judgeName: currentJudge.displayName,
          designScore: scores.designScore,
          creativityScore: scores.creativityScore,
          functionalityScore: scores.functionalityScore,
          contentScore: scores.contentScore,
          totalScore,
          comment: trimmedComment,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (moveToNext) {
        const nextUnscored = slots.find(
          (s) =>
            s.studentNumber !== selectedSlot.studentNumber &&
            s.submission !== null &&
            !s.evaluations.some((e) => e.judgeUid === user.uid)
        );
        if (nextUnscored) {
          onSelectStudent(nextUnscored.studentNumber);
          return;
        }
      }

      setSaveMessage(
        `${formatStudentNumber(selectedSlot.studentNumber)}번 ${selectedSlot.submission.studentName} 학생 평가가 저장되었습니다 (${totalScore}점).`
      );
    } catch (error) {
      handleFirestoreError(
        error,
        myExistingEvaluation ? OperationType.UPDATE : OperationType.CREATE,
        evalPath
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            1~30번 학생 홈페이지 심사평가
          </h1>
          <p className="mt-1 text-sm text-slate-600 tabular-nums">
            제출된 학생 홈페이지를 확인하고 4개 항목(총 100점) 기준으로 채점하세요. 내 평가 진척도: {myEvaluatedCount} / {submittedTotalCount}명
          </p>
        </div>

        {currentJudge ? (
          <div className="text-xs text-slate-600 flex items-center gap-2 shrink-0">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>
              활동 심사위원: <strong className="text-slate-900">{currentJudge.displayName}</strong>
              {currentJudge.affiliation ? ` · ${currentJudge.affiliation}` : ''}
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onGoToJudgesTab}
            className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
          >
            심사위원 등록하러 가기
          </button>
        )}
      </div>

      {/* Two-zone Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Pane: 1-30 Student Selector */}
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-3 border-b border-slate-200">
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'submitted', label: '제출 학생' },
                  { id: 'unscored_by_me', label: '내 미평가' },
                  { id: 'all', label: '전체 1~30' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setListFilter(tab.id)}
                  className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    listFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto thin-scrollbar divide-y divide-slate-100">
            {filteredList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                해당 조건에 표시할 학생이 없습니다.
              </div>
            ) : (
              filteredList.map((slot) => {
                const isSelected = slot.studentNumber === selectedSlot.studentNumber;
                const myEval = slot.evaluations.find((e) => e.judgeUid === user.uid);
                return (
                  <button
                    key={slot.studentNumber}
                    type="button"
                    onClick={() => onSelectStudent(slot.studentNumber)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono-nums text-xs font-bold ${
                            isSelected ? 'text-blue-700' : 'text-slate-600'
                          }`}
                        >
                          {formatStudentNumber(slot.studentNumber)}번
                        </span>
                        <span className="text-sm font-medium truncate">
                          {slot.submission ? slot.submission.studentName : '미제출'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {slot.submission
                          ? slot.submission.projectTitle
                          : '홈페이지 주소 미등록'}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {!slot.submission ? (
                        <span className="text-[11px] text-slate-400">미제출</span>
                      ) : myEval ? (
                        <span className="font-mono-nums text-xs font-semibold text-emerald-700">
                          {myEval.totalScore}점
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-amber-700">
                          미평가
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Pane: Active Judging Stage */}
        <section className="lg:col-span-8 space-y-6">
          {/* Student Overview & URL Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono-nums font-semibold text-slate-800">
                    {formatStudentNumber(selectedSlot.studentNumber)}번
                  </span>
                  <span aria-hidden="true">·</span>
                  {selectedSlot.submission ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>제출 완료</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>미제출</span>
                    </span>
                  )}
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    누적 심사 {selectedSlot.evaluationCount}건
                    {selectedSlot.evaluationCount > 0
                      ? ` (평균 ${selectedSlot.avgTotal.toFixed(1)}점)`
                      : ''}
                  </span>
                </div>

                <h2 className="mt-2 text-xl font-bold text-slate-900">
                  {selectedSlot.submission
                    ? `${selectedSlot.submission.studentName} — ${selectedSlot.submission.projectTitle}`
                    : `${formatStudentNumber(selectedSlot.studentNumber)}번 학생 (홈페이지 미등록)`}
                </h2>

                {selectedSlot.submission?.description && (
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                    {selectedSlot.submission.description}
                  </p>
                )}
              </div>

              {selectedSlot.submission && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowPreviewFrame((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    {showPreviewFrame ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>미리보기 닫기</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>화면 미리보기</span>
                      </>
                    )}
                  </button>
                  <a
                    href={selectedSlot.submission.homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                  >
                    <span>새 탭에서 열기</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {selectedSlot.submission ? (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <a
                  href={selectedSlot.submission.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 hover:underline truncate"
                >
                  {selectedSlot.submission.homepageUrl}
                </a>
              </div>
            ) : (
              <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  홈페이지 주소가 등록되어야 심사를 진행할 수 있습니다.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenSubmitModal(selectedSlot.studentNumber)}
                  className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors self-start"
                >
                  {formatStudentNumber(selectedSlot.studentNumber)}번 URL 등록하기
                </button>
              </div>
            )}

            {showPreviewFrame && selectedSlot.submission && (
              <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between gap-2 text-[11px] text-slate-600">
                  <span>
                    외부 보안 정책(X-Frame-Options)으로 표시되지 않는 사이트는 우측 상단 '새 탭에서 열기'를 이용해 주세요.
                  </span>
                </div>
                <iframe
                  title={`${selectedSlot.submission.studentName} 홈페이지 미리보기`}
                  src={selectedSlot.submission.homepageUrl}
                  className="w-full h-[420px] bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            )}
          </div>

          {/* Judge Gate or Scoring Rubric Form */}
          {!currentJudge ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h3 className="text-base font-semibold text-slate-900">
                심사위원 등록이 필요합니다
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                학생들의 홈페이지를 채점하려면 먼저 심사위원으로 등록해 주세요. 성함과 소속 입력 후 즉시 심사를 시작할 수 있습니다.
              </p>
              <button
                type="button"
                onClick={onGoToJudgesTab}
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
              >
                심사위원 등록하기
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {myExistingEvaluation ? '내 평가 수정' : '평가 점수 입력'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    항목별 0~25점 범위로 입력하면 100점 만점 총점이 자동 계산됩니다.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-500">총점 합계</div>
                  <div className="font-mono-nums text-2xl font-bold text-blue-700">
                    {totalScore}
                    <span className="text-xs font-normal text-slate-500 ml-1">/ 100</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {RUBRIC_CRITERIA.map((criterion) => {
                  const val = scores[criterion.key];
                  return (
                    <div key={criterion.key} className="space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <label
                            htmlFor={`slider-${criterion.key}`}
                            className="text-sm font-medium text-slate-900"
                          >
                            {criterion.label}
                          </label>
                          <p className="text-xs text-slate-500">
                            {criterion.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min={0}
                            max={criterion.max}
                            disabled={!selectedSlot.submission || saving}
                            value={val}
                            onChange={(e) =>
                              handleScoreChange(criterion.key, Number(e.target.value))
                            }
                            aria-label={`${criterion.label} 점수`}
                            className="w-16 px-2 py-1 text-right font-mono-nums text-sm font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                          <span className="text-xs text-slate-500 tabular-nums">
                            / {criterion.max}
                          </span>
                        </div>
                      </div>
                      <input
                        id={`slider-${criterion.key}`}
                        type="range"
                        min={0}
                        max={criterion.max}
                        step={1}
                        disabled={!selectedSlot.submission || saving}
                        value={val}
                        onChange={(e) =>
                          handleScoreChange(criterion.key, Number(e.target.value))
                        }
                        className="w-full accent-blue-600 cursor-pointer disabled:opacity-40"
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="judge-comment-input"
                    className="text-xs font-medium text-slate-700"
                  >
                    심사평 및 피드백 (선택)
                  </label>
                  <span className="text-xs text-slate-400 tabular-nums">
                    {comment.length}/{FIELD_LIMITS.commentMax}
                  </span>
                </div>
                <textarea
                  id="judge-comment-input"
                  rows={3}
                  maxLength={FIELD_LIMITS.commentMax}
                  disabled={!selectedSlot.submission || saving}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="학생 홈페이지의 강점이나 개선할 점을 남겨주세요."
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100 resize-none"
                />
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {saveMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{saveMessage}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={!selectedSlot.submission || saving}
                  onClick={() => persistEvaluation(false)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? '저장 중...' : '평가 저장'}</span>
                </button>
                <button
                  type="button"
                  disabled={!selectedSlot.submission || saving}
                  onClick={() => persistEvaluation(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <span>저장 후 다음 미평가 학생</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Other Judges' Evaluations for this Student */}
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900">
                이 학생에 대한 심사위원 평가 내역
              </h3>
              <span className="text-xs text-slate-500 tabular-nums">
                총 {selectedSlot.evaluations.length}건
              </span>
            </div>

            {selectedSlot.evaluations.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                아직 등록된 심사평이 없습니다.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {selectedSlot.evaluations.map((ev) => (
                  <div key={ev.id} className="py-3.5 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-xs text-slate-600">
                        <strong className="text-slate-900 font-semibold">
                          {ev.judgeName}
                        </strong>
                        <span aria-hidden="true"> · </span>
                        <span className="font-mono-nums">
                          디자인 {ev.designScore} / 창의 {ev.creativityScore} / 기능{' '}
                          {ev.functionalityScore} / 콘텐츠 {ev.contentScore}
                        </span>
                      </div>
                      <span className="font-mono-nums text-sm font-bold text-slate-900 shrink-0">
                        {ev.totalScore}점
                      </span>
                    </div>
                    {ev.comment && (
                      <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                        {ev.comment}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
