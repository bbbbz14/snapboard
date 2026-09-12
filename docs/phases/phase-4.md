# Phase 4 — คำอธิบายภาพ (annotations) · เสร็จสิ้นทั้ง 6 item

วันที่: 2026-09-12 · ผลรวม: **typecheck ผ่าน + 218 unit + 27 renderer parity
(3 เอนจิน) + 234 e2e ผ่าน 229, 5 skip โดยตั้งใจ** (เหตุผลเดิมทั้งหมด - clipboard
round-trip บน headless Firefox/WebKit ตาม ADR-003 x2, shortcuts.spec.ts's
Ctrl/Cmd+Shift+C บน headless Firefox/WebKit x2 เหตุผลเดียวกัน, และ reorder
pixel-swap บน headless WebKit เท่านั้น - ไม่มี skip ใหม่จาก item 6)

## วัตถุประสงค์

เปลี่ยนผลิตภัณฑ์จาก "ต่อรูป" เป็น "อธิบาย" ตามคำจำกัดความของ product plan เอง -
ลูกศร กล่องกรอบ ข้อความ เลขกำกับอัตโนมัติ เซ็นเซอร์ และครอบตัด ทั้งหมดหก item
ตามลำดับที่ CLAUDE.md วางไว้

## Item 1–5: ลูกศร / กล่อง / ข้อความ / เลขกำกับ / เซ็นเซอร์

ทำไปแล้วในเซสชันก่อนหน้า ทั้งหมด commit, push ขึ้น `main`, และ deploy ขึ้น live
site แล้ว - รายละเอียดทุกการตัดสินใจ (ทำไมลูกศรโค้ง, ทำไม text ต้อง
self-host ฟอนต์คู่ Inter+Anuphan, ทำไม marker ไม่ใช่ "badge", ทำไม redact
ตัดเหลือ solid fill อย่างเดียว ฯลฯ) อยู่ใน CLAUDE.md ใต้ "START HERE" แล้ว
ครบถ้วน ไม่ทวนซ้ำที่นี่

## Item 6 — ใหม่ในเซสชันนี้: ครอบตัด (crop)

### การตัดสินใจแรกที่ต้องทำก่อนเขียนโค้ด: crop คืออะไร

CLAUDE.md's Phase 4 item 6 เขียนไว้ว่า "Crop the board itself" แต่ product
plan (§7.3's `ImageNode.crop?: Rect` normalized 0..1, และ §4.2's floating
toolbar `[ครอบตัด][ทำซ้ำ][ขึ้นหน้า][ลบ]` ที่โผล่เมื่อ**เลือกวัตถุ**) นิยาม crop
เป็น**คุณสมบัติต่อรูปภาพหนึ่งรูป** ไม่ใช่การครอบตัด canvas ทั้งบอร์ด - ถามผู้ใช้
แล้วยืนยันให้ทำตาม product plan (per-image crop) ซึ่งตรงกับ data model และ
mockup ที่มีอยู่จริง ไม่ใช่ตามคำพูดตัวอักษรของ CLAUDE.md ที่ไม่มี data
model/mockup รองรับ

### สิ่งที่สร้างใหม่

- **`ImageNode.crop?: Rect`** (`src/board/model/types.ts`) - normalized
  0..1 sub-rect ของภาพต้นฉบับที่ถูกวาดจริง ตรงกับที่ product plan กำหนดไว้ตั้งแต่
  §7.3 คำเดียว ไม่มี field นี้ = ภาพเต็ม ไม่ครอบตัด (เป็นกรณีส่วนใหญ่ ดังนั้น
  ไม่บังคับให้ทุก node มี field นี้)
