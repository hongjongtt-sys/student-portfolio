/**
 * 활동 자료함 — 드라이브 연결용 Apps Script
 * 학생·선생님이 올린 PDF를 선생님 드라이브 '활동자료함' 폴더에 저장하고, 종합 PDF를 만들 때 꺼내 준다.
 *
 * 배포: 배포 > 새 배포 > 유형 '웹 앱' / 다음 사용자 인증 정보로 실행: 나 / 액세스 권한: 모든 사용자
 * 요청마다 Firebase 로그인 표식(idToken)을 확인한다.
 *  - 선생님(TEACHER_EMAIL)은 모든 작업 가능
 *  - 학생은 접속 코드로 확인된 자기 학번 파일만 올리고 지울 수 있다
 */
const API_KEY = 'AIzaSyDEVJk1GOGjJdBfCJjuMyeXmzzKIw4wlKI';   // Firebase 웹 설정의 apiKey (공개돼도 되는 값)
const PROJECT_ID = 'classboard-4b9da';
const TEACHER_EMAIL = 'hongjongtt@class.com';
const ROOT_NAME = '활동자료함';

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents);
    const who = verify_(b.token);
    let out;
    switch (b.action) {
      case 'ping':
        if (!who.teacher) throw new Error('선생님만 할 수 있어요.');
        out = { folderName: root_().getName() };
        break;
      case 'upload': {
        const no = String(b.no || '');
        if (!/^\d{5}$/.test(no)) throw new Error('학번이 올바르지 않아요.');
        if (!who.teacher && who.no !== no) throw new Error('자기 학번으로만 올릴 수 있어요.');
        const bytes = Utilities.base64Decode(b.data);
        if (bytes.length > 20 * 1024 * 1024) throw new Error('20MB까지 올릴 수 있어요.');
        const head = Utilities.newBlob(bytes.slice(0, 5)).getDataAsString();
        if (head !== '%PDF-') throw new Error('PDF 파일만 올릴 수 있어요.');
        const name = no + '_' + String(b.name || 'file.pdf').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120);
        const f = actFolder_(b.activityId, b.activityTitle).createFile(Utilities.newBlob(bytes, 'application/pdf', name));
        out = { id: f.getId(), url: f.getUrl() };
        break;
      }
      case 'get': {
        if (!who.teacher) throw new Error('선생님만 할 수 있어요.');
        const f = DriveApp.getFileById(b.id);
        out = { data: Utilities.base64Encode(f.getBlob().getBytes()), name: f.getName() };
        break;
      }
      case 'trash': {
        const f = DriveApp.getFileById(b.id);
        if (!who.teacher && f.getName().indexOf(who.no + '_') !== 0) throw new Error('자기 파일만 지울 수 있어요.');
        if (!inRoot_(f)) throw new Error('활동자료함 밖의 파일은 지우지 않아요.');
        f.setTrashed(true);
        out = {};
        break;
      }
      case 'copy': {   // 구글폼 파일 업로드 문항으로 받은 파일을 활동 폴더로 복사 (원본은 그대로)
        if (!who.teacher) throw new Error('선생님만 할 수 있어요.');
        const src = DriveApp.getFileById(b.fileId);
        const no = String(b.no || '');
        const f = src.makeCopy(no + '_' + src.getName(), actFolder_(b.activityId, b.activityTitle));
        out = { id: f.getId(), url: f.getUrl(), name: src.getName(), mime: f.getMimeType() };
        break;
      }
      default:
        throw new Error('알 수 없는 요청이에요.');
    }
    out.ok = true;
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return ContentService.createTextOutput('활동 자료함 드라이브 연결이 켜져 있어요.');
}

/* Firebase 로그인 표식 확인 → {teacher:true} 또는 {no:'20305'} */
function verify_(token) {
  if (!token) throw new Error('로그인이 필요해요.');
  const r = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + API_KEY, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: token }), muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('로그인이 만료됐어요. 새로고침해 주세요.');
  const u = (JSON.parse(r.getContentText()).users || [])[0];
  if (!u) throw new Error('로그인을 확인하지 못했어요.');
  if (u.email === TEACHER_EMAIL) return { teacher: true };
  // 학생: 접속 코드로 확인된 기록(sm_claims/{uid})을 학생 본인 권한으로 읽는다
  const c = UrlFetchApp.fetch('https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/sm_claims/' + u.localId, {
    headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true
  });
  if (c.getResponseCode() !== 200) throw new Error('학번 확인이 안 됐어요. 다시 들어와 주세요.');
  const no = JSON.parse(c.getContentText()).fields.no.stringValue;
  return { no: no };
}

function root_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('ROOT_ID');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const f = DriveApp.createFolder(ROOT_NAME);
  p.setProperty('ROOT_ID', f.getId());
  return f;
}
function actFolder_(activityId, title) {
  if (!activityId) throw new Error('활동이 없어요.');
  const p = PropertiesService.getScriptProperties();
  const key = 'ACT_' + activityId;
  const id = p.getProperty(key);
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) {} }
  const f = root_().createFolder(String(title || '활동').slice(0, 80) + ' (' + activityId + ')');
  p.setProperty(key, f.getId());
  return f;
}
function inRoot_(file) {
  const rootId = root_().getId();
  const parents = file.getParents();
  while (parents.hasNext()) {
    const pf = parents.next();
    if (pf.getId() === rootId) return true;
    const gp = pf.getParents();
    while (gp.hasNext()) if (gp.next().getId() === rootId) return true;
  }
  return false;
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
