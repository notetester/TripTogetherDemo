# TripTogether — 라이브 데모

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-2ea44f?logo=github)](https://notetester.github.io/TripTogetherDemo/)
![Java](https://img.shields.io/badge/Java-21-orange?logo=openjdk)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.0-6db33f?logo=springboot&logoColor=white)
![MyBatis](https://img.shields.io/badge/MyBatis-3-red)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479a1?logo=mysql&logoColor=white)
![JSP](https://img.shields.io/badge/View-JSP%2FJSTL-555)

**TripTogether**는 여행지 탐색·AI 추천·여행 코스 작성·커뮤니티·여행 패키지 예약·포인트 상점·지갑/보상·관리자 운영을 하나로 묶은 **Spring Boot 기반 통합 여행 플랫폼**입니다.

이 저장소는 그 화면들을 **백엔드 없이 둘러볼 수 있는 데모**를 GitHub Pages로 서비스합니다. 원본은 API 키가 포함된 비공개 저장소라 공개할 수 없어, 실제 화면을 렌더링한 정적 스냅샷에 가상의 목(mock) 데이터를 입혀 게시했습니다.

### ▶ 바로 체험하기 → <https://notetester.github.io/TripTogetherDemo/>

## 데모 이용 방법

1. 위 링크로 접속합니다.
2. 홈 → 여행지 탐색 → 패키지 → 커뮤니티 → 마이페이지 순으로 둘러보세요.
3. 로그인 화면에서는 **아무 값이나 입력**하면 데모 계정으로 넘어갑니다.

> 모든 데이터는 가상의 목(mock) 데이터이며, 서버 호출 없이 브라우저 안에서만 동작합니다.
> 저장·결제·로그인 등 백엔드 처리는 동작하지 않으며, 일부 화면은 *"데모에 포함되지 않았습니다"* 안내가 표시될 수 있습니다.

## 데모에서 볼 수 있는 것

| 영역 | 내용 |
| --- | --- |
| 홈 / 탐색 | 추천 패키지·여행지 배너, 여행지 목록과 상세(리뷰·지도·이미지) |
| 여행 패키지 | 패키지 목록·상세, 가격/일정/판매자 정보 |
| 커뮤니티 | 여행 후기·꿀팁 게시판, 게시글·댓글·태그·좋아요 |
| 여행 코스 | 직접/AI 작성 여행 일정과 방문지 |
| 마이페이지 | 예약 내역, 캐시·마일리지 지갑, 포인트 내역, 알림 |
| 포인트샵 | 닉네임 색상·뱃지·쿠폰 등 포인트 교환 아이템 |
| 관리자 | 회원/신고/문의/판매자 신청/상품 관리 운영 화면 |
| 보안 | 회원·IP 차단, 로그인 위험 탐지, AI 모더레이션 |

## 기술 스택 (원본)

| 영역 | 기술 |
| --- | --- |
| Language | Java 21 |
| Backend | Spring Boot 4.0, Spring MVC, Spring Security |
| Persistence | MyBatis 3, MySQL 8.0 |
| View | JSP, JSTL, Spring Message Tag (i18n) |
| 외부 연동 | OAuth(카카오/네이버/구글), Toss Payments, Cloudinary, Google Maps, Gemini/Claude/OpenAI, GCP Translate |

## 이 저장소에 대하여

- 비공개 원본 저장소의 화면을 렌더링한 **정적 스냅샷 + 목 데이터**입니다. 서버 소스 코드는 포함되어 있지 않습니다.
- 게시 전 자격증명·내부 주소 등 민감정보 포함 여부를 검사한 뒤 배포합니다.
- 이 저장소로의 직접 기여(이슈/PR)는 받지 않습니다.
