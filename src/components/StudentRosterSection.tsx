import React, { useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ADMIN_EMAIL,
  formatStudentNumber,
  StudentAggregate,
} from '../types';

interface StudentRosterSectionProps {
  slots: StudentAggregate[];
  user: User;
  onOpenSubmitModal: (studentNumber: number) => void;
  onGoToJudge: (studentNumber: number) => void;
}

export const StudentRosterSection: React.FC<StudentRosterSectionProps> = ({
  slots,
  user,
  onOpenSubmitModal,
  onGoToJudge,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'submitted' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteNum, setConfirmDeleteNum] = useState<number | null>(null);
  const [deletingNum, setDeletingNum] = useState<number | null>(null);

  const isAdmin = user.email === ADMIN_EMAIL;

  const submittedCount = slots.filter((s) => s.submission !== null).length;

  const filteredSlots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return slots.filter((slot) => {
      if (filterMode === 'submitted' && !slot.submission) return false;
      if (filterMode === 'pending' && slot.submission) return false;
      if (!q) return true;
      const numStr = `${slot.studentNumber}번 ${formatStudentNumber(slot.studentNumber)}`;
      const name = slot.submission?.studentName.toLowerCase() ?? '';
      const title = slot.submission?.projectTitle.toLowerCase() ?? '';
      const url = slot.submission?.homepageUrl.toLowerCase() ?? '';
      return (
        numStr.includes(q) ||
        name.includes(q) ||
        title.includes(q) ||
        url.includes(q)
      );
    });
  }, [slots, filterMode, searchQuery]);

  const handleDeleteSubmission = async (studentNumber: number) => {
    setDeletingNum(studentNumber);
    const path = `students/${studentNumber}`;
    try {
      await deleteDoc(doc(db, 'students', String(studentNumber)));
      setConfirmDeleteNum(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    } finally {
      setDeletingNum(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            1~30번 학생 리스트 및 홈페이지 주소 관리
          </h1>
          <p className="mt-1 text-sm text-slate-600 tabular-nums">
            참가 학생 번호(01~30번)를 선택해 본인의 홈페이지 URL을 직접 등록하거나 수정하세요. (현재 {submittedCount} / 30명 제출)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const firstEmpty = slots.find((s) => !s.submission)?.studentNumber ?? 1;
            onOpenSubmitModal(firstEmpty);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>내 홈페이지 주소 등록</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          {(
            [
              { id: 'all', label: `전체 (${slots.length})` },
              { id: 'submitted', label: `제출 완료 (${submittedCount})` },
              { id: 'pending', label: `미제출 (${slots.length - submittedCount})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                filterMode === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="학생 번호, 이름, 프로젝트명, URL 검색"
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      {/* 1-30 Roster Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-3 px-4 w-20 whitespace-nowrap">번호</th>
                <th className="py-3 px-4 w-32 whitespace-nowrap">상태</th>
                <th className="py-3 px-4 w-36 whitespace-nowrap">학생 이름</th>
                <th className="py-3 px-4">홈페이지 제목 및 URL</th>
                <th className="py-3 px-4 w-32 text-right whitespace-nowrap">평균 점수</th>
                <th className="py-3 px-4 w-56 text-right whitespace-nowrap">관리 및 심사</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredSlots.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                    검색 조건에 맞는 학생 번호가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredSlots.map((slot) => {
                  const sub = slot.submission;
                  const canEdit =
                    !sub || sub.submittedByUid === user.uid || isAdmin;
                  const isConfirmingDelete = confirmDeleteNum === slot.studentNumber;

                  return (
                    <tr
                      key={slot.studentNumber}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono-nums text-sm font-semibold text-slate-800 whitespace-nowrap">
                        {formatStudentNumber(slot.studentNumber)}번
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sub ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>제출 완료</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>미제출</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sub ? (
                          <div>
                            <div className="text-sm font-medium text-slate-900">
                              {sub.studentName}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              등록: {sub.submittedByName}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        {sub ? (
                          <div>
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {sub.projectTitle}
                            </div>
                            <a
                              href={sub.homepageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-mono text-blue-600 hover:underline truncate max-w-full mt-0.5"
                            >
                              <span className="truncate">{sub.homepageUrl}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                            {sub.description && (
                              <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                                {sub.description}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            아직 홈페이지 주소가 입력되지 않았습니다.
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {slot.evaluationCount > 0 ? (
                          <div>
                            <span className="font-mono-nums text-sm font-bold text-slate-900">
                              {slot.avgTotal.toFixed(1)}점
                            </span>
                            <div className="text-[11px] text-slate-500 tabular-nums">
                              {slot.rank !== null ? `${slot.rank}등 · ` : ''}
                              {slot.evaluationCount}명 심사
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">미평가</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-2">
                            <span className="text-xs text-red-700 font-medium">
                              초기화할까요?
                            </span>
                            <button
                              type="button"
                              disabled={deletingNum === slot.studentNumber}
                              onClick={() => handleDeleteSubmission(slot.studentNumber)}
                              className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                            >
                              확인
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteNum(null)}
                              className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded hover:bg-slate-200 transition-colors"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            {sub ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => onGoToJudge(slot.studentNumber)}
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                                >
                                  심사하기
                                </button>
                                {canEdit && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => onOpenSubmitModal(slot.studentNumber)}
                                      title="정보 수정"
                                      className="p-1.5 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteNum(slot.studentNumber)}
                                      title="등록 초기화"
                                      className="p-1.5 text-red-600 hover:text-red-800 border border-slate-200 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenSubmitModal(slot.studentNumber)}
                                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                주소 입력하기
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
