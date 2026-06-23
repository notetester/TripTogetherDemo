# TripTogether 데모 배포 자동화 계획

> 이 문서는 `TripTogether(비공개) → TripTogetherDemo(공개)` 데모 발행 자동화 방향을 정리한 것임.
> 데모 레포의 `docs/`는 데모 재생성 시에도 보존되므로(README·docs 보존 정책) 여기에 둠.

## 1. 참고 모델 — CareerTuner → CareerTunerDemo

CareerTuner(비공개)는 소스 레포의 GitHub Actions(`.github/workflows/deploy-demo.yml`)가 데모를 자동 발행함:

1. `dev` 브랜치에 `frontend/**` 푸시 시 트리거
2. 프론트엔드를 **demo 모드로 정적 빌드**: `VITE_DEMO_MODE=true`, `VITE_USE_MOCK=true`, `VITE_PUBLIC_BASE=/CareerTunerDemo/` → mock 데이터로 도는 정적 SPA(`dist/`) 생성
3. **`dist/` 시크릿 스캔** (team1pass·jdbc·JWT·API키·`54.x.x.x` 등 발견 시 배포 중단)
4. `DEMO_REPO_TOKEN`(PAT)으로 공개 CareerTunerDemo 체크아웃
5. **README·docs 빼고 데모 레포 내용 전부 교체** → `dist/` 복사 → `.nojekyll` → commit·push
6. 데모 레포는 Pages로 자동 서빙

즉 **데모 레포 = 소스 CI가 빌드 결과를 강제 발행하는 타깃**. 프론트가 React/Vite SPA라 `build`로 mock 정적 데모가 자연스럽게 나옴.

## 2. TripTogether의 제약

- TripTogether = **Spring Boot + JSP 서버렌더링** → `build → 정적 dist` 단계가 **없음**. JSP는 서버가 있어야 렌더됨.
- 현재 `.github/workflows` 자체가 없음.
- 그래서 CareerTuner의 `deploy-demo.yml`을 1:1 복제 불가. 데모를 "생성"하는 방법이 근본적으로 다름.
- 현재 TripTogetherDemo는 **수작업/세션으로 만든 정적 스냅샷 + `assets/demo-mock.js`** 로 유지 중(2026-06 세션에서 토큰 미치환·인코딩 깨짐·인증폼·BOM 그리드 등 다수 결함 수정함).

## 3. 선택지 비교

| | 방식 | 자동화 | 노력/리스크 |
|---|---|---|---|
| **1 ✅ 채택** | **스냅샷 발행형** — 큐레이트된 정적 스냅샷을 소스 레포에 두고, CI가 시크릿 스캔 후 데모 레포로 내용 교체·푸시 | 발행 자동(생성은 수동 유지) | 중 — CareerTuner 구조에 가장 근접 |
| 2 | 안전 게이트만 — 기존 데모 `pages.yml`에 시크릿 스캔 스텝만 추가 | 현행 유지 + 안전장치 | 소 |
| 3 | 크롤 완전 자동화 — CI에서 앱+DB 띄워 크롤→정제→푸시 | 완전 자동 | 대(매우 무겁고 깨지기 쉬움) |

## 4. 채택안 — 스냅샷 발행형 (Option 1) 설계

### 구조
- 소스 레포(TripTogether)에 **`demo/` 폴더**를 두고 큐레이트된 정적 스냅샷(현재 TripTogetherDemo 내용물)을 보관·유지보수.
- `.github/workflows/deploy-demo.yml` 추가:
  1. `demo/**` 푸시 시 트리거(`dev` 또는 작업 브랜치)
  2. **시크릿 스캔** (`demo/` 대상; CareerTuner 패턴 재사용: `team1pass|team1_user|jdbc:mysql|DB_PASSWORD|JWT_SECRET|...API_KEY|client-secret|54\.[0-9.]+`)
  3. `DEMO_REPO_TOKEN`(PAT)으로 `notetester/TripTogetherDemo` 체크아웃
  4. **README·docs 빼고** 데모 레포 내용 교체 → `demo/` 복사 → `.nojekyll`
  5. commit·push → 데모 레포 `pages.yml`이 자동 배포

### 전제
- GitHub에서 사용자가 **`DEMO_REPO_TOKEN`** 시크릿(데모 레포 push 권한 PAT) 등록 필요.
- 스냅샷을 소스 레포로 이전(현재는 데모 레포에서 직접 유지 중).

### 차이점(vs CareerTuner)
- CareerTuner는 `dist/`(빌드 산출물)를 발행 → TripTogether는 `demo/`(수동 큐레이트 스냅샷)를 발행. **생성 단계만 수동, 발행·시크릿게이트는 자동**.

## 5. 진행 순서 (합의)

1. **(선행) 관리자 페이지 정렬(열 정합) 고질 문제부터 해결** — 로컬 MySQL로 앱 띄워 사람+AI가 같이 조사·수정.
2. 정리된 화면으로 **스냅샷 본뜨기**(재생성).
3. 스냅샷을 소스 레포 `demo/`로 정리 + `deploy-demo.yml` 작성.
4. `DEMO_REPO_TOKEN` 등록 후 발행 자동화 가동.

> 상태: **1번(정렬 문제 해결) 진행 중**. 파이프라인 구축은 그 이후.