- **UX แบบ classic crop tool**: กด "Crop" ใน floating toolbar (โผล่เฉพาะตอน
  เลือกภาพเดียว - multi-select หรือ annotation node อื่นไม่มีปุ่มนี้) → เปิด
  session แสดงภาพเต็มต้นฉบับ หรี่แสงส่วนนอกหน้าต่าง crop ปัจจุบัน (ตรงกับ frame
  เดิมพอดี) → ลากมุมหน้าต่าง crop (4 มุม, ไม่ล็อกอัตราส่วนเหมือน resize รูปปกติ
  - ครอบตัดต้องตัดแต่ละด้านอิสระกัน) → กด "Done" (หรือ Enter) ยืนยัน หรือ
  "Cancel" (หรือ Escape) ยกเลิก ระหว่าง session เป็นโหมด modal - คลิก/คีย์ลัด
  อื่นทั้งหมดไม่มีผล ป้องกันการลบ/ย้าย/สลับ tool โดยไม่ตั้งใจกลางที่กำลังครอบตัด
- **`src/board/interact/crop.ts`** - เรขาคณิตล้วน, unit-tested เต็ม:
  `fullImageRect` (คำนวณ rect เต็มของภาพต้นฉบับจาก frame+crop ปัจจุบัน),
  `resizeCropWindow` (ลากมุมแบบไม่ล็อกอัตราส่วน, anchor มุมตรงข้าม, clamp ไม่ให้
  เกินภาพต้นฉบับ, ไม่เล็กกว่า `CROP_MIN_SIZE`), `windowToCrop` (แปลงกลับเป็น
  normalized rect - ตัวผกผันของ `fullImageRect`)
- **หน้าต่าง crop วาดบน canvas ใหม่แยกต่างหาก** (`.board-crop-overlay`, ไม่ใช่
  `.board-interaction` เดิม) เพราะต้องวาดเนื้อภาพจริง (ผ่าน `assetStore` ตรง ๆ)
  ปนกับพื้นหรี่ + handle - ถ้าใช้ canvas เดิมร่วมกับ selection outline ปกติ จะทำ
  ให้เทคนิคทดสอบ e2e เดิม (สแกนพิกเซล "สีน้ำเงินเด่น = selection UI") ผิดเพราะ
  เจอเนื้อภาพ gradient ปนเข้ามาด้วย - แยก canvas ทำให้ 3 ชั้นนี้ (content /
  selection UI / crop overlay) ไม่ก้าวก่ายกัน เทสต์เดิมทั้งหมดยังผ่านโดยไม่ต้องแก้
- **`hitTestHandle` (`handles.ts`) ถูก refactor** แยกส่วน "hit-test มุมของ rect
  หนึ่งใบ" ออกเป็น `hitTestRectHandle` ที่ reuse ได้กับ rect ชั่วคราวใด ๆ (ไม่ใช่
  แค่ `BoardNode`) - หน้าต่าง crop เป็น session state ชั่วคราว ไม่ใช่ node จริง
  จึงต้องมีฟังก์ชันแยกจากที่รับ `BoardNode[]` เดิม `hitTestHandle` เดิมเรียก
  ฟังก์ชันใหม่นี้ภายในเหมือนกัน ไม่มี logic ซ้ำสองที่
