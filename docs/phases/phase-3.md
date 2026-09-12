# Phase 3 — Export ระดับโปรดักชัน · เสร็จสิ้น (ยกเว้น DoD ที่ต้องใช้มือทดสอบจริง)

วันที่: 2026-09-12 · ผลรวม: **typecheck ผ่าน + 151 unit + 27 renderer parity
(3 เอนจิน) + 139 e2e ผ่าน, 5 skip โดยตั้งใจ** (เหตุผลเดิมทั้งหมด - clipboard
round-trip บน headless Firefox/WebKit ตาม ADR-003 x2 และ reorder pixel-swap
บน headless WebKit เท่านั้น)

## วัตถุประสงค์

ทำให้ทางออกของผลิตภัณฑ์ (export) เชื่อถือได้ 100% - ให้ผู้ใช้เลือกขนาด/
รูปแบบไฟล์ได้ พร้อมรู้ขนาดผลลัพธ์ก่อนกดจริง โดยไม่แตะพฤติกรรม Copy ซึ่งยังต้อง
เป็นทางลัดที่เร็วและไม่ต้องตัดสินใจอะไรเลย (invariant เดิมของผลิตภัณฑ์)

## สิ่งที่พบก่อนเริ่ม: ส่วนใหญ่ของ scope Phase 3 มีอยู่แล้วตั้งแต่ Phase 1

ตรวจโค้ดก่อนเขียนแล้วพบว่า `exportBoard.ts` (Phase 1) รองรับ `scale: 1|2|3`,
`format: 'image/png'|'image/jpeg'` พร้อม `quality`, `resolveScale()` +
`SAFE_PIXEL_AREA` (guard ขนาด canvas, unit-tested รวมเคส 20000×20000 ใน
`tests/unit/export.test.ts`, มาจาก ADR-005), พื้นหลังโปร่งใสสำหรับ PNG, เติม
พื้นขาวให้ JPEG อัตโนมัติ, และ `exportFilename()` ที่ตั้งชื่อไฟล์แบบมีความหมาย
(`snapboard-2026-09-10-1432.png`) ครบทุกอย่างนี้อยู่แล้ว - เหลือแค่ **ไม่มี UI
ให้ผู้ใช้เลือก** เพราะ `useExportRender`/`TopBar`'s เดิม hardcode ไว้ที่
`{ scale: 2, format: 'image/png' }` เสมอ

Clipboard fallback (ADR-003, `clipboard.spec.ts`) และคีย์ลัดคัดลอก (Phase 2
item 9) ก็ครบอยู่แล้วเช่นกัน - "fallback ทุกเบราว์เซอร์" และ "คัดลอกด้วยคีย์ลัด"
ในรายการฟีเจอร์ Phase 3 จึงไม่ต้องทำอะไรใหม่

**งานจริงของรอบนี้จึงเหลือแค่สองข้อ:** ให้ผู้ใช้เลือก 1x/2x/3x + PNG/JPG +
คุณภาพ และแสดงขนาดผลลัพธ์ก่อน export

## สิ่งที่สร้างใหม่

- **`src/ui/ExportMenu.tsx`** - popover เล็ก ๆ เปิดจากปุ่ม caret (`▾`) ข้าง
  Download กลายเป็น **split button** (`Download` | `▾`) แทนปุ่มเดียว: คลิก
  `Download` ยังคง export ทันทีด้วยค่าที่เลือกไว้ล่าสุดเหมือนพฤติกรรมเดิม
  (default 2x/PNG เท่ากับของเก่า) ส่วน caret เปิด/ปิด popover สำหรับ *ปรับ*
  ค่านั้นเท่านั้น ไม่มีปุ่ม "ยืนยัน" ซ้อนอยู่ข้างในอีกชั้น
- **เหตุผลที่ Copy ไม่ได้ตัวเลือกพวกนี้เลย:** `copyImageToClipboard`
  (`clipboard.ts`) เขียนลง `ClipboardItem` ด้วย MIME `'image/png'` ตายตัว -
  Clipboard API ของเบราว์เซอร์ไม่รองรับ JPEG แน่นอนข้าม engine ดังนั้น
  scale/format เป็นตัวเลือกที่มีความหมายกับ Download (ไฟล์) เท่านั้น ไม่ใช่กับ
  Copy (คลิปบอร์ด) - Copy ยังคงเป็นทางลัดที่เร็วที่สุด ไม่มีอะไรให้ตัดสินใจ
  ตรงตามที่ product plan วางบทบาทสองปุ่มนี้ไว้ต่างกัน
