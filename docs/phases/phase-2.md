# Phase 2 — การควบคุมด้วยมือและ undo · เสร็จสิ้น

วันที่: 2026-09-12 · ผลรวม: **typecheck ผ่าน + 140 unit + 27 renderer parity (3 เอนจิน) +
118 e2e ผ่าน, 5 skip โดยตั้งใจ** (clipboard round-trip บน headless Firefox/WebKit
ตาม ADR-003, reorder pixel-swap บน headless WebKit เท่านั้น, Ctrl/Cmd+Shift+C
clipboard round-trip บน headless Firefox/WebKit — เหตุผลเดียวกับ ADR-003)

## วัตถุประสงค์

ให้ผู้ใช้มีทางออกเมื่อ auto-layout จัดวางไม่ตรงใจ — เลือก ย้าย ปรับขนาด ลบ
ทำซ้ำ จัดลำดับชั้น พร้อม undo/redo และ autosave กันงานหาย โดยไม่ทำลาย
"drop แล้วได้ผลลัพธ์ส่งได้ทันที" ที่เป็นแกนของ Phase 1

## สิ่งที่ใช้งานได้แล้ว (9 ข้อ ครบตามแผน)

| # | ฟีเจอร์ | หมายเหตุ |
|---|---|---|
| 1 | ซูม/pan/ตัวบอกระดับซูม/fit-to-view | canvas เปลี่ยนจากขนาดบอร์ดเป็นขนาด viewport |
| 2 | เลือกวัตถุ (click/shift-click/marquee) | `selectedIds` อยู่นอก `Board` เหมือน camera |
| 3 | ย้าย/ปรับขนาด พร้อม snapping และเส้นไกด์ | `setFrames` เป็นจุด commit เดียว ข้าม `relayout()` |
| 4 | สลับเป็น manual ต้องชัดเจน | `layout: 'free'` กันโดย invariant 4 |
| 5 | ลากสลับลำดับในโหมด auto | `reorder()` ไม่เปลี่ยน `layout` |
| 6 | ลบ/ทำซ้ำ/จัดลำดับชั้น | ตรงตาม mockup ผลิตภัณฑ์ 3 ปุ่มพอดี ไม่มีปุ่มเกิน |
| 7 | Undo/redo 50 ขั้น | snapshot ทั้ง `Board`, ไม่ใช่ patch/inverse-op |
| 8 | Autosave ลง IndexedDB | เก็บเป็น `ArrayBuffer` ไม่ใช่ `Blob` (บั๊ก WebKit) |
| 9 | คีย์ลัดครบชุด | หัวข้อของ session นี้ — ดูรายละเอียดด้านล่าง |

## Item 9 — สิ่งที่ทำในรอบนี้

- **`Ctrl/Cmd+Shift+C` สำหรับคัดลอก** — คีย์ลัดเดียวที่ product plan ระบุชื่อไว้ตรง ๆ
  (ปรากฏ 5 ครั้งในเนื้อเรื่อง user journey) ผูกเข้ากับ `BoardCanvas.tsx`'s
  `onKeyDown` แล้ว ปัญหาคือ `onCopy` เดิมเป็น local state ของ `TopBar.tsx`
  (ปุ่ม + ตัวจับเวลา "Copied") ซึ่ง `BoardCanvas` เข้าไม่ถึง — แก้โดยดึงออกมาเป็น
  hook ที่ `src/hooks/useCopyAction.ts` (`useExportRender` สำหรับ render ที่ทั้ง
  copy/download ใช้ร่วมกัน, `useCopyAction` สำหรับ copy + "copied" timer)
  เรียกครั้งเดียวใน `App.tsx` (บรรพบุรุษร่วมของทั้งสอง component) แล้วส่งลงเป็น
  prop — ทั้งปุ่มและคีย์ลัดจึงเห็น state เดียวกัน ไม่ duplicate clipboard call
