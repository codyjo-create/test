# Security Specification & Payload-First TDD

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unspecified path in Firestore is rejected.
2. **Verified Identity Mandate**: All writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Bounded Student Roster (1–30)**: `students/{studentId}` only accepts IDs matching `^([1-9]|[12][0-9]|30)$` and `studentNumber == int(studentId)`.
4. **URL Format Enforcement**: `homepageUrl` must match `^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(:[0-9]{1,5})?(/.*)?$` and stay within 8–300 chars.
5. **Single Owner or Admin Mutation**: Once a student slot `1–30` is registered, only `submittedByUid == request.auth.uid` or an `isAdmin()` user can update or delete it.
6. **Self-Owned Judge Registration (No PII)**: `judges/{judgeId}` requires `judgeId == request.auth.uid` and `uid == request.auth.uid`, with zero PII fields (`email`, `phone`, `address` forbidden).
7. **Master Gate & Deterministic Evaluations**: `evaluations/{evaluationId}` requires `evaluationId == incoming().judgeUid + '_' + incoming().studentId`, an active judge record `exists(/databases/$(database)/documents/judges/$(request.auth.uid))`, and an existing student record `exists(/databases/$(database)/documents/students/$(incoming().studentId))`.
8. **Rubric Integrity**: Each criterion (`designScore`, `creativityScore`, `functionalityScore`, `contentScore`) is an integer `0..25` and `totalScore` must strictly equal their sum (`0..100`).
9. **Temporal & Immutable Field Integrity**: `createdAt` must equal `request.time` on create and remain unchanged on update; `updatedAt` must equal `request.time` on create and update; ownership and relational foreign keys (`submittedByUid`, `uid`, `judgeUid`, `studentId`, `studentNumber`) are immutable.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Write**: Creating `/students/1` with `request.auth == null`.
2. **Unverified Email Write**: Creating `/judges/{uid}` with `email_verified: false`.
3. **Out-of-Range Student ID**: Creating `/students/31` or `/students/0` (ID poisoning).
4. **Student Number Mismatch**: Creating `/students/5` with `studentNumber: 6`.
5. **Malicious JavaScript URL**: Creating `/students/2` with `homepageUrl: "javascript:alert(1)"`.
6. **Shadow Ghost Field**: Creating `/students/3` with extra field `isWinner: true` or `verified: true`.
7. **Hijack Another Student's Slot**: User B updating `/students/4` owned by User A (`submittedByUid: UserA`).
8. **Spoof Judge Registration**: User A creating `/judges/UserB` with `uid: "UserB"`.
9. **Unregistered Judge Evaluation**: Signed-in user without a `/judges/{uid}` doc creating `/evaluations/{uid}_1`.
10. **Orphaned Evaluation**: Registered judge creating `/evaluations/{uid}_29` when `/students/29` does not exist.
11. **Manipulated Total Score**: Judge creating `/evaluations/{uid}_1` with `designScore: 10, creativityScore: 10, functionalityScore: 10, contentScore: 10, totalScore: 100`.
12. **Client Timestamp Forgery**: Creating or updating any document with a backdated/future `createdAt` or `updatedAt` (`!= request.time`).
