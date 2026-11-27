/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Award, BarChart3, Globe, UserCheck } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { JudgesSection } from './components/JudgesSection';
import { JudgingWorkspace } from './components/JudgingWorkspace';
import { OverviewSection } from './components/OverviewSection';
import { StudentRosterSection } from './components/StudentRosterSection';
import { StudentSubmitModal } from './components/StudentSubmitModal';
import { ActiveTab, TopBar } from './components/TopBar';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  computeCompetitionData,
  EvaluationRecord,
  JudgeProfile,
  StudentSubmission,
} from './types';

function ContestPortalContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [selectedStudentNum, setSelectedStudentNum] = useState<number>(1);
  const [submitModalOpen, setSubmitModalOpen] = useState(false);
  const [submitModalInitialNum, setSubmitModalInitialNum] = useState<number>(1);

  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [judges, setJudges] = useState<JudgeProfile[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setSubmissions([]);
        setJudges([]);
        setEvaluations([]);
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;

    setDataLoading(true);
    let studentsLoaded = false;
    let judgesLoaded = false;
    let evalsLoaded = false;

    const markLoaded = () => {
      if (studentsLoaded && judgesLoaded && evalsLoaded) {
        setDataLoading(false);
      }
    };

    const studentsQuery = query(
      collection(db, 'students'),
      orderBy('studentNumber', 'asc')
    );
    const unsubStudents = onSnapshot(
      studentsQuery,
      (snapshot) => {
        const list: StudentSubmission[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            studentNumber: Number(data.studentNumber),
            studentName: String(data.studentName ?? ''),
            projectTitle: String(data.projectTitle ?? ''),
            homepageUrl: String(data.homepageUrl ?? ''),
            description: String(data.description ?? ''),
            submittedByUid: String(data.submittedByUid ?? ''),
            submittedByName: String(data.submittedByName ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setSubmissions(list);
        studentsLoaded = true;
        markLoaded();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'students');
      }
    );

    const judgesQuery = query(collection(db, 'judges'));
    const unsubJudges = onSnapshot(
      judgesQuery,
      (snapshot) => {
        const list: JudgeProfile[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            uid: String(data.uid ?? d.id),
            displayName: String(data.displayName ?? ''),
            affiliation: String(data.affiliation ?? ''),
            specialty: String(data.specialty ?? ''),
            status: 'active',
            registeredAt: data.registeredAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setJudges(list);
        judgesLoaded = true;
        markLoaded();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'judges');
      }
    );

    const evalsQuery = query(collection(db, 'evaluations'));
    const unsubEvals = onSnapshot(
      evalsQuery,
      (snapshot) => {
        const list: EvaluationRecord[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            studentId: String(data.studentId ?? ''),
            studentNumber: Number(data.studentNumber),
            judgeUid: String(data.judgeUid ?? ''),
            judgeName: String(data.judgeName ?? ''),
            designScore: Number(data.designScore ?? 0),
            creativityScore: Number(data.creativityScore ?? 0),
            functionalityScore: Number(data.functionalityScore ?? 0),
            contentScore: Number(data.contentScore ?? 0),
            totalScore: Number(data.totalScore ?? 0),
            comment: String(data.comment ?? ''),
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setEvaluations(list);
        evalsLoaded = true;
        markLoaded();
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'evaluations');
      }
    );

    return () => {
      unsubStudents();
      unsubJudges();
      unsubEvals();
    };
  }, [authReady, user]);

  const handleSignIn = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : '로그인 중 오류가 발생했습니다.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError('Google 로그인을 완료할 수 없습니다. 팝업 차단을 해제 후 다시 시도해 주세요.');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthBusy(true);
    try {
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  };

  const { slots, rankedEvaluated, topThree, stats } = useMemo(
    () => computeCompetitionData(submissions, judges, evaluations),
    [submissions, judges, evaluations]
  );

  const currentJudge = useMemo(() => {
    if (!user) return null;
    return judges.find((j) => j.uid === user.uid) ?? null;
  }, [judges, user]);

  const handleOpenSubmitModal = (studentNumber: number) => {
    setSubmitModalInitialNum(studentNumber);
    setSubmitModalOpen(true);
  };

  const handleGoToJudge = (studentNumber: number) => {
    setSelectedStudentNum(studentNumber);
    setActiveTab('judging');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        authLoading={authBusy || !authReady}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!authReady ? (
          <div className="space-y-6">
            <div className="h-10 w-72 bg-slate-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-48 bg-white border border-slate-200 rounded-xl" />
              <div className="h-48 bg-white border border-slate-200 rounded-xl" />
              <div className="h-48 bg-white border border-slate-200 rounded-xl" />
            </div>
          </div>
        ) : !user ? (
          <div className="max-w-4xl mx-auto py-8 sm:py-14">
            <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold text-blue-700 tracking-wide">
                  실시간 경진대회 심사 및 순위 집계 플랫폼
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                  학생 홈페이지 경진대회 심사 포털
                </h1>
                <p className="mt-4 text-base text-slate-600 leading-relaxed">
                  1번부터 30번까지 모든 참가 학생이 자신의 홈페이지 주소를 등록하고, 등록된 심사위원이 공정한 100점 루브릭 기준으로 작품을 평가합니다.
                </p>

                {authError && (
                  <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                    {authError}
                  </p>
                )}

                <div className="mt-7">
                  <button
                    type="button"
                    onClick={handleSignIn}
                    disabled={authBusy}
                    className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {authBusy ? '로그인 중...' : 'Google 계정으로 시작하기'}
                  </button>
                </div>
              </div>

              <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <Globe className="w-5 h-5 text-blue-600 mb-2.5" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    01. 1~30번 학생 URL 제출
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    본인의 출석 번호를 선택해 홈페이지 제목과 접속 가능한 URL을 간편하게 등록합니다.
                  </p>
                </div>
                <div>
                  <UserCheck className="w-5 h-5 text-blue-600 mb-2.5" />
                  <h2 className="text-sm font-semibold text-slate-900">
                    02. 심사위원 등록 및 채점
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    심사위원으로 등록한 뒤 디자인·창의성·기능·콘텐츠 4개 항목(100점)을 평가합니다.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Award className="w-5 h-5 text-blue-600" />
                    <BarChart3 className="w-5 h-5 text-slate-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    03. 1·2·3등 및 전체 통계
                  </h2>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    실시간 1·2·3등 수상 후보와 항목별 평균, 점수 분포 통계를 즉시 확인합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : dataLoading ? (
          <div className="space-y-6">
            <div className="h-9 w-64 bg-slate-200 rounded-lg animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-52 bg-white border border-slate-200 rounded-xl" />
              <div className="h-52 bg-white border border-slate-200 rounded-xl" />
              <div className="h-52 bg-white border border-slate-200 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-28 bg-white border border-slate-200 rounded-xl" />
              <div className="h-28 bg-white border border-slate-200 rounded-xl" />
              <div className="h-28 bg-white border border-slate-200 rounded-xl" />
              <div className="h-28 bg-white border border-slate-200 rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewSection
                slots={slots}
                rankedEvaluated={rankedEvaluated}
                topThree={topThree}
                stats={stats}
                onGoToJudge={handleGoToJudge}
                onOpenSubmitModal={handleOpenSubmitModal}
              />
            )}
            {activeTab === 'students' && (
              <StudentRosterSection
                slots={slots}
                user={user}
                onOpenSubmitModal={handleOpenSubmitModal}
                onGoToJudge={handleGoToJudge}
              />
            )}
            {activeTab === 'judging' && (
              <JudgingWorkspace
                slots={slots}
                selectedStudentNumber={selectedStudentNum}
                onSelectStudent={setSelectedStudentNum}
                currentJudge={currentJudge}
                user={user}
                onOpenSubmitModal={handleOpenSubmitModal}
                onGoToJudgesTab={() => setActiveTab('judges')}
              />
            )}
            {activeTab === 'judges' && (
              <JudgesSection
                judges={judges}
                currentJudge={currentJudge}
                evaluations={evaluations}
                slots={slots}
                user={user}
                onStartJudging={() => setActiveTab('judging')}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>학생 홈페이지 경진대회 심사 포털</span>
          <span className="tabular-nums">1~30번 참가 학생 · 실시간 순위 및 통계 집계</span>
        </div>
      </footer>

      {user && (
        <StudentSubmitModal
          isOpen={submitModalOpen}
          initialStudentNumber={submitModalInitialNum}
          slots={slots}
          user={user}
          onClose={() => setSubmitModalOpen(false)}
          onSaved={(num) => setSelectedStudentNum(num)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ContestPortalContent />
    </ErrorBoundary>
  );
}
