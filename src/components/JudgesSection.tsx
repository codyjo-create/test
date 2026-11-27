import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AlertCircle, CheckCircle2, Trash2, UserCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ADMIN_EMAIL,
  EvaluationRecord,
  FIELD_LIMITS,
  JudgeProfile,
  StudentAggregate,
} from '../types';

interface JudgesSectionProps {
  judges: JudgeProfile[];
  currentJudge: JudgeProfile | null;
  evaluations: EvaluationRecord[];
  slots: StudentAggregate[];
  user: User;
  onStartJudging: () => void;
}

export const JudgesSection: React.FC<JudgesSectionProps> = ({
  judges,
  currentJudge,
  evaluations,
  slots,
  user,
  onStartJudging,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);

  const isAdmin = user.email === ADMIN_EMAIL;
  const submittedCount = slots.filter((s) => s.submission !== null).length;

  useEffect(() => {
    if (currentJudge) {
      setDisplayName(currentJudge.displayName);
      setAffiliation(currentJudge.affiliation);
      setSpecialty(currentJudge.specialty);
    } else {
      setDisplayName(
        (user.displayName || user.email?.split('@')[0] || '').slice(
          0,
          FIELD_LIMITS.judgeDisplayNameMax
        )
      );
      setAffiliation('');
      setSpecialty('');
    }
  }, [currentJudge, user]);

  const handleSaveJudge = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    const trimmedAff = affiliation.trim();
    const trimmedSpec = specialty.trim();

    if (
      trimmedName.length < FIELD_LIMITS.judgeDisplayNameMin ||
      trimmedName.length > FIELD_LIMITS.judgeDisplayNameMax
    ) {
      setFormError(
        `심사위원 성함은 1~${FIELD_LIMITS.judgeDisplayNameMax}자 이내로 입력해 주세요.`
      );
      return;
    }
    if (trimmedAff.length > FIELD_LIMITS.judgeAffiliationMax) {
      setFormError(
        `소속/직함은 ${FIELD_LIMITS.judgeAffiliationMax}자 이내로 입력해 주세요.`
      );
      return;
    }
    if (trimmedSpec.length > FIELD_LIMITS.judgeSpecialtyMax) {
      setFormError(
        `전문 분야는 ${FIELD_LIMITS.judgeSpecialtyMax}자 이내로 입력해 주세요.`
      );
      return;
    }

    setSaving(true);
    setFormError(null);
    setMessage(null);
    const judgePath = `judges/${user.uid}`;

    try {
      if (currentJudge) {
        await updateDoc(doc(db, 'judges', user.uid), {
          displayName: trimmedName,
          affiliation: trimmedAff,
          specialty: trimmedSpec,
          updatedAt: serverTimestamp(),
        });
        setMessage('심사위원 프로필이 수정되었습니다.');
      } else {
        await setDoc(doc(db, 'judges', user.uid), {
          uid: user.uid,
          displayName: trimmedName,
          affiliation: trimmedAff,
          specialty: trimmedSpec,
          status: 'active',
          registeredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setMessage('심사위원 등록이 완료되었습니다. 이제 1~30번 학생을 평가할 수 있습니다.');
      }
    } catch (error) {
      handleFirestoreError(
        error,
        currentJudge ? OperationType.UPDATE : OperationType.CREATE,
        judgePath
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteJudge = async (judgeId: string) => {
    const path = `judges/${judgeId}`;
    try {
      await deleteDoc(doc(db, 'judges', judgeId));
      setConfirmWithdrawId(null);
      if (judgeId === user.uid) {
        setMessage('심사위원 등록이 해제되었습니다.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          심사위원 등록 및 평가 현황
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          심사위원으로 등록하여 1~30번 학생들의 홈페이지를 평가하고, 전체 심사위원의 채점 진척도를 확인합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Registration / Profile Card */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-slate-900">
                {currentJudge ? '내 심사위원 정보' : '신규 심사위원 등록'}
              </h2>
            </div>
            {currentJudge && (
              <span className="text-xs font-medium text-emerald-700">등록 완료</span>
            )}
          </div>

          <form onSubmit={handleSaveJudge} className="space-y-4">
            <div>
              <label
                htmlFor="judge-name-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                심사위원 성함 <span className="text-red-600">*</span>
              </label>
              <input
                id="judge-name-input"
                type="text"
                required
                maxLength={FIELD_LIMITS.judgeDisplayNameMax}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="예: 박지훈"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="judge-affiliation-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                소속 / 직함 (선택)
              </label>
              <input
                id="judge-affiliation-input"
                type="text"
                maxLength={FIELD_LIMITS.judgeAffiliationMax}
                value={affiliation}
                onChange={(e) => setAffiliation(e.target.value)}
                placeholder="예: 정보컴퓨터교사 / 웹개발 멘토"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label
                htmlFor="judge-specialty-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                중점 심사 분야 (선택)
              </label>
              <input
                id="judge-specialty-input"
                type="text"
                maxLength={FIELD_LIMITS.judgeSpecialtyMax}
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="예: UI/UX, 반응형 웹, 창의성"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {message && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{message}</span>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving
                  ? '저장 중...'
                  : currentJudge
                    ? '프로필 수정'
                    : '심사위원 등록하기'}
              </button>

              {currentJudge && (
                <button
                  type="button"
                  onClick={onStartJudging}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  학생 평가하러 가기
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Registered Judges Directory & Progress */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                등록된 심사위원 명단
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                총 {judges.length}명의 심사위원이 활동 중입니다.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">심사위원</th>
                  <th className="py-3 px-4">소속 / 분야</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">평가 진척도</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">평균 부여점</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {judges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-sm text-slate-500">
                      아직 등록된 심사위원이 없습니다. 왼쪽 양식에서 첫 심사위원으로 등록해 보세요.
                    </td>
                  </tr>
                ) : (
                  judges.map((judge) => {
                    const judgeEvals = evaluations.filter(
                      (e) => e.judgeUid === judge.uid
                    );
                    const evalCount = judgeEvals.length;
                    const avgGiven =
                      evalCount > 0
                        ? judgeEvals.reduce((sum, e) => sum + e.totalScore, 0) /
                          evalCount
                        : 0;
                    const canRemove = judge.uid === user.uid || isAdmin;
                    const isConfirming = confirmWithdrawId === judge.id;

                    return (
                      <tr key={judge.id} className="hover:bg-slate-50/70">
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900">
                            {judge.displayName}
                            {judge.uid === user.uid && (
                              <span className="ml-1.5 text-xs font-normal text-blue-600">
                                (나)
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">
                          <div>{judge.affiliation || '소속 미입력'}</div>
                          {judge.specialty && (
                            <div className="text-slate-400 mt-0.5">
                              {judge.specialty}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-nums text-xs text-slate-700 whitespace-nowrap">
                          {evalCount} / {submittedCount}명
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono-nums text-xs font-semibold text-slate-900 whitespace-nowrap">
                          {evalCount > 0 ? `${avgGiven.toFixed(1)}점` : '-'}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {canRemove &&
                            (isConfirming ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteJudge(judge.id)}
                                  className="px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
                                >
                                  해제
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmWithdrawId(null)}
                                  className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmWithdrawId(judge.id)}
                                title="심사위원 등록 해제"
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ))}
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
    </div>
  );
};
