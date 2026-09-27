# Automated Lesson Store Audit Report

> **Audited 160 lessons from `C:\Users\joshs\.claude\projects\D--Repos-Database\memory`**
> Generated on 2026-09-13T05:54:03.908Z

---

## 1. Integrity & Frontmatter Health

✅ **All 160 lessons possess valid YAML frontmatter, valid titles/descriptions, and clean byte encodings.**

## 2. Decay & Path Verification

✅ **Zero unannotated decayed path citations found.** All missing paths are accompanied by historical or retrospective context.

## 3. Duplicates & Redundancy Analysis

Identified **24 high-similarity lesson pairs** (Jaccard similarity ≥ 0.35):

| Lesson A                                                 | Lesson B                                               | Similarity | Cross-Referenced? |
| -------------------------------------------------------- | ------------------------------------------------------ | ---------- | ----------------- |
| `a-shared-decision-is-not-a-behavioural-property.md`     | `a-structural-guarantee-is-invisible-behaviourally.md` | 0.427      | ✅ Yes            |
| `a-comment-can-satisfy-a-guard.md`                       | `a-green-mutation-only-counts-if-the-mutant-ran.md`    | 0.385      | ✅ Yes            |
| `a-green-mutation-only-counts-if-the-mutant-ran.md`      | `checks-that-cannot-fail.md`                           | 0.384      | ✅ Yes            |
| `a-correction-that-agrees-with-you.md`                   | `establish-the-unit-before-counting.md`                | 0.38       | ✅ Yes            |
| `a-measurement-is-scoped-to-what-it-measured.md`         | `establish-the-unit-before-counting.md`                | 0.38       | ✅ Yes            |
| `checks-that-cannot-fail.md`                             | `establish-the-unit-before-counting.md`                | 0.379      | ✅ Yes            |
| `a-green-mutation-only-counts-if-the-mutant-ran.md`      | `a-measurement-is-scoped-to-what-it-measured.md`       | 0.377      | ✅ Yes            |
| `a-green-mutation-only-counts-if-the-mutant-ran.md`      | `establish-the-unit-before-counting.md`                | 0.375      | ✅ Yes            |
| `a-measurement-is-scoped-to-what-it-measured.md`         | `checks-that-cannot-fail.md`                           | 0.369      | ✅ Yes            |
| `a-green-mutation-only-counts-if-the-mutant-ran.md`      | `compliance-without-coverage.md`                       | 0.366      | ✅ Yes            |
| `a-correction-that-agrees-with-you.md`                   | `a-measurement-is-scoped-to-what-it-measured.md`       | 0.364      | ✅ Yes            |
| `a-correction-that-agrees-with-you.md`                   | `a-green-mutation-only-counts-if-the-mutant-ran.md`    | 0.363      | ✅ Yes            |
| `a-correction-that-agrees-with-you.md`                   | `checks-that-cannot-fail.md`                           | 0.362      | ✅ Yes            |
| `a-correction-that-agrees-with-you.md`                   | `observations-expire.md`                               | 0.361      | ✅ Yes            |
| `establish-the-unit-before-counting.md`                  | `observations-expire.md`                               | 0.361      | ✅ Yes            |
| `a-control-must-test-the-premise-not-the-measurement.md` | `a-green-mutation-only-counts-if-the-mutant-ran.md`    | 0.358      | ✅ Yes            |
| `a-comment-can-satisfy-a-guard.md`                       | `compliance-without-coverage.md`                       | 0.357      | ✅ Yes            |
| `a-comment-can-satisfy-a-guard.md`                       | `a-measurement-is-scoped-to-what-it-measured.md`       | 0.353      | ✅ Yes            |
| `a-control-must-test-the-premise-not-the-measurement.md` | `git-queries-that-answer-instead-of-erroring.md`       | 0.353      | ✅ Yes            |
| `a-green-mutation-only-counts-if-the-mutant-ran.md`      | `a-guard-that-blocks-its-own-purpose.md`               | 0.353      | ✅ Yes            |
| `compliance-without-coverage.md`                         | `establish-the-unit-before-counting.md`                | 0.353      | ✅ Yes            |
| `gate-wrappers-mask-exit-codes.md`                       | `git-queries-that-answer-instead-of-erroring.md`       | 0.353      | ✅ Yes            |
| `a-control-must-test-the-premise-not-the-measurement.md` | `compliance-without-coverage.md`                       | 0.352      | ✅ Yes            |
| `a-measurement-is-scoped-to-what-it-measured.md`         | `compliance-without-coverage.md`                       | 0.351      | ✅ Yes            |

## 4. Contradiction & Scope Boundary Verification

Verifying that all known opposing guidance axes carry explicit domain/boundary qualifiers:

- ✅ **Allowlists vs. No-Exemptions**: Domain boundaries explicitly declared across involved files.
- ✅ **Ban Everywhere vs Scope to False States**: Domain boundaries explicitly declared across involved files.
- ✅ **File Pointers vs Plain Brief Prose**: Domain boundaries explicitly declared across involved files.
- ✅ **Pin SHA vs Never Pin SHA**: Domain boundaries explicitly declared across involved files.
