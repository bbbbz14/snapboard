# Phase 5 — ความประณีต (polish) · เสร็จสิ้นทั้ง 11 item (9 ทำ, 1 ยกเลิก, 1 ทำ)

วันที่: 2026-09-14 · ผลรวมล่าสุด: **typecheck ผ่าน + 243 unit + 33 renderer
parity (3 เอนจิน) + 312 e2e ผ่าน 307, 5 skip โดยตั้งใจ** (เหตุผลเดิมทั้งหมด -
clipboard round-trip บน headless Firefox/WebKit ตาม ADR-003 x2, shortcuts
Ctrl/Cmd+Shift+C บน headless Firefox/WebKit x2 เหตุผลเดียวกัน, และ reorder
pixel-swap บน headless WebKit เท่านั้น)

## วัตถุประสงค์

ทำให้แอปรู้สึก "premium" ตามคำจำกัดความของ product plan เอง ไม่ใช่ "เครื่องมือ
ฟรีบนเว็บ" - ต่างจาก Phase 2-4 ที่มี mockup ชัดเจน product plan §12 ให้รายการ
Phase 5 มาแบบไม่มีลำดับ/mockup บังคับ ลำดับการสร้าง 11 item ด้านล่างเป็นการ
ตัดสินใจของ CLAUDE.md เอง (item ที่หลังพึ่งพา item ที่มาก่อน)

## Item 1–9: design system, dark mode, overflow fix, gradients, a11y,
error copy, context menu, help modal, animation

ทำไปแล้วในเซสชันก่อนหน้าทั้งหมด (item 1 = `132126d`, item 2 = `87fd9df`, item 3
= `aebdbd2`, item 4 = `a8007b5`, item 5 = `2d3f789`, item 6 = `62094db`,
items 7+8 = `99124a1`, item 9 = `efbf37e`) - commit, push ขึ้น `main`, และ
deploy ขึ้น live site แล้วทุก item ก่อนเซสชันนี้เริ่ม รายละเอียดทุกการตัดสินใจ
(เช่น ทำไม token แยกกลุ่ม chrome/board-content, บั๊กจริงที่ `useFocusTrap`,
ทำไม popover ทั้งสามใช้ focus trap เดียวกัน ฯลฯ) อยู่ใน CLAUDE.md ใต้
"START HERE" ครบถ้วนแล้ว ไม่ทวนซ้ำที่นี่ นอกจากนี้ยังมีงานนอกแผน 3 รอบที่ทำ
ระหว่างเดินไปตาม item เหล่านี้ (การแก้บั๊กจากการใช้งานจริงของผู้ใช้บน live site,
3 ส่วนของ "annotation revision" ที่เปิด scope สีและขนาดใหม่ให้ทุก annotation
tool) - รายละเอียดทั้งหมดก็อยู่ใน CLAUDE.md เช่นกัน

## Item 10 — ยกเลิก: i18n ไทย/อังกฤษ

ผู้ใช้ตัดสินใจชัดเจน (2026-09-14) ว่าไม่ต้องแปล UI เป็นไทย ใช้อังกฤษล้วนพอ -
ยกเลิกออกจากแผน ไม่ใช่ "ยังไม่ทำ" โครง `src/i18n/en.ts` (single source ของ
ทุก string ที่ผู้ใช้เห็น) ยังอยู่เหมือนเดิม แต่ไม่ใช่เพราะ item นี้โดยเฉพาะ - เป็น
วิธีจัดการ copy ของโปรเจกต์นี้อยู่แล้วตั้งแต่ Phase 1

## Item 11 — ใหม่ในเซสชันนี้: mobile lite mode

### การตัดสินใจแรกที่ต้องทำก่อนเขียนโค้ด: scope คืออะไรจริง ๆ