- **`D` (ทำซ้ำ) และ `F` (นำมาไว้หน้าสุด)** — ตอนจบ item 6 บันทึกไว้ว่า
  Ctrl/Cmd+D ชนกับ browser bookmark shortcut ทุกเบราว์เซอร์หลัก และ item 9 คือ
  จุดที่ต้องตัดสินใจจริง (ไม่ใช่แค่ตั้งสมมติฐาน) — เลือกใช้ **คีย์เดี่ยวไม่มี
  modifier** แทน ตามแบบแผนเดิมของทุกคีย์ลัดใน Phase 2 ยกเว้น undo/redo
  (zoom, Delete, Escape) เพื่อเลี่ยงปัญหาการชนกับคีย์ลัดเบราว์เซอร์ไปเลย
  แทนที่จะไปพิสูจน์ทีละเบราว์เซอร์ว่า `Ctrl+Shift+D`/`Ctrl+Shift+F` ปลอดภัยจริง
  หรือไม่ — `D`=Duplicate, `F`=Front ให้จำง่าย ทั้งสองยังใช้ได้จากปุ่มลอย
  (`SelectionToolbar`) เหมือนเดิม, คีย์ลัดทำงานเมื่อมี selection เท่านั้น
- Tooltip ของปุ่ม Copy/Duplicate/Bring-to-front อัปเดตให้โชว์คีย์ลัดในวงเล็บ
  (`toolbar.copyTitle`, `selection.duplicateTitle`, `selection.bringToFrontTitle`
  ใน `src/i18n/en.ts`) — `aria-label`/ข้อความปุ่มไม่เปลี่ยน เพื่อไม่ให้ e2e
  selector เดิม (`getByRole('button', { name: 'Duplicate' })` ฯลฯ) พัง
- `isTextEntry` (เดิมอยู่แค่ในบล็อก undo/redo) ยกออกมาคำนวณครั้งเดียวต่อ
  keydown แล้วใช้ร่วมกับบล็อก copy ใหม่ — เหตุผลเดียวกับที่ item 7 บันทึกไว้:
  gap slider มัก focus ค้างอยู่ทันทีหลังลาก (จังหวะที่ผู้ใช้มักกด undo/copy
  ต่อ) จึงต้องไม่ถูกกันโดย guard แบบกว้างที่คีย์ลัดไม่มี modifier ใช้
- **ความเสี่ยงที่บันทึกไว้ ยังไม่ยืนยัน:** Chrome/Edge ผูก `Ctrl/Cmd+Shift+C`
  ไว้กับโหมด "Inspect Element" ของ DevTools ที่ระดับ browser chrome ไม่ใช่
  ระดับหน้าเว็บ — หน้าเว็บ `preventDefault()` ได้ แต่ไม่รู้แน่ชัดว่าชนะ
  accelerator ของเบราว์เซอร์จริงหรือไม่ในทุก build เดสก์ท็อป Playwright
  headless ไม่มี DevTools UI ให้สังเกตความขัดแย้งนี้ ต้องพิสูจน์ในเบราว์เซอร์
  จริงเท่านั้น — อยู่ในหมวดเดียวกับ "Real Safari/Chrome ยังไม่ยืนยัน" ที่มีอยู่
  แล้วในหัวข้อ "Not yet verified" ของ CLAUDE.md
- `tests/e2e/shortcuts.spec.ts` (ใหม่) ครอบคลุมทั้งสามคีย์ลัด: Ctrl+Shift+C
  วางของจริงลง clipboard เหมือนปุ่ม Copy (skip บน headless Firefox/WebKit
  แบบเดียวกับ `clipboard.spec.ts`), `D` ทำซ้ำโหนดที่เลือกและไม่ทำอะไรถ้าไม่มี
  selection, `F` นำโหนดที่เลือกไว้ด้านหน้า — ใช้เทคนิคเดิมจาก
  `selectionActions.spec.ts` (fixture เป็น gradient ไม่ใช่สีล้วน จึงต้อง
  เทียบพิกเซลจุดเดิมก่อน/หลัง ไม่เทียบกับสีที่คำนวณไว้ล่วงหน้า)

## Definition of Done