- Popover แสดง: **Format** (PNG/JPG, reuse `.group`/`.chip` เดิม), **Size**
  (1x/2x/3x, ปุ่มชุดเดียวกัน), **Quality** slider (โชว์เฉพาะตอนเลือก JPG,
  0.5-1.0, default 0.92 - ตรงกับ default เดิมของ `exportBoard`), และบรรทัด
  ประมาณขนาดผลลัพธ์เป็นพิกเซล (`estimatePixels`/`resolveScale` ตัวเดียวกับที่
  `exportBoard` ใช้จริงตอน export - ไม่มีตรรกะซ้ำสองที่ที่อาจเพี้ยนจากกัน)
  พร้อมคำเตือนถ้าค่าที่ขอไว้จะถูกลดสเกลลงเพราะเกิน `SAFE_PIXEL_AREA`
- ปิด popover ได้ทั้งคลิกนอกกล่องและ Escape (listener แยกของตัวเอง เปิดเฉพาะ
  ตอน popover เปิดอยู่ ไม่ปนกับ guard คีย์ลัดหลักใน `BoardCanvas.tsx`)
- **ทำไมเป็น popover ไม่ใช่ dropdown ถาวรในบาร์:** top bar มือถือ overflow อยู่
  แล้ว (finding เดิมก่อน Phase 2) เพิ่มปุ่มถาวรอีก 2-3 กลุ่มจะยิ่งแย่ - caret
  เดียวที่ resting state แล้วเปิด popover ตามต้องการ กระทบความกว้างบาร์น้อย
  ที่สุด สอดคล้องกับที่ `ZoomControls`/`SelectionToolbar` เลือกอยู่นอกบาร์
  ด้วยเหตุผลเดียวกัน
- `TopBar.tsx`'s `onDownload` เปลี่ยนจากเรียก `useExportRender()` (fixed
  2x/PNG) เป็นเรียก `exportBoard(toRenderInput(board), exportOpts)` ตรง ๆ
  ด้วยค่าจาก popover - `useExportRender`/`useCopyAction` ไม่แตะ ยังใช้กับ
  Copy เหมือนเดิมทุกจุด
- `tests/e2e/exportOptions.spec.ts` (ใหม่, 3 เคส × 3 เอนจิน = 9): popover
  เปิด/ปิดถูกที่ (caret, outside-click, Escape); quality slider โผล่เฉพาะ
  ตอนเลือก JPG และไฟล์ที่ดาวน์โหลดจริงเป็น JPEG จริง (เช็ค SOI marker `0xFFD8`
  ไม่ใช่แค่เช็คนามสกุลไฟล์); **ตัวเลขที่ popover โชว์ตรงกับขนาดพิกเซลจริงของ
  ไฟล์ที่ดาวน์โหลดออกมา** ทั้งที่ 1x และ 3x (อ่าน width/height ตรงจาก IHDR chunk
  ของ PNG โดยไม่ต้อง decode เต็มรูป) - นี่คือเคสที่พิสูจน์ "แสดงขนาดผลลัพธ์ก่อน
  export" ตรงกับของจริง ไม่ใช่แค่เลขที่ UI คำนวณเอาเองแยกจากของจริง

## สิ่งที่ไม่ต้องทำใหม่ (และทำไม)

- **Guard ขนาด canvas 15000px ไม่ crash** - ไม่เพิ่ม e2e ใหม่ที่ต้อง decode
  ภาพหลักสิบล้านพิกเซลจริงเพื่อพิสูจน์: `resolveScale()`'s unit test ครอบคลุม
  เคส 20000×20000 อยู่แล้ว และ `SAFE_PIXEL_AREA` (100MP) มาจากค่าที่วัดจริงข้าม
  เบราว์เซอร์ไว้แล้วใน ADR-005 (268MP Chromium/WebKit, 537MP Firefox) - เพิ่ม
  e2e หนักๆ ตรงนี้จะพิสูจน์สิ่งที่พิสูจน์แล้วซ้ำ ไม่ได้ปิดช่องว่างใหม่จริง