CLAUDE.md's Phase 5 list เดิมอธิบาย item 11 ว่าเป็น "ส่วนที่เหลือ" ของ item 3's
overflow fix - งาน responsive แบบทั่วไปที่ใหญ่กว่า แต่ product plan §4.6 นิยาม
ไว้แคบกว่ามาก: "MVP: desktop-first ชัดเจน. บนมือถือ: แสดงโหมด lite = เลือกรูป
→ เลือกโหมดจัดวาง → บันทึกภาพ (ไม่มีการย้ายอิสระ) เหตุผล: การลาก-ย่อ-ขยายบน
จอเล็กคือ UX ที่แย่เสมอ" - อ่าน spec จริงก่อนเขียนโค้ด แล้วเลือกทำตาม scope
ที่แคบกว่านี้ เพราะตรงกับที่ product plan เขียนไว้ชัด และเลี่ยงงานใหญ่ที่ไม่มี
ใครขอ (สร้าง touch gesture ใหม่ทั้งหมดสำหรับ pan/zoom/select/move/resize)

### สิ่งที่สร้างใหม่

- **`BoardCanvas` เพิ่ม prop `interactive` (default `true`)** - ปิด effect
  ทุกตัวที่มีไว้เพื่อรองรับการแก้แบบอิสระเท่านั้น: wheel effect (pan/zoom/
  ปรับขนาด tool), space/middle-drag pan effect, pointer effect ใหญ่ตัวเดียว
  (select/marquee/move/resize/reorder/วาง annotation), และ keyboard-shortcut
  effect. `onDoubleClick`/`onContextMenu` (แก้ข้อความซ้ำ, right-click menu)
  ก็ถูกปิดด้วย เมื่อ `false` จะไม่ mount `SelectionToolbar`/`CropToolbar`/
  `ContextMenu`/`ZoomControls`/`AnnotationToolbar` เลย เพราะไม่มีทางเกิด
  selection/armed tool/crop session ขึ้นได้อยู่แล้ว `draw()`/`drawInteraction()`
  ไม่ต้องแก้อะไรเลย - แค่วาดตามค่าที่มีอยู่ และ `autoFitRef` (true โดย default,
  ถูกปิดเฉพาะโดย handler ที่ตอนนี้ถูกปิดไปแล้ว) ทำให้กล้อง fit จอเสมอโดยไม่ต้อง
  เขียนโค้ดเพิ่ม
- **`TopBar`/`EmptyState`/`ExportMenu`/`BackgroundMenu` ไม่ต้องแก้เลย** -
  ของเดิม (เลือก layout/style/gap/background + ปุ่ม Download/Copy) ตอบโจทย์
  flow "lite" พอดีหลังจากตัด canvas interaction ออก และ item 3 ทำให้บาร์นี้
  scroll แนวนอนได้แล้วตั้งแต่ก่อนหน้านี้
- **`src/hooks/useIsMobile.ts` (ใหม่)** - `window.matchMedia('(max-width:
  700px)')` แบบ live (ไม่ใช่เช็คครั้งเดียวตอน mount, ไม่ sniff user-agent)
  `App.tsx` ส่ง `interactive={!isMobile}` ให้ `BoardCanvas`
- **CSS bump เล็ก ๆ** (`@media (max-width: 700px)`) ให้ `.chip`/`.btn`/
  `.split-btn__caret` ใหญ่ขึ้นพอสำหรับกดด้วยนิ้ว - ไม่แตะ control อื่นที่ไม่ใช่
  ทางผ่านหลักของ flow lite (เช่น swatch 24px ใน popover)
- **ตรวจด้วยตาจริงผ่าน Playwright ที่ viewport 390×844** - บอร์ด, popover
  Background, popover Export ทั้งหมด render ถูกต้องไม่ล้นจอ ยืนยันว่า
  `position: fixed`-จาก-anchor-จริงที่ item 3/4 ทำไว้แล้วรองรับจอแคบได้เลย
  โดยไม่ต้องแก้อะไร
- **`tests/e2e/mobileLite.spec.ts` (ใหม่, 3 เคส × 3 เอนจิน = 9)** - ยืนยันว่า
  `.zoom-controls`/`.annotation-toolbar`/`.selection-toolbar` ไม่ mount เลย,
  ปุ่ม layout/style/background/export ทั้งหมดกดได้; คลิกและลากจริงบนบอร์ด (ท่า
  เดียวกับที่ `selection.spec.ts`/`moveResize.spec.ts` พิสูจน์ว่า select/move ได้
  ตอนจอกว้าง) ไม่ทำอะไรเลย (สแกน pixel เดิมก่อน/หลังด้วยเทคนิคเดียวกับ
  `moveResize.spec.ts`); และ flow เต็ม (เลือก 3 รูป → เลือก Grid → Download)
  ได้ไฟล์จริง

