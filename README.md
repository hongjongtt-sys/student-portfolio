# 활동 자료함 설치 안내

학생 활동 자료(답·PDF)를 학번별로 모으는 앱입니다. 우리 반 게시판과 같은 Firebase 프로젝트(classboard-4b9da)를 쓰고, 이 앱의 자료는 모두 `sm_`로 시작하는 새 컬렉션에만 저장됩니다. 게시판의 기존 자료는 건드리지 않습니다.

## 1. Firebase 콘솔에서 두 가지 켜기 (한 번만)

1. **익명 로그인 켜기**: Firebase 콘솔 → classboard-4b9da → Authentication → 로그인 방법(Sign-in method) → **익명** → 사용 설정 → 저장.
   학생은 비밀번호 없이 익명으로 들어온 뒤, 학번과 6자리 접속 코드로 본인 확인을 합니다.
2. **보안 규칙 추가**: Firestore Database → 규칙. **지금 있는 규칙은 지우지 말고**, 마지막 `}` 두 개 바로 위(다른 `match` 블록들 옆)에 아래를 붙여 넣고 [게시]를 누릅니다.

```
    // ── 활동 자료함 (sm_) ──
    function smTeacher() { return request.auth != null && request.auth.token.email == 'hongjongtt@class.com'; }
    function smMyNo() { return get(/databases/$(database)/documents/sm_claims/$(request.auth.uid)).data.no; }
    function smHasClaim() { return request.auth != null && exists(/databases/$(database)/documents/sm_claims/$(request.auth.uid)); }

    match /sm_config/{d} {
      allow read: if request.auth != null;
      allow write: if smTeacher();
    }
    match /sm_activities/{d} {
      allow read: if request.auth != null;
      allow write: if smTeacher();
    }
    match /sm_roster/{d} {
      allow read, write: if smTeacher();
    }
    match /sm_claims/{uid} {
      allow read: if smTeacher() || (request.auth != null && request.auth.uid == uid);
      allow create, update: if request.auth != null && request.auth.uid == uid
        && get(/databases/$(database)/documents/sm_roster/$(string(request.resource.data.year) + '_' + request.resource.data.no)).data.code == request.resource.data.code;
      allow delete: if smTeacher() || (request.auth != null && request.auth.uid == uid);
    }
    match /sm_subs/{d} {
      allow read: if smTeacher() || (smHasClaim() && (resource == null || resource.data.no == smMyNo()));
      allow create, update: if smTeacher() || (smHasClaim()
        && request.resource.data.no == smMyNo()
        && request.resource.data.by == 'student'
        && d == request.resource.data.activityId + '__' + smMyNo());
      allow delete: if smTeacher();
    }
```

규칙을 붙인 뒤 화면 맨 위에 빨간 오류가 없으면 됩니다. 오류가 나면 규칙 전체를 복사해서 Claude에게 보여 주세요.

## 2. 드라이브 연결 (Apps Script, 한 번만)

학생이 낸 PDF는 선생님 구글 드라이브의 **활동자료함** 폴더에 활동별로 쌓입니다.

1. https://script.google.com → 새 프로젝트 → 이름 '활동 자료함 드라이브'.
2. `Code.gs` 내용을 통째로 붙여 넣고 저장.
3. 배포 → 새 배포 → 유형 **웹 앱** → 다음 사용자 인증 정보로 실행: **나** → 액세스 권한: **모든 사용자** → 배포.
4. 권한 허용 창이 뜨면 선생님 계정으로 허용(드라이브 파일 만들기·외부 요청 권한).
5. 나온 **웹 앱 주소**(…/exec)를 복사해서, 앱의 [명단·설정] → ③ 드라이브 연결에 붙여 넣고 [연결 확인].

Code.gs를 고친 뒤에는 '배포 관리 → 수정 → 새 버전'으로 다시 배포해야 반영됩니다(주소는 그대로).

## 3. 처음 쓰는 순서

1. 주소 끝에 `?t=1`을 붙여 들어가 선생님 계정(게시판과 같은 계정)으로 로그인.
2. [명단·설정] → 나이스 명단 엑셀을 끌어놓기. 담임반, 수업반(반마다 하나씩), 동아리 명단을 모두 넣습니다. 학생마다 6자리 접속 코드가 생깁니다.
3. 명단 줄의 [코드표 인쇄]로 학생에게 나눠 줄 쪽지를 뽑습니다(학번·이름·코드).
4. 자율·진로·동아리·교과 탭에서 [+ 새 활동 만들기] → 질문(또는 질문지 엑셀·PDF 올리기), 대상 반, 마감, PDF 받기 여부.
5. [QR 띄우기]로 학생에게 보여 주거나 주소를 카톡으로 보냅니다.
6. 메일·카톡·구글폼으로 받은 자료는 [자료 들이기]로 넣습니다. 파일 이름을 `20305_보고서.pdf`처럼 학번으로 시작하게 하면 여러 개를 한 번에 나눠 넣습니다.
7. [학생별] 탭이나 활동 화면에서 [종합 PDF]·[엑셀]을 내려받아 Claude에 올립니다. '이름 빼고 학번만'이 기본입니다.

## 알아 둘 점

- 파일은 **PDF만** 받습니다(20MB까지). 한글·PPT는 'PDF로 저장', 사진은 'PDF로 인쇄'.
- 학생은 한 번 들어오면 그 폰에서는 다시 묻지 않습니다. 코드를 잊으면 선생님이 코드표를 다시 보면 됩니다.
- 마감이 지나면 학생은 고칠 수 없고, 선생님은 언제든 넣고 지울 수 있습니다.
- 새 학년도에는 [명단·설정] → ④ 학년도를 바꾸면 새로 시작하고, 지난 학년도 자료는 그대로 남습니다.
- 스캔한 PDF는 글을 뽑을 수 없어 '글 없음'으로 표시되지만, 종합 PDF에는 그대로 붙고 Claude는 그림으로 읽습니다.
