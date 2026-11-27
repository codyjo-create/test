import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { AlertCircle, ExternalLink, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  ADMIN_EMAIL,
  FIELD_LIMITS,
  formatStudentNumber,
  StudentAggregate,
  URL_REGEX,
} from '../types';

interface StudentSubmitModalProps {
  isOpen: boolean;
  initialStudentNumber: number;
  slots: StudentAggregate[];
  user: User;
  onClose: () => void;
  onSaved: (studentNumber: number) => void;
}

export const StudentSubmitModal: React.FC<StudentSubmitModalProps> = ({
  isOpen,
  initialStudentNumber,
  slots,
  user,
  onClose,
  onSaved,
}) => {
  const [selectedNum, setSelectedNum] = useState<number>(initialStudentNumber);
  const [studentName, setStudentName] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [homepageUrl, setHomepageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isAdmin = user.email === ADMIN_EMAIL;

  useEffect(() => {
    if (!isOpen) return;
    setSelectedNum(initialStudentNumber);
  }, [isOpen, initialStudentNumber]);

  const currentSlot = slots.find((s) => s.studentNumber === selectedNum);
  const existingSubmission = currentSlot?.submission ?? null;
  const canEditSelected =
    !existingSubmission ||
    existingSubmission.submittedByUid === user.uid ||
    isAdmin;

  useEffect(() => {
    if (!isOpen) return;
    setFormError(null);
    if (existingSubmission) {
      setStudentName(existingSubmission.studentName);
      setProjectTitle(existingSubmission.projectTitle);
      setHomepageUrl(existingSubmission.homepageUrl);
      setDescription(existingSubmission.description);
    } else {
      setStudentName('');
      setProjectTitle('');
      setHomepageUrl('https://');
      setDescription('');
    }
  }, [isOpen, selectedNum, existingSubmission]);

  if (!isOpen) return null;

  const validate = (): string | null => {
    const trimmedName = studentName.trim();
    const trimmedTitle = projectTitle.trim();
    const trimmedUrl = homepageUrl.trim();
    const trimmedDesc = description.trim();

    if (
      trimmedName.length < FIELD_LIMITS.studentNameMin ||
      trimmedName.length > FIELD_LIMITS.studentNameMax
    ) {
      return `학생 이름은 1~${FIELD_LIMITS.studentNameMax}자 이내로 입력해 주세요.`;
    }
    if (
      trimmedTitle.length < FIELD_LIMITS.projectTitleMin ||
      trimmedTitle.length > FIELD_LIMITS.projectTitleMax
    ) {
      return `홈페이지 제목은 1~${FIELD_LIMITS.projectTitleMax}자 이내로 입력해 주세요.`;
    }
    if (
      trimmedUrl.length < FIELD_LIMITS.homepageUrlMin ||
      trimmedUrl.length > FIELD_LIMITS.homepageUrlMax ||
      !URL_REGEX.test(trimmedUrl)
    ) {
      return '올바른 http:// 또는 https:// 홈페이지 주소를 입력해 주세요. (예: https://student01.github.io)';
    }
    if (trimmedDesc.length > FIELD_LIMITS.descriptionMax) {
      return `소개 문구는 ${FIELD_LIMITS.descriptionMax}자 이내로 입력해 주세요.`;
    }
    if (!canEditSelected) {
      return '이미 다른 사용자가 등록한 번호입니다. 본인이 등록한 번호 또는 빈 번호를 선택해 주세요.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const docPath = `students/${selectedNum}`;
    const trimmedName = studentName.trim();
    const trimmedTitle = projectTitle.trim();
    const trimmedUrl = homepageUrl.trim();
    const trimmedDesc = description.trim();
    const submitterName = (user.displayName || user.email?.split('@')[0] || '참가자').slice(0, 40);

    try {
      if (existingSubmission) {
        await updateDoc(doc(db, 'students', String(selectedNum)), {
          studentName: trimmedName,
          projectTitle: trimmedTitle,
          homepageUrl: trimmedUrl,
          description: trimmedDesc,
          submittedByName: submitterName,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'students', String(selectedNum)), {
          studentNumber: selectedNum,
          studentName: trimmedName,
          projectTitle: trimmedTitle,
          homepageUrl: trimmedUrl,
          description: trimmedDesc,
          submittedByUid: user.uid,
          submittedByName: submitterName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      onSaved(selectedNum);
      onClose();
    } catch (error) {
      handleFirestoreError(
        error,
        existingSubmission ? OperationType.UPDATE : OperationType.CREATE,
        docPath
      );
    } finally {
      setSubmitting(false);
    }
  };

  const urlLooksValid = URL_REGEX.test(homepageUrl.trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="submit-modal-title" className="text-base font-semibold text-slate-900">
            학생 홈페이지 주소 {existingSubmission ? '수정' : '등록'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label
              htmlFor="student-number-select"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              학생 번호 선택 (1~30번)
            </label>
            <select
              id="student-number-select"
              value={selectedNum}
              onChange={(e) => setSelectedNum(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
            >
              {slots.map((slot) => {
                const statusText = slot.submission
                  ? `${slot.submission.studentName} (등록됨)`
                  : '미등록';
                return (
                  <option key={slot.studentNumber} value={slot.studentNumber}>
                    {formatStudentNumber(slot.studentNumber)}번 · {statusText}
                  </option>
                );
              })}
            </select>
          </div>

          {!canEditSelected && existingSubmission && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">
                  {formatStudentNumber(selectedNum)}번은 이미{' '}
                  {existingSubmission.submittedByName} 님이 등록했습니다.
                </p>
                <p className="text-amber-700 mt-0.5">
                  다른 빈 번호를 선택하거나, 최초 등록자/관리자 계정으로 로그인해 수정하세요.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="student-name-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                학생 이름 <span className="text-red-600">*</span>
              </label>
              <input
                id="student-name-input"
                type="text"
                required
                maxLength={FIELD_LIMITS.studentNameMax}
                disabled={!canEditSelected || submitting}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="예: 김서연"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="project-title-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                홈페이지 제목 <span className="text-red-600">*</span>
              </label>
              <input
                id="project-title-input"
                type="text"
                required
                maxLength={FIELD_LIMITS.projectTitleMax}
                disabled={!canEditSelected || submitting}
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="예: 우리 동네 생태 지도"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="homepage-url-input"
                className="block text-xs font-medium text-slate-700"
              >
                홈페이지 주소 (URL) <span className="text-red-600">*</span>
              </label>
              {urlLooksValid && (
                <a
                  href={homepageUrl.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                >
                  <span>링크 확인</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <input
              id="homepage-url-input"
              type="url"
              required
              maxLength={FIELD_LIMITS.homepageUrlMax}
              disabled={!canEditSelected || submitting}
              value={homepageUrl}
              onChange={(e) => setHomepageUrl(e.target.value)}
              placeholder="https://username.github.io/my-site"
              className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
            />
            <p className="mt-1 text-xs text-slate-500">
              반드시 https:// 또는 http:// 로 시작하는 접속 가능한 주소를 입력하세요.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="project-desc-input"
                className="block text-xs font-medium text-slate-700"
              >
                작품 한 줄 소개 (선택)
              </label>
              <span className="text-xs text-slate-400 tabular-nums">
                {description.length}/{FIELD_LIMITS.descriptionMax}
              </span>
            </div>
            <textarea
              id="project-desc-input"
              rows={2}
              maxLength={FIELD_LIMITS.descriptionMax}
              disabled={!canEditSelected || submitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="홈페이지 기획 의도나 주요 기능을 간단히 소개해 주세요."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100 resize-none"
            />
          </div>

          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!canEditSelected || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting
                ? '저장 중...'
                : existingSubmission
                  ? '홈페이지 정보 수정'
                  : '홈페이지 등록하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