- **ไม่persist ค่า format/scale/quality ข้าม session** - ไม่มีที่ไหนในแผน
  ผลิตภัณฑ์ขอสิ่งนี้ และ camera/selection ก็ตั้งใจไม่ผูกกับ persistence
  เหมือนกัน (เหตุผลเดิม: เป็น UI preference ชั่วคราว ไม่ใช่เนื้อหาบอร์ด) -
  ค่าเริ่มต้นทุก session คือ 2x/PNG เหมือนพฤติกรรม Download เดิมก่อน Phase 3
  ทุกประการ

## Definition of Done

| # | เกณฑ์ | สถานะ |
|---|---|---|
| 1 | ฟีเจอร์ใน scope ทำงานตาม acceptance criteria | ✅ |
| 2 | typecheck ผ่านไม่มี warning | ✅ |
| 3 | unit + renderer parity + e2e ผ่านทั้ง 3 เอนจิน | ✅ 317/322 (5 skip โดยตั้งใจ) |
| 4 | export ตรงกับที่เห็น 100% (pixel diff < 0.1%) | ✅ `npm run test:render` (invariant 1, ไม่แตะจาก Phase 3) |
| 5 | canvas ขนาดใหญ่ (15000px) ไม่ crash | ✅ unit test + ADR-005 (ดูด้านบน, ไม่ได้เพิ่ม e2e ใหม่) |
| 6 | Firefox fallback ทำงานสวยงาม | ✅ `clipboard.spec.ts` (ADR-003, มาจาก Phase 1) |
| 7 | ไม่มี regression | ✅ ชุดทดสอบ Phase 1-2 ยังผ่านหมด |
| 8 | เอกสารสรุป phase | ✅ ไฟล์นี้ |
| 9 | ทดสอบวางลงจริงใน Slack/LINE/Jira/Gmail/Word/Figma/Google Docs | ⚠️ **ยังไม่ได้ทำ** - ต้องใช้มือจริงกับแอปจริง ทำเองในสภาพแวดล้อมนี้ไม่ได้ ดูด้านล่าง |
| 10 | Deploy ขึ้น live site | ✅ push ขึ้น `main` และ deploy ขึ้น live site แล้ว (`1de8743`) |

## สิ่งที่ยังทำไม่ได้ และต้องพูดให้ชัด

1. **DoD ข้อ 9 (ทดสอบวางลงจริงในแอปปลายทาง แล้วทำตาราง)** ทำไม่ได้จากใน
   session นี้เลย - ไม่มีบัญชี/หน้าจอ Slack, LINE, Jira, Gmail, Word, Figma,
   Google Docs ให้ทดสอบจริง เป็น process gate ที่ต้องรอผู้ใช้ เหมือนที่ Phase 2
   ทิ้งเรื่อง manual browser testing ไว้เป็นเงื่อนไขเดียวกัน
2. ช่องว่างเดิมจาก Phase 2 ที่ยังไม่ปิด (ไม่ใช่เรื่องใหม่จาก Phase 3): manual
   test checklist ส่วน E/F, real Windows/Chrome + macOS/Safari, และ
   `Ctrl/Cmd+Shift+C` เทียบ DevTools accelerator บนเบราว์เซอร์จริง
3. Export options popover เป็นการตัดสินใจ UI ที่ไม่มี mockup ต้นแบบในเอกสาร
   product plan (มีแต่ "PNG (1x/2x/3x)" ในตารางฟีเจอร์ ไม่มีภาพหน้าจอ) - เลือก
   เองตามหลัก progressive disclosure ที่ 4.1/4.2 ใช้อยู่แล้วกับ
   `SelectionToolbar`/`ZoomControls` ผู้ใช้ควรลองเองและบอกได้ถ้าต้องการปรับ

## ขั้นต่อไป

Push (`1de8743` → `main`) และ deploy ขึ้น live site ทำเสร็จแล้วหลัง commit
นี้ - ทำงานได้ราบรื่นในครั้งเดียวเหมือนทุกรอบก่อนหน้า ไม่ต้อง re-auth หรือ
เช็ค DNS ใหม่ Live site serve Phase 1-3 ครบแล้ว Phase 4 (คำอธิบายภาพ - ลูกศร/
กล่อง/ข้อความ/badge/เซ็นเซอร์/caption/crop) เป็นขั้นต่อไปตามลำดับใน CLAUDE.md
เว้นแต่ผู้ใช้อยากปิดช่องว่างการทดสอบมือ (ข้อ 1-2 ด้านบน) ก่อน
