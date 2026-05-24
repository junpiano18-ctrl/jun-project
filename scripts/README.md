# scripts/ 가이드

모두 `npx tsx scripts/<name>.ts` 로 실행. DB 변경 스크립트는 대부분 `--dry-run` 지원.

## 데이터 동기화 (sync-*)

| 스크립트 | 역할 | 빈도 |
| --- | --- | --- |
| `sync-assembly.ts` | 22대 국회의원 286명 명단·정당·지역구 | 신규 의원 추가 시 |
| `sync-elected-officials.ts` | 8회 광역단체장·교육감·기초단체장 260명 | 신규 단체장 추가 시 |
| `sync-bills.ts` | 의원별 대표발의 법안 | 주 1회 |
| `sync-bill-counts.ts` | PoliticianTerm.bill{Proposed,Passed}Count 집계 | sync-bills 후 |
| `sync-plenary-attendance.ts` | 본회의 표결 출석률 + PlenaryBill 집계 | 주 1회 |
| `sync-votes.ts` | 의원별 본회의 표결 기록 (VoteRecord) | 주 1회 |
| `sync-votes-missing.ts` | 비밀투표류로 누락된 표결 진단 (수정 안 함) | 진단용 |
| `sync-pledges.ts` | 선관위 5대 공약 (광역/교육감/기초장) | 신규 선거 후 |
| `sync-career-text.ts` | 의원 학력·경력 텍스트 | 신규 의원 추가 시 |
| `sync-committee-history.ts` | 의원 위원회 이력 | 분기 1회 |
| `sync-district-coords.ts` | 22대 선거구 중심 좌표 (지도 핀용) | 일회성 |
| `sync-elected-coords.ts` | 단체장 지역 중심 좌표 | 일회성 |

## 자동 모니터링 (cron 후보)

| 스크립트 | 역할 |
| --- | --- |
| `auto-update-status.ts` | API ↔ DB 의원 명단/정당 diff 자동 동기화 (3일 연속 관측 시 정당 적용) |
| `check-news-alerts.ts` | 키워드별 뉴스 매칭 후보 출력 (현재 mock fetch — 네이버 API 키 발급 후 연결) |

## AI 요약 (Anthropic)

| 스크립트 | 역할 |
| --- | --- |
| `summarize-bills.ts` | Bill.summary 채우기 (의원 1명 한정 옵션 지원) |
| `summarize-plenary-bills.ts` | PlenaryBill.summary 채우기 (본회의 처리 안건 전체) |
| `summarize-pledges.ts` | Pledge.easySummary 채우기 (공약 중학생 눈높이 요약) |

모두 Haiku 4.5 기본 + 시스템 프롬프트 캐싱. concurrency=2가 안전 한도.

## 수동 데이터 입력

| 스크립트 | 역할 |
| --- | --- |
| `set-additional-role.ts` | 의원의 겸직(예: 장관) 수동 등록. ENTRIES 배열에 추가 후 실행 |
| `set-court-ruling.ts` | 1심 이상 법원 판결 수동 등록. 수사·기소 단계는 절대 입력 금지 (정책) |
| `update-politician-status.ts` | 의원직 상실/직무정지/사망 status 수동 갱신 |

## 진단·검증

| 스크립트 | 역할 |
| --- | --- |
| `db-stats.ts` | DB 전체 row 수 통계 |
| `check-jcr.ts` | 특정 의원 모든 필드 빈 값 확인 |
| `check-pin.ts` | 지도 핀 데이터 검증 |
| `inspect-districts.ts` | District 테이블 + GeoJSON 매핑 검사 |
| `verify-photos.ts` | photoUrl 유효성 검증 |

## 일회성·헬퍼

| 스크립트 | 역할 |
| --- | --- |
| `build-dong-mapping.ts` | 행정동 → 22대 선거구 매핑 빌드 (`src/lib/geo/dong-to-district.json` 생성) |
| `fetch-photos-wikipedia.ts` | 위키피디아에서 의원 사진 URL 크롤링 |
| `import-asset-disclosure.ts` | 공직자윤리위 재산 신고 데이터 임포트 |

## 임시 파일 규칙

작업용 임시 스크립트는 `_tmp-*.ts` 접두어로 만들고 작업 후 즉시 삭제. 커밋 전에 `_tmp-`가 남아있지 않은지 확인.