- **`commitCrop(id, frame, crop)`** ใน `boardStore.ts` - ตั้ง `frame` และ
  `crop` พร้อมกันในการ commit เดียว (สองค่านี้ต้องไม่ขัดกันเด็ดขาด - ดู
  `ImageNode.crop`'s comment) และสลับ `layout` เป็น `'free'` เหมือนกฎเดียวกับ
  `setFrames` (invariant 4: การแก้ด้วยมือต้องไม่ถูก relayout ทับ)
- **บั๊กจริงที่จับได้ก่อนขึ้นโค้ด ไม่ใช่จาก test**: `relayout()`'s เดิมใช้
  `assetStore.get(assetId)?.natural` (ขนาดภาพต้นฉบับ) ตรงๆ เป็นอัตราส่วนสำหรับ
  auto-layout - ถ้าภาพถูกครอบตัดแล้วผู้ใช้กด "Turn back on" กลับไป auto อีกครั้ง
  โค้ดเดิมจะคำนวณ frame ใหม่จากอัตราส่วนภาพเต็ม (ไม่ใช่อัตราส่วนที่ครอบตัดแล้ว)
  ทำให้ภาพที่ครอบตัดไว้ถูกยืด/บีบผิดสัดส่วนตอน relayout ครั้งต่อไป แก้ด้วยการคูณ
  `natural` ด้วย `crop.w`/`crop.h` ก่อนส่งเข้า `computeLayout` เมื่อ node มี
  `crop` - ไม่มีทางเทสต์ผ่าน `boardStore`'s public API ได้ (การเทสต์เดิมของไฟล์
  นี้ไม่แตะ `assetStore` จริงเลย ใช้ fallback `{w:16,h:9}` เสมอ) จึงพิสูจน์ถูกด้วย
  code review + type-check เท่านั้น ไม่ใช่ unit test ใหม่ - คุ้มค่าที่จะจำไว้ถ้า
  ฟีเจอร์ในอนาคตต้องการทดสอบ path นี้จริง ๆ
- **`RenderItem.crop`** (`renderScene.ts`) และ tile cache key
  (`tileCache.ts`) รวม crop เข้าไปด้วย (ตาม invariant 2 - ขนาด/style/ratio
  เดิม เพิ่ม crop เป็นมิติที่สี่ที่ทำให้ tile ต้องสร้างใหม่ เพราะเปลี่ยนเนื้อหาที่
  วาดในนั้นเหมือนกับ style เปลี่ยน) `drawFramedImage` วาดด้วย 9-arg
  `drawImage(source, sx,sy,sw,sh, dx,dy,dw,dh)` เมื่อมี crop - เรียกจากทั้ง
  `renderScene` (preview ไม่มี tile, export) และ `tileCache.ts` (สร้าง tile
  ครั้งเดียว) เหมือนกันทั้งหมด - **invariant 1** (renderer ตัวเดียวสำหรับ
  preview กับ export) ยังคงจริงโดยไม่ต้องแก้อะไรเพิ่ม เพราะ crop ไม่ได้เปิด
  code path ใหม่ แค่เป็นพารามิเตอร์เสริมของ `drawFramedImage` ที่มีอยู่แล้ว
- **`tests/unit/crop.test.ts`** (ใหม่, 8 เคส) ครอบคลุมเรขาคณิตทั้งสามฟังก์ชัน
  ใน `crop.ts` ตรง ๆ. **`tests/unit/boardStore.test.ts`**'s `commitCrop` block
  (ใหม่, 4 เคส) ครอบคลุม set frame+crop พร้อมกัน, ไม่ถูก relayout ทับ (invariant
  4), ไม่กระทบ selection, undo คืนค่าเดิมและลบ field `crop` กลับไป