### สิ่งที่ตัดโดยตั้งใจ ตามขนาดที่ product plan §4.6 ต้องการเท่านั้น

- **ไม่มี touch gesture ใด ๆ** (pinch-zoom, two-finger pan, long-press) -
  lite mode ไม่มีกล้องให้ผู้ใช้ควบคุมและไม่มีการแก้ต่อ node ให้ทำ gesture กับ
  จึงไม่มีอะไรให้ gesture ทำ
- **ไม่มี UI มือถือแยกชุด** สำหรับ `TopBar`/`EmptyState`/`ExportMenu`/
  `BackgroundMenu` - ของเดิมตอบโจทย์ได้พอดีแล้ว สร้างซ้ำจะเป็น speculative
  surface ตามที่ CLAUDE.md บอกไม่ให้ทำ
- **ไม่มี UA sniffing หรือ route มือถือแยก** - `App.tsx` เดิมตัวเดียว render
  ทั้งสองโหมด สลับตาม viewport width สด ๆ เท่านั้น
- **ไม่แก้กลไก annotation/crop/undo/redo เอง** - ยังทำงานเหมือนเดิมทุกอย่างที่
  จอกว้าง `interactive` แค่ปิดมันตอนจอแคบ ไม่เปลี่ยนพฤติกรรมตอนเปิด

## Definition of Done

| # | เกณฑ์ | สถานะ |
|---|---|---|
| 1 | ทุก item ใน Phase 5 list ปิดสถานะ (ทำ/ยกเลิกอย่างมีเหตุผล) | ✅ 1-9 ทำ, 10 ยกเลิกโดยผู้ใช้, 11 ทำ |
| 2 | typecheck ผ่านไม่มี warning | ✅ |
| 3 | unit + renderer parity + e2e ผ่านทั้ง 3 เอนจิน | ✅ 243 unit + 33 parity + 307/312 e2e (5 skip โดยตั้งใจ, เหตุผลเดิมทั้งหมด) |
| 4 | 5 ผู้ใช้ใหม่เข้าใจแอปภายใน 10 วินาทีโดยไม่ต้องอธิบาย | ⬜ ต้องใช้คนจริง - ทำจากใน environment นี้ไม่ได้ |
| 5 | Lighthouse a11y > 95 | ⬜ Lighthouse ไม่ได้ติดตั้งใน environment นี้ - item 5 ปิด 4 ช่องว่างที่วัดได้ด้วยวิธีอื่นแล้ว แต่ยังไม่มีตัวเลขจริงจากเครื่องมือนี้ |
| 6 | ไม่มี regression | ✅ ชุดทดสอบ Phase 1-4 และ item 1-10 (ก่อนหน้า) ยังผ่านหมด |
| 7 | เอกสารสรุป phase | ✅ ไฟล์นี้ |
| 8 | Deploy ขึ้น live site | ✅ push+deploy สำเร็จพร้อม commit `84d0383` (item 11) |

## ขั้นต่อไป

Phase 5 เสร็จ "functionally" แล้วทุก item (9 ทำ + 1 ยกเลิกอย่างมีเหตุผล + 1 ทำ
ในเซสชันนี้) เหลือแค่ 2 เกณฑ์ที่ต้องใช้คนจริง/เครื่องจริง (Time-To-Copy กับผู้ใช้
ใหม่ 5 คน, Lighthouse a11y > 95 บนเครื่องจริง) ซึ่งทำจาก environment
อัตโนมัตินี้ไม่ได้ - เหมือนกับ Phase 3's Slack/LINE/Jira/... paste table ที่ยัง
ค้างอยู่ ทั้งสามอย่างนี้เป็น process gate ไม่ใช่ฟีเจอร์ที่ขาด

Phase 6 (persistence และ PWA) และ Phase 7 (Chrome extension) เป็นขั้นต่อไป
ตามลำดับใน `docs/00-product-plan.md` §12 - ยังไม่มี item breakdown ละเอียด
ใน CLAUDE.md เหมือน Phase 2-5 ควรเขียนแบบเดียวกับที่ไฟล์นี้และไฟล์ phase อื่น ๆ
ทำมา ก่อนเริ่มลงมือจริง
