# 내머슴닷컴 (naemeosum.com)

> 내가 뽑고, 내가 감시한다.
> 국회의원 = 국민이 고용한 4년 계약직 일꾼.

22대 대한민국 국회의원을 지도 위에서 확인하고, 출근율 · 발의 건수 · 공약 이행률을 한눈에 보는 공익 서비스입니다.

**스택**: Next.js 16 (App Router · Turbopack) · React 19 · TypeScript · Tailwind v4 · Prisma 7 · Supabase Postgres · Leaflet/react-leaflet 5

## 설치

### 0. 사전 요구사항

- Node.js 22+ (npm 10+)
- Supabase 프로젝트 (또는 직접 띄운 Postgres)
- 열린국회정보 API 키 — https://open.assembly.go.kr 에서 발급

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.example`을 `.env`로 복사하고 값을 채운다.

```bash
cp .env.example .env
```

- `DATABASE_URL` : 런타임용 (Supabase Transaction pooler, port 6543)
- `DIRECT_URL` : 마이그레이션·introspection용 (port 5432)
- `OPEN_ASSEMBLY_API_KEY` : 열린국회정보 인증키
- `ANTHROPIC_API_KEY` : 공약 요약용 (선택, 추후 추가)
- `NEXT_PUBLIC_VWORLD_API_KEY` : VWorld(국토교통부) 한국어 지도 타일 (선택)
  - https://www.vworld.kr/dev/v4api.do 에서 발급
  - 발급 시 사용 도메인 등록 필요 — 로컬은 `localhost`, `127.0.0.1`, `localhost:3000`
  - 비어 있으면 OSM 타일로 자동 fallback (동해/독도 오버레이는 어느 쪽에서도 동작)

### 3. DB 마이그레이션 + 기준 데이터 시드

```bash
# 스키마 적용
npx prisma migrate deploy

# Prisma client 생성
npx prisma generate

# 정당 8개 + 22대 Term 시드 (멱등)
npx prisma db seed
```

### 4. 의원 데이터 동기화

열린국회정보 API에서 22대 현역 의원 명단을 받아 `Politician` / `District` / `PoliticianTerm`을 채운다.

```bash
npx tsx scripts/sync-assembly.ts
```

- 멱등 — 여러 번 돌려도 중복 안 생김
- 약 286명 (사퇴·궐석으로 정원 300에 못 미침)

### 5. 선거구 경계 데이터 (centroid 좌표)

22대 선거구 GeoJSON은 이미 저장소(`public/data/districts-22.geojson`)에 들어 있다 (OhmyNews, MIT). 폴리곤 centroid를 계산해 `District.centerLat/centerLng`에 채운다.

```bash
npx tsx scripts/sync-district-coords.ts
```

### 6. 동네 검색용 행정동 매핑 빌드

`data/admdong-20240401.geojson` (vuski/admdongkor, 34MB)을 받아 행정동 → 22대 선거구 매핑을 생성한다. 이 파일은 `.gitignore`에 들어 있어 clone 시에는 없으므로 직접 받아야 한다.

```bash
# 행정동 GeoJSON 다운로드
mkdir -p data
curl -L \
  "https://raw.githubusercontent.com/vuski/admdongkor/master/ver20240401/HangJeongDong_ver20240401.geojson" \
  -o data/admdong-20240401.geojson

# 행정동 → 선거구 매핑 빌드 (point-in-polygon)
# 결과: src/lib/geo/dong-to-district.json (~520KB, 코드와 함께 커밋됨)
npx tsx scripts/build-dong-mapping.ts
```

매핑 JSON 자체는 코드와 함께 커밋되어 있으므로, **저장소를 갓 clone한 직후라면 이 단계는 생략 가능**하다. 행정동 데이터셋이나 선거구 GeoJSON이 갱신될 때만 재실행하면 된다.

### 7. (선택) 공약 파이프라인 시범

골격이 동작하는지 확인하기 위한 가상 샘플 공약을 한 명 의원에게 시드한다.

```bash
# 표본 의원(이름순 첫 번째 지역구 의원)에 가상 공약 5건 시드
npx tsx scripts/seed-sample-pledges.ts

# (ANTHROPIC_API_KEY가 .env에 있을 때만) Claude로 쉬운말 요약
npx tsx scripts/summarize-pledges.ts
```

요약 스크립트는 `Pledge.easySummary`가 비어 있는 row만 골라 호출하므로 멱등이다. 키가 없으면 안내 출력 후 종료.

실제 의원 공약은 추후 중앙선관위/공공데이터포털에서 일괄 수집해 같은 테이블에 교체할 예정. 샘플은 단순 골격 검증용.

### 8. 개발 서버

```bash
npm run dev
```

http://localhost:3000 에서 확인.

---

## 디렉터리 구조

```
src/
├── app/                    Next.js App Router
│   ├── api/
│   │   ├── politicians/    의원 목록 API
│   │   ├── regions/        시도 집계 API
│   │   └── search/         의원/동네 통합 검색
│   ├── politicians/[monaCd]/  의원 상세 페이지
│   ├── regions/[regionKey]/   시도 명단
│   ├── regions/proportional/  비례대표 명단
│   ├── layout.tsx          글로벌 헤더 + 푸터 + SearchBar
│   └── page.tsx            메인 지도
├── components/
│   ├── map/                KoreaMap · DistrictBoundaries · FocusedPopup
│   ├── politician/         PoliticianCard · PoliticianPhoto
│   └── search/             SearchBar
└── lib/
    ├── db.ts               Prisma client (PrismaPg adapter)
    ├── geo/                centroid · point-in-polygon · district-key · dong-to-district.json
    ├── queries/            region-summary · region-members · politician-pins · politician-detail · search
    └── sources/            열린국회 API 클라이언트

scripts/
├── sync-assembly.ts        열린국회 API → DB 동기화
├── sync-district-coords.ts GeoJSON centroid → District 좌표
├── build-dong-mapping.ts   행정동 → 선거구 매핑 빌드
├── db-stats.ts             DB 통계 출력
├── inspect-districts.ts    District 이름 패턴 점검
└── test-assembly-api.ts    열린국회 API 동작 검증

public/data/
├── districts-22.geojson    22대 선거구 폴리곤 (OhmyNews)
└── districts-22.LICENSE.txt
```

## 데이터 출처

- **의원 정보**: 열린국회정보 (open.assembly.go.kr)
- **의원 사진**: 대한민국 국회 (assembly.go.kr) — *현재 핫링크 차단으로 fallback만 사용*
- **선거구 경계**: OhmyNews `2024_22_elec_map` (MIT License)
- **행정동 경계**: VW-Lab 김승범 `admdongkor` (admdongkor)
- **지도 타일**: © OpenStreetMap contributors

## MVP 범위

- **1단계 (현재)**: 22대 국회의원 300명만. 스키마는 4,300명 전체 직급 수용하도록 일반화돼 있지만 데이터는 국회의원만 시드.
- 4,300명을 한 번에 가면 데이터 소스 4개(열린국회/공공데이터/선관위/공직윤리)를 동시에 붙들어야 해서 스키마 검증이 어렵다는 판단.

## 배포 (Vercel)

```bash
npm run build
```

Vercel에 환경 변수(`DATABASE_URL`·`DIRECT_URL`·`OPEN_ASSEMBLY_API_KEY`)를 등록한 뒤 배포한다. `data/` 디렉터리(34MB 행정동 GeoJSON)는 배포에 포함되지 않으므로, 매핑 JSON(`src/lib/geo/dong-to-district.json`)을 미리 커밋해두면 빌드 시 추가 다운로드가 필요 없다.