| # | เกณฑ์ | สถานะ |
|---|---|---|
| 1 | ฟีเจอร์ใน scope ทำงานตาม acceptance criteria | ✅ ครบ 9 ข้อ |
| 2 | typecheck ผ่านไม่มี warning | ✅ |
| 3 | unit + renderer parity + e2e ผ่านทั้ง 3 เอนจิน | ✅ 285/290 (5 skip โดยตั้งใจ) |
| 4 | ทดสอบด้วยมือบน Windows/Chrome และ macOS/Safari | ⚠️ **ยังไม่ได้ทำ** — ดูด้านล่าง |
| 5 | ไม่มี regression | ✅ ชุดทดสอบ Phase 1 ยังผ่านหมด |
| 6 | อยู่ในงบประมาณประสิทธิภาพ วัดจริง | ✅ (วัดไว้ตั้งแต่ item 1–8, ไม่มีอะไรใน item 9 แตะ render path) |
| 7 | ทุกสถานะมี feedback, error เป็นภาษาคน | ✅ |
| 8 | ไม่มี network request ใหม่, ไม่มี input ผู้ใช้เข้า DOM เป็น HTML | ✅ |
| 9 | เอกสารสรุป phase | ✅ ไฟล์นี้ |
| 10 | Deploy ขึ้น preview และลองใช้งานจริงอย่างน้อย 1 งาน | ⚠️ **ยังไม่ push/deploy รอบนี้** — โค้ด commit แล้วในเครื่องเท่านั้น |
| 11 | แจ้งสรุปและระบุขั้นต่อไป แล้วรอไฟเขียว | ✅ ดูหัวข้อถัดไป |

Phase 2's เกณฑ์เพิ่มเติมที่ CLAUDE.md ตั้งไว้เอง — "ลาก 10 รูปยังลื่นที่ 60fps"
(วัดแล้วตอน item 1/5), "undo ย้อนได้ 50 ขั้น" (item 7), "ปิด-เปิดแท็บแล้วบอร์ด
ยังอยู่" (item 8), "ทุก action มีคีย์ลัด" (item 9, รอบนี้) — **ครบทั้งสี่ข้อแล้ว**

## สิ่งที่ยังทำไม่ได้ และต้องพูดให้ชัด

1. **ยังไม่ได้ push source ขึ้น `main` และยังไม่ได้ deploy ขึ้น live site**
   สำหรับงานของ session นี้ (item 9) — ทั้งสองคำสั่งพร้อมใช้
   (`git push origin master:main` / `bash scripts/deploy-pages.sh`) แต่เป็นงาน
   ที่กระทบคนนอกจึงรอให้ผู้ใช้สั่งก่อนตามกฎเดิม
2. **ยังไม่ได้ยืนยัน `Ctrl/Cmd+Shift+C` บนเบราว์เซอร์เดสก์ท็อปจริง** ว่าชนะ
   DevTools inspect-element accelerator ของ Chrome/Edge หรือไม่ — จุดนี้ควร
   เป็นส่วนหนึ่งของรอบทดสอบมือที่ยังไม่ได้ทำ (ดูข้อถัดไป)
3. **Manual test checklist ส่วน E (robustness) และ F (privacy) ยังไม่ได้รัน**
   (บันทึกไว้ตั้งแต่ก่อน Phase 2 เริ่ม) และ Real Safari/Firefox/มือถือยังไม่ได้
   ยืนยันทีละตัว — ทั้งหมดนี้เป็นเงื่อนไขเดิมที่ค้างมาตั้งแต่ต้น Phase 2
   ไม่ใช่สิ่งใหม่จาก item 9
4. **มือถือยังต้อง scroll แนวนอนเพื่อกด top bar** — พบระหว่าง manual test
   ก่อน Phase 2 เริ่ม ยังไม่ถูกแก้ (ตั้งใจเก็บไว้ทำพร้อม/หลัง Phase 5 polish)

## ขั้นต่อไป — Phase 3

ตามลำดับที่ CLAUDE.md วางไว้: **Export hardening** — 1x/2x/3x, JPG,
cross-browser fallback ก่อนเริ่ม Phase 3 ควรให้ผู้ใช้ยืนยันว่าจะ push/deploy
งาน Phase 2 (item 9) ขึ้น live site ก่อนหรือไม่ และพิจารณาว่าจะปิดช่องว่างข้อ 2–3
ด้านบน (ทดสอบมือจริง) ก่อนเริ่มงานใหม่หรือไม่ เพราะเป็นเงื่อนไขเดียวที่ยังค้าง
จาก Definition of Done ข้อ 4/10