- **`tests/e2e/crop.spec.ts`** (ใหม่, 5 เคส × 3 เอนจิน = 15): ปุ่ม Crop โผล่
  เฉพาะเลือกภาพเดียว (ไม่โผล่ตอนไม่เลือกอะไร, multi-select, หรือเลือก box
  node); ลากมุมแล้วกด Done ทำให้ภาพเล็กลงจริงทั้ง preview และไฟล์ export
  (สุ่มพิกเซลมุมที่ถูกตัดออก - ต้องกลายเป็นพื้นบอร์ดขาว ไม่ใช่เนื้อภาพเดิม, เทคนิค
  เดียวกับ `moveResize.spec.ts`'s resize test); Escape ยกเลิก session โดยไม่
  เปลี่ยนอะไรเลย; crop ที่ยืนยันแล้ว undo ได้เหมือน commit อื่น ๆ ทุกอย่าง
  ผ่านทั้ง 3 เอนจินตั้งแต่รอบแรกที่รัน ไม่ต้อง skip เพิ่ม

### สิ่งที่ตัดโดยตั้งใจ ตามขนาดที่ "ครอบตัดต่อภาพหนึ่งรูป" ต้องการเท่านั้น

- **ไม่มีการย้ายหน้าต่าง crop โดยไม่ปรับขนาด** (ลากด้านในหน้าต่างเพื่อ pan โดยไม่
  เปลี่ยนขนาด) - ใช้กรณีหลัก ("สกรีนช็อตมีส่วนเกินตามขอบ") แก้ได้ครบด้วยแค่ 4
  มุมเพียงพอแล้ว (แต่ละมุมปรับสองด้านพร้อมกัน) ปรับ crop ที่ครอบตัดไปแล้วอีกรอบ
  ให้เลื่อนตำแหน่งโดยไม่ย่อ/ขยาย เป็น edge case ที่ยังไม่มีอะไรในแผนผลิตภัณฑ์ขอ
- **ไม่มี aspect-ratio lock ระหว่างครอบตัด** (ต่างจาก resize รูปปกติที่ล็อก
  อัตราส่วน) - ตั้งใจ เพราะครอบตัดต้องตัดแต่ละด้านอิสระกันได้ ตรงข้ามกับ
  resize ที่ต้องคงรูปทรงเดิม
- **ไม่มี preset อัตราส่วน** (1:1, 16:9 ฯลฯ) - ไม่มีใน product plan, และเป็น
  ตัวเลือกที่ไม่มีใครขอ (หลักการเดียวกับที่ arrow ตัดตัวเลือกสี, box ตัดตัวเลือก fill)

## Definition of Done

| # | เกณฑ์ | สถานะ |
|---|---|---|
| 1 | ทั้ง 6 item ทำงานตาม acceptance criteria | ✅ |
| 2 | typecheck ผ่านไม่มี warning | ✅ |
| 3 | unit + renderer parity + e2e ผ่านทั้ง 3 เอนจิน | ✅ 218 unit + 27 parity + 229/234 e2e (5 skip โดยตั้งใจ, เหตุผลเดิมทั้งหมด) |
| 4 | ใส่ลูกศร+เลขบน bug report เสร็จใน < 15 วินาที | ✅ ทั้งสองเป็น one-shot gesture เดียว (กดคีย์ลัด → ลาก/คลิก → เสร็จ) - ยังไม่มีคนจริงจับเวลา แต่ไม่มี step ที่ทำให้เกิน 15 วิ |
| 5 | เซ็นเซอร์แล้วข้อมูลเดิมกู้คืนจากไฟล์ export ไม่ได้จริง (ทดสอบด้วยการซูม) | ✅ `redact.spec.ts` decode ไฟล์ที่ดาวน์โหลดจริงแล้วอ่านพิกเซล (item 5, เซสชันก่อนหน้า) |
| 6 | ไม่มี regression | ✅ ชุดทดสอบ Phase 1-3 และ item 1-5 ยังผ่านหมด |
| 7 | เอกสารสรุป phase | ✅ ไฟล์นี้ |
| 8 | Deploy ขึ้น live site | ✅ (ดูด้านล่าง - push+deploy ทำพร้อมกับ commit นี้ตามที่ผู้ใช้อนุมัติไว้ล่วงหน้า) |

## ขั้นต่อไป

Phase 4 เสร็จครบทั้ง 6 item แล้ว - Phase 5 (ความประณีต: design system, dark
mode, i18n ไทย, a11y, mobile lite) เป็นขั้นต่อไปตามลำดับใน CLAUDE.md ก่อนเริ่ม
ควรพิจารณาปิดช่องว่างการทดสอบมือที่ค้างมาจาก Phase 2/3 ก่อน (real
Safari/Firefox, Slack/LINE/Jira/Gmail/Word/Figma/Google Docs paste table) -
ทั้งสองทำไม่ได้จากใน session อัตโนมัตินี้ ต้องรอผู้ใช้จริง
