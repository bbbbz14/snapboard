# Phase 0 — Technical Validation · เสร็จสิ้น

วันที่: 2026-09-10 · ผลรวม: **spike ผ่าน 15/15 บน Chromium, Firefox, WebKit**

## วัตถุประสงค์
ล้มความเสี่ยงที่ล้มโปรเจกต์ได้ ก่อนลงทุนเขียนโค้ดจริง

## สิ่งที่ทำ
- ตั้งโครงโปรเจกต์: Vite 8 + React 19 + TypeScript strict + Playwright 1.63 (`npm audit` = 0 vulnerabilities)
- สร้าง spike harness ที่วัดได้จริง (`spikes/`) ขับด้วย Playwright บน 3 เบราว์เซอร์
- เขียน prototype renderer จริง ~300 บรรทัด ครอบคลุม image+เงา+ขอบมน, text พร้อมตัดบรรทัด, ลูกศร, กล่อง, pixelate, hit-test
- บันทึกผลดิบไว้ที่ `spikes/results/*.json`

## ข้อค้นพบสำคัญ 5 ข้อ

### 1. ✅ สถาปัตยกรรม renderer เดียวได้ผล — ความเสี่ยง R1 ถูกกำจัด
export ผ่าน OffscreenCanvas → PNG → decode แล้วเทียบกับ preview ได้ **ค่าผิดพลาด 0 ทุก channel ทั้ง 3 เบราว์เซอร์**
และ landmark ที่ scale 2 อยู่ที่พิกัด ×2 พอดี → geometry ขยายแม่นยำ
→ ตัดสินใจ: เขียน Canvas 2D renderer เอง ไม่ใช้ Konva/Fabric/html2canvas ([ADR-001](../decisions/ADR-001-rendering.md))

### 2. ⚠️ เงาคือคอขวด กิน 72–91% ของเวลาวาดเฟรม
`shadowBlur` ทำให้ 9 รูปใช้เวลา 12.5–23 ms/เฟรม (≈43fps บน WebKit ตั้งแต่รูปยังน้อย)
การ pre-render เป็น tile ลดเหลือ **0.7–1 ms → เร็วขึ้น 18–23 เท่า**
→ ตัดสินใจ: ใช้ tile cache ต่อ node ตั้งแต่ Phase 1 ไม่ใช่ไปแก้ทีหลัง ([ADR-002](../decisions/ADR-002-frame-strategy.md))

### 3. 🚨 `clipboard.write()` ที่สำเร็จ ไม่ได้แปลว่าข้อมูลลงคลิปบอร์ดจริง
Firefox resolve promise เรียบร้อยแต่คลิปบอร์ดว่างเปล่า
copy→paste จริงสำเร็จเฉพาะ Chromium (1 รูป) ส่วน Firefox/WebKit ได้ 0 รูป
**ข้อจำกัด:** สภาพแวดล้อมนี้เป็น headless Linux ที่ไม่มีคลิปบอร์ดระดับ OS และ Playwright WebKit ไม่ใช่ Safari จริง
→ สรุปได้แค่ "ยืนยันไม่ได้" ไม่ใช่ "ใช้ไม่ได้" · **ต้องทดสอบด้วยมือบนเบราว์เซอร์จริงก่อนปิด Phase 3**
→ ตัดสินใจ: ปุ่มดาวน์โหลดต้องอยู่ข้างปุ่มคัดลอกเสมอ ([ADR-003](../decisions/ADR-003-clipboard.md))

### 4. ⚠️ Safari decode ช้ากว่า Chromium 4 เท่า และหน่วยความจำเป็นเรื่องจริง
20 รูป 4K: decode 457 ms (Chromium) เทียบกับ **1767 ms (WebKit)**
เก็บความละเอียดเต็ม = **664 MB** · ย่อเหลือ 2048px = **189 MB (−72%)**
→ ตัดสินใจ: เก็บสองความละเอียด (display + blob ต้นฉบับ) ([ADR-004](../decisions/ADR-004-image-memory.md))

### 5. ℹ️ ขีดจำกัด canvas คือพื้นที่ ไม่ใช่ความยาวด้าน
จัตุรัสใหญ่สุด 16384px (Chromium/WebKit), 23168px (Firefox) · แต่ 4000×65472 ทำได้สบาย
→ ตัดสินใจ: งบพื้นที่ปลอดภัย 100 MP + ลด scale อัตโนมัติ + บอกผู้ใช้ ([ADR-005](../decisions/ADR-005-canvas-limits.md))

### โบนัส: บทเรียนด้านวิธีวัดสองข้อ
- **การจับเวลา canvas ต้องบังคับ flush** ด้วย `getImageData` 1 พิกเซลก่อนอ่านนาฬิกา — ไม่งั้น WebKit รายงาน 0 ms (rasterize แบบ async)
- **Firefox ไม่รับ `clipboardData` จาก constructor ของ `ClipboardEvent`** → e2e paste ต้องข้าม Firefox แล้วใช้ unit test แทน ([ADR-006](../decisions/ADR-006-testing-input.md))

## Definition of Done

| # | เกณฑ์ | สถานะ |
|---|---|---|
| 1 | spike ครบ 5 ข้อ วัดผลจริง | ✅ 15/15 ผ่าน |
| 2 | typecheck ผ่าน | ✅ |
| 3 | ทดสอบครบ 3 เบราว์เซอร์ | ✅ chromium / firefox / webkit |
| 4 | ตัดสินใจเรื่อง renderer | ✅ เขียนเอง (ADR-001) |
| 5 | เขียน ADR | ✅ 6 ฉบับ |
| 6 | dependency ปลอดภัย | ✅ 0 vulnerabilities |
| 7 | เอกสารสรุป phase | ✅ ไฟล์นี้ |

## ผลกระทบต่อแผนเดิม
| เดิม | แก้เป็น |
|---|---|
| งบ "20 รูป < 2 วินาที" | แยกงบ Safari ออกมาต่างหาก — Safari คือ worst case (decode อย่างเดียว 1.77 วินาที) |
| tile cache อยู่ใน Phase 6 ("ถ้าวัดแล้วช้าจริง") | **เลื่อนขึ้นมา Phase 1** — วัดแล้วช้าจริง |
| Konva เป็นทางเลือกสำรอง | ยังเป็นทางถอยได้ แต่โอกาสใช้ต่ำมากแล้ว |

## ขั้นต่อไป
**Phase 1 — Core loop: วาง → จัดวางอัตโนมัติ → คัดลอก**
เกณฑ์ผ่านคือ Time-To-Copy < 20 วินาที สำหรับ 3 รูปโดยไม่ต้องแก้อะไร
