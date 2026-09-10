# Snapboard — Product Discovery & Implementation Plan

เอกสารนี้คือผลการวิเคราะห์ผลิตภัณฑ์ก่อนเริ่มเขียนโค้ด (Phase 0)
วันที่: 2026-09-10 · สถานะ: **รออนุมัติ**

---

## 0. บทสรุปผู้บริหาร (TL;DR)

**ปัญหาที่แท้จริง** ไม่ใช่ "ผมอยากได้ Photoshop แบบง่าย"
แต่คือ **"ผมต้องอธิบายบางอย่างให้คนอื่นเข้าใจ และตอนนี้ผมต้องส่งรูป 5 รูปแล้วอธิบายด้วยข้อความ"**

ผลลัพธ์ที่ผู้ใช้ต้องการคือ **ภาพเดียวที่อธิบายตัวเองได้** — ไม่ใช่ผืนผ้าใบเปล่าที่มีเครื่องมือเยอะ

### ข้อเสนอหลัก 3 ข้อที่ต่างจากโจทย์เดิม

1. **Layout-first ไม่ใช่ Canvas-first**
   โจทย์เดิมบอกว่า "เปิดมาเจอ canvas เปล่า → ลากรูปเข้ามา → ย้าย/ปรับขนาดเอง"
   แต่ "การย้ายและปรับขนาดเอง" คือ **งาน** ไม่ใช่ **คุณค่า**
   Snapboard ควร **จัดวางให้สวยทันทีที่รูปเข้ามา** แล้วให้ผู้ใช้ปรับเฉพาะเมื่ออยากปรับ
   → ผู้ใช้ที่ไม่แก้อะไรเลย ก็ได้ผลลัพธ์ที่ดูดีพอส่งได้ ใน 5 วินาที

2. **Clipboard คือทางเข้าหลัก ไม่ใช่ "ถ้าทำได้ก็ดี"**
   สกรีนช็อตส่วนใหญ่ **ไม่เคยถูกเซฟลงดิสก์** — มันอยู่ใน clipboard จาก Snipping Tool / Cmd+Shift+4 / LINE
   วงจรทั้งหมดของผลิตภัณฑ์นี้คือ `Ctrl+V ... Ctrl+V ... Ctrl+Shift+C` แล้วจบ
   Drag & drop จาก Finder/Explorer สำคัญ แต่เป็น **ทางเข้าที่สอง**

3. **Privacy คือคูเมือง (moat) ไม่ใช่แค่ฟีเจอร์**
   กลุ่มผู้ใช้หลัก (support, QA, PM, admin) ทำงานกับ **หน้าจอ backend, ข้อมูลลูกค้า, แชทส่วนตัว**
   เครื่องมือที่ต้องอัปโหลดรูปขึ้น server จะถูก IT/Compliance บล็อกทันที
   Snapboard จะ **ไม่มี network request ใด ๆ เลยหลังโหลดหน้าเว็บ** และบังคับด้วย CSP `connect-src 'none'`
   → เป็นคำกล่าวอ้างที่ **พิสูจน์ได้จริง** จาก DevTools ซึ่งคู่แข่งส่วนใหญ่พูดไม่ได้

### หนึ่งประโยค

> Snapboard คือเว็บแอปที่เปลี่ยนสกรีนช็อตหลายรูปให้เป็นภาพอธิบายเดียว พร้อมส่ง ภายในไม่กี่วินาที โดยไม่ต้องล็อกอินและไม่มีการอัปโหลดรูปขึ้นเซิร์ฟเวอร์

### Tagline ที่เป็นไปได้

- **"วาง จัด ก๊อป"** / "Paste. Arrange. Copy."
- "หลายภาพ หนึ่งคำอธิบาย"
- "อธิบายด้วยภาพเดียว"

---

## 1. Product Analysis

### 1.1 Job To Be Done

**Job หลัก:**
> เมื่อฉันต้องอธิบายเรื่องที่เห็นบนหน้าจอให้คนอื่นฟัง ฉันอยากส่ง **ภาพเดียว** ที่เขาเปิดครั้งเดียวแล้วเข้าใจ เพื่อที่ฉันจะไม่ต้องตอบคำถามซ้ำอีก 5 รอบ

**Job รอง:**
- เก็บหลักฐาน (แชท, สลิป, error) ให้อยู่ในภาพเดียว
- แสดง before/after ให้เห็นความต่างชัด ๆ
- ทำคู่มือสั้น ๆ 3–6 ขั้นตอน โดยไม่ต้องเปิด Google Docs

**Emotional job:** ไม่อยากดูไม่โปร / ไม่อยากรบกวนคนอื่นด้วยรูปรก ๆ 5 รูป

### 1.2 สิ่งที่เกิดขึ้นจริงตอนนี้ (สภาพก่อนมี Snapboard)

| วิธีที่คนใช้ | ปัญหา |
|---|---|
| ส่งรูปทีละใบใน Slack/LINE | ผู้รับต้องเปิดทีละรูป ลำดับหาย บริบทหาย |
| แปะลง PowerPoint / Google Slides | ช้า, ต้องจัดเอง, export ยุ่ง, ไฟล์ใหญ่ |
| แปะลง Word/Docs แล้วส่ง PDF | ผู้รับต้องดาวน์โหลด, แปะกลับใน Slack ไม่ได้ |
| ใช้ Figma/Canva | ต้องล็อกอิน, ต้องสร้าง project, overkill |
| ใช้ online merge tool | ผลลัพธ์แข็ง ๆ ไม่สวย, annotate ไม่ได้, ปรับไม่ได้ |
| ต่อรูปด้วย Paint | ทรมาน |

**ข้อสังเกตสำคัญ:** ทุกวิธีข้างบน "ทำได้" หมด ปัญหาไม่ใช่ความเป็นไปได้ แต่คือ **แรงเสียดทาน (friction)**
→ ดังนั้น **metric เดียวที่สำคัญที่สุดของผลิตภัณฑ์นี้คือเวลา**

### 1.3 North Star Metric

> **Time-To-Copy (TTC)** = เวลาตั้งแต่วางรูปแรก จนกด "คัดลอก" สำเร็จ

- เป้าหมาย MVP: **median < 20 วินาที** สำหรับ 3 รูป + ไม่แก้อะไร
- เป้าหมายรอง: **จำนวนคลิกก่อนได้ผลลัพธ์ใช้ได้ = 0** (auto-layout ทำงานทันทีที่วางรูป)
- Counter-metric: % ของ board ที่ผู้ใช้ **ต้องเข้าไปย้ายรูปเอง** — ถ้าสูง แปลว่า auto-layout ยังไม่ดีพอ

### 1.4 ท้าทายสมมติฐานในโจทย์เดิม

| สมมติฐานเดิม | ข้อเสนอของผม | เหตุผล |
|---|---|---|
| "ขั้นที่ 3: เลือกพื้นหลังขาว/ดำ" | **ลบขั้นตอนนี้ออก** ใช้ขาวเป็นค่าเริ่มต้น มีปุ่มสลับทีหลัง | การเลือกก่อนเริ่มงานคือ cognitive load ที่ไม่จำเป็น 95% เลือกขาวอยู่แล้ว |
| "canvas เปล่า → ย้าย/ปรับขนาดเอง" | **auto-layout ทันที** ย้ายเองเป็นทางหนีทีไล่ | การจัดวางเองคือแรงงาน ไม่ใช่คุณค่า |
| "clipboard ถ้าทำได้จริงในทางเทคนิค" | **clipboard เป็น input หลัก** | สกรีนช็อตส่วนใหญ่ไม่เคยลงดิสก์ |
| Rotation | **ตัดออกจาก MVP** | สกรีนช็อตเป็นภาพตั้งฉากเสมอ การหมุนคือรีเฟล็กซ์จาก Photoshop ไม่ใช่ job จริง |
| Group / Ungroup / Lock | **ตัดออก** | จำเป็นเมื่อมี object เป็นร้อย เราออกแบบให้มี 3–10 |
| Align / Distribute | **ตัดออก** | auto-layout + snapping ทำแทนได้ 100% และดีกว่า |
| Brightness/Contrast/Saturation/Sharpen | **ตัดออกทั้งหมด ถาวร** | ไม่มี job ไหนที่ต้องปรับ contrast ของสกรีนช็อต — นี่คือ feature จาก "image editor" mental model |
| "AI Enhance / Improve clarity" | **ไม่ทำ** | ขัดกับคำสัญญา privacy โดยตรง (ต้องส่งรูปออกนอกเครื่อง) และไม่แก้ job จริง |
| Template gallery แบบ Canva | **ไม่มี gallery** ใช้ "โหมดจัดวาง" 5 แบบแทน | gallery = ต้องเลือกก่อนเริ่ม = ช้าลง |
| Canvas ขนาดคงที่ (แบบ Photoshop) | **canvas โตอัตโนมัติตามเนื้อหา** | ผู้ใช้ไม่รู้จะตั้งกี่พิกเซล และผลลัพธ์ควรพอดีเนื้อหาเสมอ |
| Mental model = Photoshop | Mental model = **"เอกสารภาพ" / board** | ลดความคาดหวังผิด ๆ และลด feature creep |

**สิ่งที่ผมเห็นด้วยเต็มที่และจะรักษาไว้:** ไม่ล็อกอิน, ทำงานในเบราว์เซอร์, drag & drop, คัดลอกลง clipboard, คีย์ลัด, ประมวลผลในเครื่อง

---

## 2. User Personas

### P1 — "เต้ย" · QA / Support / Ops **(ผู้ใช้หลัก ความถี่สูงสุด)**
- อายุ 25–35 ไม่ใช่ดีไซเนอร์ ใช้ Windows + Chrome
- ทำงานกับ Jira / Slack / LINE OA / admin panel ทั้งวัน
- แจ้งบั๊ก 5–20 ครั้งต่อสัปดาห์ แต่ละครั้งมี 2–5 สกรีนช็อต
- **Pain:** dev ถามกลับว่า "อยู่หน้าไหน" "กดอะไรก่อน" ทุกครั้ง
- **ต้องการ:** ลูกศร + เลขลำดับ + ส่งเข้า Jira ได้ใน 30 วินาที
- **ไม่ต้องการ:** ทุกอย่างที่เหลือ

### P2 — "แนน" · PM / BA
- อธิบาย flow / feature ให้ dev และ stakeholder
- ต้องการ before/after และ step-by-step
- แคร์ว่าภาพต้อง "ดูโปร" พอที่จะแปะใน deck หรือส่งให้ผู้บริหาร
- **ต้องการ:** caption ใต้รูป, พื้นหลังสะอาด, ความละเอียดสูง (2x)

### P3 — "โจ้" · Freelance / Agency
- ส่งงานให้ลูกค้า, รายงานความคืบหน้า, before/after
- แคร์ความสวยงามมากกว่ากลุ่มอื่น
- **ต้องการ:** เงา/ขอบมน/พื้นหลังไล่สี, export 2x

### P4 — "พี่หน่อย" · แอดมินเพจ / ร้านค้าออนไลน์ **(บริบทไทยโดยเฉพาะ)**
- รวมสกรีนช็อตแชท LINE/Messenger + สลิปโอนเงิน เป็นหลักฐาน
- ส่งให้หัวหน้า / ลูกค้า / แจ้งความ
- **ต้องการ:** วางภาพแนวตั้งจากมือถือหลายใบให้เรียงสวย + **เซ็นเซอร์เบอร์โทร/ที่อยู่**
- นี่คือเหตุผลสำคัญที่ **เครื่องมือเซ็นเซอร์ (redact)** ต้องอยู่ใน MVP-ish ไม่ใช่ของเล่นทีหลัง

**ผู้ใช้ที่เราจงใจไม่รองรับ:** ดีไซเนอร์มืออาชีพ, คนทำ marketing asset, คนตัดต่อภาพ

---

## 3. Core Workflows

### W1 — Bug report (ความถี่สูงสุด)
```
Snip หน้าจอ → Ctrl+V ลง Snapboard → Snip อีก → Ctrl+V → Snip อีก → Ctrl+V
  → (auto-layout จัดเป็นขั้นตอน 1-2-3 ให้แล้ว)
  → กด A ลากลูกศรชี้ปุ่มที่พัง
  → Ctrl+Shift+C
  → Ctrl+V ใน Jira / Slack
```
**เป้าหมาย: 8 การกระทำ, < 30 วินาที**

### W2 — Before / After
```
ลากรูป 2 รูปจาก Finder → auto-layout เห็นว่ามี 2 รูป → เสนอโหมด "เทียบคู่" อัตโนมัติ
  → พิมพ์ caption "ก่อน" / "หลัง" (หรือปล่อยว่าง)
  → Ctrl+Shift+C
```

### W3 — อธิบายกระบวนการ 5 ขั้นตอน
```
วางรูป 5 รูป → เลือกโหมด "ขั้นตอน" → ระบบใส่ badge เลข 1-5 อัตโนมัติ
  → ลากสลับลำดับรูป (เลขเรียงใหม่เองอัตโนมัติ)
  → ใส่ caption สั้น ๆ ใต้แต่ละรูป
  → Export PNG 2x
```

### W4 — รวมหลักฐานแชท
```
วางสกรีนช็อตมือถือ 4 ใบ → auto-layout จัดเป็นแถวเดียว 4 คอลัมน์ ความสูงเท่ากัน
  → กด B ลากคลุมเบอร์โทร → เบลอ
  → Ctrl+Shift+C
```

### W5 — แก้ไข board เดิม
```
เปิดเว็บอีกครั้ง → board ล่าสุดยังอยู่ (IndexedDB) → แก้ → copy ใหม่
```

---

## 4. UX Concept

### 4.1 หลักการออกแบบ 5 ข้อ

1. **ไม่มีหน้าจอตั้งค่าก่อนเริ่ม** — เปิดมาแล้วพร้อมรับรูปทันที
2. **Canvas คือพระเอก** — chrome (UI รอบ ๆ) ต้องกินพื้นที่ < 15% และจางลงเมื่อไม่ใช้
3. **Progressive disclosure** — เครื่องมือแสดงเมื่อเลือก object เท่านั้น (contextual toolbar ลอยติดวัตถุ)
4. **ค่าเริ่มต้นต้องดีจนไม่ต้องแก้** — เงา ขอบมน ระยะห่าง สีพื้น เลือกมาให้แล้ว
5. **ทางออกอยู่ที่เดียวเสมอ** — ปุ่ม "คัดลอก" ใหญ่ ชัด อยู่มุมขวาบนตลอดเวลา

### 4.2 โครงหน้าจอ

```
┌──────────────────────────────────────────────────────────────────┐
│  Snapboard          [ พื้นหลัง ▾ ] [ จัดวาง ▾ ] [ สไตล์ ▾ ]        │
│                                        [ ↓ บันทึก ] [ ⧉ คัดลอก ]  │ ← Top bar (48px)
├──────────────────────────────────────────────────────────────────┤
│ ┌──┐                                                             │
│ │▚ │                    ┌──────────────────┐                     │
│ │↗ │                    │                  │                     │
│ │T │                    │   [ รูปที่ 1 ]    │                     │
│ │①│                    │                  │                     │
│ │▭ │                    └──────────────────┘                     │
│ │▨ │        ┌──────────────┐   ┌──────────────┐                  │
│ └──┘        │  [ รูปที่ 2 ] │   │  [ รูปที่ 3 ] │                  │
│  ↑          └──────────────┘   └──────────────┘                  │
│ เครื่องมือ (ลอย, ซ้าย, แสดงเฉพาะเมื่อมีรูปแล้ว)                     │
│                                                    [ 100% ] [⤢]  │ ← zoom (มุมขวาล่าง)
└──────────────────────────────────────────────────────────────────┘
```

**เมื่อเลือกวัตถุ** → มี toolbar ลอยเล็ก ๆ ปรากฏเหนือวัตถุนั้น:
`[ ครอบตัด ] [ ทำซ้ำ ] [ ขึ้นหน้า ] [ ลบ ]`
ไม่มี properties panel ด้านขวาแบบ enterprise — มันกินพื้นที่และเพิ่มความรู้สึก "ซับซ้อน"

### 4.3 Empty State (สำคัญที่สุดต่อ first-use)

```
              ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
                            ⌘/Ctrl + V
              │      วางสกรีนช็อตได้เลย            │
                   หรือลากไฟล์รูปมาวางตรงนี้
              │                                   │
                      [ เลือกไฟล์จากเครื่อง ]
              └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘

        🔒 รูปของคุณอยู่ในเครื่องคุณเท่านั้น ไม่มีการอัปโหลด
```
- ไม่มี tour, ไม่มี modal ต้อนรับ, ไม่มี "ยินดีต้อนรับ!"
- ข้อความบอกวิธีใช้ = ข้อความเดียวบนหน้าจอ
- บรรทัด privacy อยู่ตรงนี้เพราะเป็น **จุดตัดสินใจ** ของผู้ใช้องค์กร

### 4.4 Feedback ทันทีที่ต้องมี

| เหตุการณ์ | Feedback |
|---|---|
| ลากไฟล์เข้ามาเหนือหน้าต่าง | ทั้งหน้าจอมีขอบไฮไลต์ + "วางเพื่อเพิ่ม 3 รูป" |
| รูปกำลัง decode | placeholder สีเทา + shimmer ในตำแหน่งที่จะไปอยู่ |
| รูปเข้ามาแล้ว | animate เข้าตำแหน่ง (spring 250ms) — ผู้ใช้เห็นว่า "ระบบจัดให้แล้ว" |
| กด copy สำเร็จ | ปุ่มเปลี่ยนเป็น "คัดลอกแล้ว ✓" 1.5 วิ + toast บอก "Ctrl+V ในแอปอื่นได้เลย" |
| copy ไม่รองรับ (Firefox เก่า) | fallback เป็นดาวน์โหลดทันที + อธิบายเหตุผลสั้น ๆ |
| ไฟล์ไม่ใช่รูป | toast "ไฟล์ report.pdf ไม่ใช่รูปภาพ" ไม่ใช่ error modal |

### 4.5 Dark / Light mode
- ตาม system เป็นค่าเริ่มต้น, สลับได้
- **สำคัญ:** สีพื้นหลังของ *board* แยกจากธีมของ *แอป* โดยสิ้นเชิง (คนใช้ dark UI แต่ export พื้นขาว)

### 4.6 Mobile / Tablet
- MVP: **desktop-first อย่างชัดเจน**
- บนมือถือ: แสดงโหมด lite = เลือกรูป → เลือกโหมดจัดวาง → บันทึกภาพ (ไม่มีการย้ายอิสระ)
- เหตุผล: การลาก-ย่อ-ขยายบนจอเล็กคือ UX ที่แย่เสมอ และ job หลักเกิดบน desktop

---

## 5. Feature Prioritization

### ✅ MVP (Phase 1–4)

| ฟีเจอร์ | เหตุผล |
|---|---|
| วางรูปจาก clipboard (Ctrl+V) | ทางเข้าหลัก |
| ลาก & วางไฟล์จาก OS (หลายไฟล์พร้อมกัน) | ทางเข้าที่สอง |
| เลือกไฟล์ผ่านปุ่ม | accessibility / คนไม่ถนัดลาก |
| Auto-layout 5 โหมด | **หัวใจของผลิตภัณฑ์** |
| สลับลำดับรูปด้วยการลาก | เร็วกว่าย้ายอิสระสำหรับ 90% ของเคส |
| ย้าย / ปรับขนาดอิสระ + snapping | ทางหนีทีไล่ที่จำเป็น |
| ลบ / ทำซ้ำ / ลำดับชั้น | พื้นฐาน |
| Multi-select | จำเป็นเมื่อมีหลายรูป |
| Undo / Redo | ขาดไม่ได้ |
| Zoom / Pan / Fit | ขาดไม่ได้ |
| พื้นหลัง: ขาว / ดำ / เทา / โปร่งใส / สีเอง / ไล่สี 4 แบบ | คำขอตรงจากโจทย์ + ทำให้ output ดูดี |
| สไตล์รูป: ขอบมน + เงา (3 preset) | ทำให้ผลลัพธ์ "ดูโปร" โดยไม่ต้องคิด |
| ระยะห่าง / ขอบกระดาษ (slider) | ปรับความแน่น-โปร่งได้ใน 1 ลาก |
| Annotate: ลูกศร, กล่อง, ข้อความ, เลขลำดับ, เซ็นเซอร์ | 5 อย่างพอ |
| Caption ใต้รูป | คุณค่าสูงมากต่อการ "อธิบาย" |
| ครอบตัด (crop) | สกรีนช็อตมักมีส่วนเกิน |
| Export PNG (1x/2x/3x) | ขาดไม่ได้ |
| Export JPG | ไฟล์เล็กสำหรับภาพใหญ่มาก |
| คัดลอกลง clipboard | **ขาดไม่ได้ที่สุด** |
| คีย์ลัด | ความเร็ว |
| Autosave ลง IndexedDB | กัน tab ปิด/เบราว์เซอร์ crash |
| ทำงาน 100% ในเครื่อง | คูเมือง |

### 🕐 หลัง MVP (Phase 5–7)
เก็บหลาย board, PWA/offline, ไฟล์โปรเจกต์ `.snapboard`, ไฮไลต์แบบปากกาเน้นข้อความ, callout, กรอบหน้าต่างเบราว์เซอร์/มือถือ, โหมด lite บนมือถือ, Chrome Extension (แคปหน้าจอเข้า board ตรง ๆ)

### ❌ ไม่ทำ (และเหตุผล)

| ฟีเจอร์ | เหตุผลที่ไม่ทำ |
|---|---|
| หมุนวัตถุ | สกรีนช็อตตั้งฉากเสมอ |
| Group / Ungroup / Lock | ออกแบบให้มีวัตถุน้อย |
| Align / Distribute แบบ manual | auto-layout ทำแทน ดีกว่า |
| Layers panel | ทำให้ดูเหมือน Photoshop = ผิดทาง |
| ปรับ brightness/contrast/saturation/sharpen | ไม่มี job รองรับ |
| วาดมือเปล่า (freehand) | ผลลัพธ์ดูไม่โปร และคนทำงานไม่ใช้เมาส์วาด |
| Template gallery | เพิ่มขั้นตอนการเลือกก่อนเริ่มงาน |
| บัญชีผู้ใช้ / cloud / collaboration | ทำลายจุดแข็ง "เปิดแล้วใช้ได้เลย" |
| AI enhance ผ่าน API ภายนอก | ทำลายคูเมือง privacy |
| Desktop app | OS มีเครื่องมือแคปอยู่แล้ว native ไม่ได้เพิ่มอะไร |
| รองรับวิดีโอ / GIF animation | คนละผลิตภัณฑ์ |

---

## 6. Competitive Analysis

### 6.1 กลุ่มที่ 1 — Online merge tools
*(imagecombiner.com, mergeimage.app, webtoolskitbox, screenshotedits)*

- **ทำได้ดี:** เร็วมาก, ทำงานในเบราว์เซอร์, ไม่ต้องล็อกอิน, ฟรี, บางตัวไม่อัปโหลด
- **ทำให้ซับซ้อนโดยไม่จำเป็น:** ไม่ซับซ้อน แต่ **จำกัดเกินไป**
- **ผู้ใช้ยังต้องทำเอง:** annotate, เซ็นเซอร์, ครอบตัด, ปรับลำดับหลังเห็นผล, ทำให้สวย
- **จุดอ่อนหลัก:** ผลลัพธ์คือรูปต่อกันดิบ ๆ ไม่มีเงา ไม่มีระยะห่าง ไม่มีคำอธิบาย → **ต่อรูปได้ แต่ "อธิบาย" ไม่ได้** และส่วนใหญ่ไม่มีปุ่ม copy-to-clipboard
- **เว็บพวกนี้เต็มไปด้วยโฆษณาและ SEO spam** → มีช่องว่างมหาศาลสำหรับเครื่องมือที่ดูดีและน่าเชื่อถือ

### 6.2 กลุ่มที่ 2 — Screenshot beautifier
*(Screely, Pika.style, Shots.so, snappify, Xnapper)*

- **ทำได้ดี:** ผลลัพธ์สวยมาก, พื้นหลังไล่สี, กรอบหน้าต่าง, ใช้ง่าย
- **ปัญหา:** ออกแบบมาสำหรับ **รูปเดียว** (marketing / social) ไม่ใช่หลายรูป
- **โมเดลธุรกิจ:** free tier มักติดลายน้ำ, ต้องจ่ายเพื่อเอาลายน้ำออก / ใช้กรอบอุปกรณ์
- **ช่องว่าง:** ไม่มีตัวไหนแก้ปัญหา "หลายรูป → หนึ่งคำอธิบาย" และหลายตัวประมวลผลฝั่งเซิร์ฟเวอร์

### 6.3 กลุ่มที่ 3 — Screenshot apps
*(CleanShot X, Shottr, Snagit, ShareX)*

- **ทำได้ดี:** แคปหน้าจอ + annotate ในไหลเดียว, OCR, แม่นระดับพิกเซล, cloud share
- **ปัญหา:** เป็น **native app** (CleanShot/Shottr = macOS เท่านั้น), ต้องติดตั้ง, บางตัวเสียเงิน, องค์กรบางที่ห้ามลง
- **สำคัญที่สุด:** เก่งเรื่อง **สกรีนช็อตใบเดียว** แต่ **การรวมหลายใบเป็น composition ยังทำได้แย่หรือทำไม่ได้**
- Snagit ทำได้แต่หนักและ UI แบบปี 2010

### 6.4 กลุ่มที่ 4 — เครื่องมือทั่วไป
*(Figma / FigJam, Canva, Excalidraw, Photopea, Miro)*

- **ทำได้ดี:** ทำอะไรก็ได้, ทรงพลัง, มีคนใช้อยู่แล้ว
- **ทำให้ซับซ้อนโดยไม่จำเป็น:** ต้องล็อกอิน (ยกเว้น Excalidraw/Photopea), ต้องสร้างไฟล์/โปรเจกต์, ต้องรู้จักเครื่องมือ, export มีหลายขั้น
- **ผู้ใช้ยังต้องทำเอง:** **จัดวางทุกอย่างเอง 100%** — ไม่มีตัวไหนที่ "วางรูปแล้วมันจัดให้สวย"
- Excalidraw ใกล้เคียงที่สุดในแง่ความเร็วและ zero-login แต่เป็น whiteboard วาดรูป ไม่ได้ optimize สำหรับรูปภาพหลายใบ และ export ยังต้องเลือกพื้นที่เอง
- Photopea = Photoshop ในเบราว์เซอร์ → พิสูจน์ว่าทำได้ทางเทคนิค แต่ก็พิสูจน์ว่า **ความสามารถเยอะ ≠ ใช้งานเร็ว**

### 6.5 สรุปช่องว่างในตลาด

```
                 ผลลัพธ์สวย/อธิบายได้
                          ▲
       snappify           │        ★ SNAPBOARD
       Canva              │
       Figma              │
   ───────────────────────┼───────────────────────▶  เร็ว / ไม่ต้องคิด
       Photopea           │        imagecombiner
       Snagit             │        mergeimage.app
                          │        webtoolskitbox
```

**ไม่มีใครอยู่มุมขวาบน** — เร็วเท่า merge tool + ผลลัพธ์ดีเท่า beautifier + อธิบายได้เหมือน annotation tool

### 6.6 ข้อได้เปรียบที่ยั่งยืน (moat)

1. **ความเร็วเป็นฟีเจอร์ที่ลอกยาก** — คู่แข่งที่ใหญ่กว่าจะเพิ่มฟีเจอร์เสมอ เราจะไม่เพิ่ม
2. **Zero-upload ที่พิสูจน์ได้** — Figma/Canva/Snagit-cloud ลอกไม่ได้เพราะขัดกับโมเดลธุรกิจเขา
3. **Auto-layout ที่เข้าใจสกรีนช็อต** — รู้ว่าภาพมือถือ 9:16 ควรวางแถวเดียว, ภาพ desktop กว้างควรวางซ้อนกัน, error message เล็ก ๆ ไม่ควรถูกยืด
4. **ไม่มี login** — เป็นข้อได้เปรียบด้าน conversion ที่วัดได้ทันที

**ความเสี่ยงเชิงกลยุทธ์:** ตลาดนี้ commoditized และหา rev ยาก — แนะนำให้มองเป็น **เครื่องมือฟรีคุณภาพสูง** (อาจ open-source) และหารายได้ทีหลังจาก extension/team ถ้าต้องการ ไม่ควรออกแบบ MVP รอบ ๆ การเก็บเงิน

---

## 7. Technical Architecture

### 7.1 การตัดสินใจเรื่อง Rendering (สำคัญที่สุด)

**ตัวเลือกที่พิจารณา:**

| แนวทาง | ข้อดี | ข้อเสีย |
|---|---|---|
| DOM + CSS (แก้ไข) + html2canvas (export) | สวยฟรี, ข้อความคมชัด, a11y ดี | **export ไม่ตรงกับที่เห็น** — ปัญหาคลาสสิกของ html2canvas, เบลอ/เซ็นเซอร์ทำยาก |
| Konva / Fabric.js | ได้ drag, transformer, hit-test ฟรี, export ตรง | +150–250KB, ต้องสู้กับ API ของ lib เรื่อง text/blur/DPI, ฟีเจอร์ 80% ที่เราไม่ใช้ |
| **Canvas 2D เขียนเอง + DOM overlay บาง ๆ** | **WYSIWYG 100%**, export = วาดซ้ำที่ scale N, เบลอ/pixelate ง่าย, bundle เล็ก, คุมทุกอย่าง | ต้องเขียน hit-test / handle เอง (~600 LOC), a11y ต้องใส่ใจ |

**ข้อเสนอ: Canvas 2D เขียนเอง + DOM overlay**

เหตุผล:
- Scene ของเรามีแค่ **5 ชนิด node** และ **ไม่มีการหมุน** → hit-test คือ AABB ธรรมดา งานจริง ~1 วัน
- ฟังก์ชันเดียว `renderScene(ctx, scene, { scale })` ใช้ทั้งตอนแสดงผลและตอน export
  → **ความเสี่ยง "export ไม่เหมือนที่เห็น" หายไปทั้งหมดโดยโครงสร้าง** (นี่คือความเสี่ยงอันดับ 1 ของผลิตภัณฑ์นี้)
- Export 2x/3x = เรียกฟังก์ชันเดิมด้วย `scale: 2` จบ
- เบลอ/pixelate สำหรับเซ็นเซอร์ = native บน canvas, ยากมากถ้าใช้ DOM
- DOM overlay ใช้เฉพาะ: handle ปรับขนาด, textarea ตอนแก้ข้อความ, toolbar ลอย (เหมือนที่ Excalidraw ทำ — พิสูจน์แล้ว)

**Phase 0 จะมี spike แบบจับเวลา (1 วัน) เพื่อยืนยันข้อนี้** ถ้าความเร็วในการพัฒนาช้ากว่าคาด → fallback เป็น Konva โดยยังคงโครง scene model เดิม (สลับได้เพราะ renderer ถูกแยกออกจาก state)

### 7.2 Stack

```
React 19 + TypeScript (strict)   — UI รอบ canvas, ecosystem ดี, หาคนดูแลง่าย
Vite 6                           — dev server เร็ว, build เล็ก
Zustand + Immer                  — state เล็ก ตรงไปตรงมา ไม่ต้อง boilerplate
Tailwind CSS v4 + Radix UI       — ทำ UI สะอาด/พรีเมียมได้เร็ว, a11y จาก Radix
Canvas 2D (เขียนเอง)              — renderer เดียวสำหรับ preview + export
Web Workers                      — decode รูป, ไม่บล็อก UI
IndexedDB (idb)                  — autosave scene + blob รูป
Vitest + Playwright + pixelmatch — unit / e2e / golden image
```

**ไม่มี backend ใน MVP** — เว็บเป็น static asset ล้วน
เหตุผล: ไม่มีฟีเจอร์ใดต้องการเซิร์ฟเวอร์เลย และการไม่มี backend คือ **ฟีเจอร์ด้านความปลอดภัย**

### 7.3 Scene Model

```ts
type BoardId = string & { __brand: 'BoardId' }
type NodeId  = string & { __brand: 'NodeId' }

interface Board {
  id: BoardId
  version: 1
  layout: LayoutMode            // 'auto' | 'rows' | 'columns' | 'grid' | 'compare' | 'steps' | 'free'
  layoutOpts: { columns?: number; gap: number; padding: number }
  background: Background        // solid | gradient | transparent
  style: ImageStylePreset       // 'plain' | 'card' | 'soft'
  nodes: Node[]                 // เรียงตาม z-order (ท้ายสุด = บนสุด)
  createdAt: number
  updatedAt: number
}

type Node = ImageNode | TextNode | ArrowNode | ShapeNode | BadgeNode | RedactNode

interface BaseNode { id: NodeId; frame: Rect }   // ไม่มี rotation โดยตั้งใจ

interface ImageNode extends BaseNode {
  kind: 'image'
  assetId: AssetId              // ชี้ไปที่ AssetStore ไม่ได้เก็บ pixel ใน state
  crop?: Rect                   // normalized 0..1
  caption?: string
  order: number                 // ลำดับตรรกะ ใช้โดย layout engine + badge เลข
}
```

**หลักการสำคัญ:** `Board` มีแต่ metadata ที่เบามาก (JSON ไม่กี่ KB)
pixel ทั้งหมดอยู่ใน `AssetStore` แยกต่างหาก
→ **undo/redo ใช้วิธี snapshot ทั้ง Board ได้เลย** ง่าย ถูกต้อง 100% ไม่ต้องทำ patch/inverse-op ที่บั๊กง่าย

### 7.4 Asset pipeline

```
File / ClipboardItem / DataTransfer
  → ตรวจ MIME + magic bytes
  → เก็บ Blob ต้นฉบับไว้ (สำหรับ export คุณภาพเต็ม)
  → Worker: createImageBitmap()  ── ได้ขนาดจริง
  → สร้าง display bitmap (ย่อให้ด้านยาวสุด ≤ 2048px) สำหรับวาดบนจอ
  → เก็บใน AssetStore: { id, blob, naturalSize, displayBitmap }
  → บันทึก blob ลง IndexedDB (async ไม่บล็อก)
```

- **Export** ใช้ blob ต้นฉบับ decode ใหม่ที่ความละเอียดที่ต้องการ → ไม่เสียคุณภาพ
- **หน้าจอ** ใช้ display bitmap → ประหยัด VRAM มาก (รูป 4K 20 ใบ = ~1.3GB ถ้าไม่ย่อ)
- ลบ node → `bitmap.close()` + `URL.revokeObjectURL()` + ลบจาก IDB (นับ reference เพราะรูปเดียวอาจถูก duplicate)

### 7.5 Layout Engine (หัวใจของผลิตภัณฑ์)

ฟังก์ชันบริสุทธิ์ ทดสอบง่าย:
```ts
function computeLayout(nodes: ImageNode[], mode: LayoutMode, opts): Rect[]
```

**โหมด:**
| โหมด | พฤติกรรม |
|---|---|
| `auto` | เลือกโหมดที่เหมาะที่สุดให้เอง (ดูฮิวริสติกด้านล่าง) |
| `rows` | เรียงเป็นแถว แต่ละแถวสูงเท่ากัน กว้างเต็มพอดี (justified แบบ Google Photos) |
| `columns` | คอลัมน์เดียว กว้างเท่ากัน — ดีสำหรับสกรีนช็อต desktop |
| `grid` | ตาราง N คอลัมน์ ช่องเท่ากัน |
| `compare` | 2 ใบเคียงกัน สูงเท่ากัน + ป้าย "ก่อน/หลัง" |
| `steps` | คอลัมน์เดียว + badge เลขอัตโนมัติ + caption |
| `free` | ผู้ใช้ควบคุมเอง (เข้าโหมดนี้อัตโนมัติเมื่อผู้ใช้ลากย้ายรูป) |

**ฮิวริสติกของ `auto`** (จุดที่ทำให้เราต่างจากคู่แข่ง):
- 2 รูป อัตราส่วนใกล้เคียงกัน → `compare`
- ทุกรูปเป็นแนวตั้ง (ratio < 0.75) → `rows` แถวเดียว (สกรีนช็อตมือถือ)
- ทุกรูปกว้าง (ratio > 1.5) → `columns` เรียงลงล่าง (สกรีนช็อต desktop เต็มจอ)
- 4 หรือ 6 รูปขนาดใกล้กัน → `grid` 2 คอลัมน์
- นอกนั้น → `rows` justified
- รูปเล็กมาก (< 300px เช่น error dialog) → **ไม่ยืดให้ใหญ่** วางไว้ขนาดเดิม (ยืดแล้วเบลอ = ดูไม่โปร)

**สำคัญ:** เมื่อผู้ใช้ลากย้ายรูปเอง → เปลี่ยนเป็น `free` และแสดง toast "จัดวางอัตโนมัติปิดแล้ว · [เปิดใหม่]"
ห้ามให้ auto-layout กระโดดมาจัดใหม่ทับงานที่ผู้ใช้ทำเอง — นี่คือบั๊ก UX ที่เจ็บที่สุด

### 7.6 Export pipeline

```ts
async function exportBoard(board, { scale, format, quality }): Promise<Blob> {
  const bounds = computeContentBounds(board)          // + padding
  guardCanvasSize(bounds, scale)                      // ลด scale ถ้าเกินลิมิตเบราว์เซอร์
  const canvas = new OffscreenCanvas(w * scale, h * scale)
  await renderScene(canvas.getContext('2d'), board, { scale, assets: fullRes })
  return canvas.convertToBlob({ type: format, quality })
}
```

**Clipboard (จุดที่พังง่ายที่สุด — ต้องทำให้ถูก):**
```ts
// ต้องส่ง Promise เข้า ClipboardItem โดยตรง
// ห้าม await ก่อน มิฉะนั้น Safari จะทิ้ง user activation แล้ว copy ล้มเหลว
await navigator.clipboard.write([
  new ClipboardItem({ 'image/png': exportBoard(board, { scale: 2, format: 'image/png' }) })
])
```
- ตรวจด้วย `ClipboardItem.supports?.('image/png')` ก่อน
- Firefox: `ClipboardItem` อยู่หลัง flag จนถึง v126 → **fallback = ดาวน์โหลดทันที + toast อธิบาย**
- ต้องอยู่ใน user gesture เสมอ (click / keydown) ห้ามเรียกใน `setTimeout`
- ขีดจำกัดขนาด canvas: Safari/iOS จำกัดพื้นที่ canvas → `guardCanvasSize` ลด scale ลงอัตโนมัติและแจ้งผู้ใช้

### 7.7 โครงสร้างโปรเจกต์

```
snapboard/
├─ docs/
│  ├─ 00-product-plan.md          ← เอกสารนี้
│  ├─ decisions/                  ← ADR (บันทึกการตัดสินใจสถาปัตยกรรม)
│  └─ phases/                     ← สรุปเมื่อจบแต่ละ phase
├─ src/
│  ├─ app/                        App shell, theme, error boundary, routes
│  ├─ board/
│  │  ├─ model/                   types, factories, invariants
│  │  ├─ store/                   zustand store, history, selectors
│  │  ├─ layout/                  computeLayout + ฮิวริสติก (pure)
│  │  ├─ render/                  renderScene, drawImage/Text/Arrow/Redact, textLayout
│  │  ├─ interact/                hit-test, drag, resize, marquee, snapping
│  │  └─ export/                  exportBoard, clipboard, download, canvas guards
│  ├─ assets/                     AssetStore, decode worker, mime/magic-byte guard
│  ├─ persist/                    IndexedDB adapter, autosave, migrations
│  ├─ ui/                         TopBar, Toolbar, FloatingToolbar, EmptyState, Toast
│  ├─ hooks/                      useKeyboard, usePaste, useDropZone, useZoomPan
│  └─ lib/                        geometry, id, format, invariant
├─ tests/
│  ├─ unit/                       vitest
│  ├─ e2e/                        playwright
│  └─ golden/                     ภาพอ้างอิง + pixelmatch
└─ public/                        ฟอนต์ (self-host), icons, manifest
```

---

## 8. Data & Storage Strategy

### 8.1 ข้อเสนอ: local-only แบบมีชั้น

| ชั้น | เก็บอะไร | เทคโนโลยี | อายุ |
|---|---|---|---|
| Runtime | ImageBitmap, canvas | หน่วยความจำ | จนกว่าจะปิดแท็บ |
| Session recovery | board ปัจจุบัน + blob รูป | IndexedDB | ถาวรจนกว่าผู้ใช้ล้าง |
| ประวัติ board | 10 board ล่าสุด | IndexedDB (Phase 6) | LRU |
| ไฟล์โปรเจกต์ | `.snapboard` (zip: board.json + รูป) | ดาวน์โหลด/อัปโหลด | ผู้ใช้ถือเอง (Phase 6) |
| Cloud | — | ไม่มี | — |

### 8.2 เหตุผล

- **ไม่มีบัญชีผู้ใช้ใน MVP** — เพราะไม่มีฟีเจอร์ใดต้องการ และ zero-login คือจุดขาย
- **IndexedDB ไม่ใช่ localStorage** — localStorage เก็บได้ ~5MB และเป็น string เท่านั้น เก็บ Blob ไม่ได้
- **Autosave แบบ debounce 800ms** — ผู้ใช้ไม่ต้องกด save ตลอดกาล
- เปิดเว็บใหม่ → เจอ board เดิม + แถบเล็ก ๆ "กู้คืนงานล่าสุดแล้ว · [เริ่มใหม่]"
- ปุ่ม **"ล้างข้อมูลทั้งหมด"** ในเมนู — สำคัญมากสำหรับคนใช้คอมสาธารณะ/แชร์เครื่อง
- แจ้งเตือนเมื่อ storage quota ใกล้เต็ม (`navigator.storage.estimate()`)

### 8.3 Migration
`board.version` มีตั้งแต่วันแรก + ฟังก์ชัน migrate ต่อเวอร์ชัน
ถ้าอ่านไม่ได้ → ทิ้งอย่างสง่างาม ไม่ทำให้แอปพัง

---

## 9. Privacy Strategy

### 9.1 คำสัญญา
> รูปของคุณไม่เคยออกจากเครื่องคุณ · ไม่มีบัญชี · ไม่มีการอัปโหลด · ไม่มีการติดตาม

### 9.2 การบังคับใช้ทางเทคนิค (ไม่ใช่แค่คำพูดใน privacy policy)

```
Content-Security-Policy:
  default-src 'self';
  img-src 'self' blob: data:;
  connect-src 'none';        ← สำคัญที่สุด: แอปยิง network ไม่ได้เลยแม้จะอยากยิง
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  object-src 'none';
  frame-ancestors 'none';
  base-uri 'none';
```

- **ฟอนต์ self-host** (ไม่ใช้ Google Fonts) — ไม่งั้น IP ผู้ใช้รั่วไปหา Google
- **ไม่มี analytics ในหน้าเอดิเตอร์** — ถ้าต้องการ analytics ให้อยู่เฉพาะหน้า landing (คนละ route/origin) ที่ไม่มีรูปผู้ใช้
- ผู้ใช้ **ตรวจสอบได้เอง** — เปิด DevTools > Network แล้วเห็นว่าว่างเปล่า, หรือถอดสาย LAN แล้วแอปยังทำงานได้ (PWA)
- แสดงคำสัญญานี้ที่ empty state และมีหน้า `/privacy` สั้น ๆ อ่านจบใน 30 วินาที

### 9.3 Trade-offs ที่ต้องยอมรับ

| ได้ | เสีย |
|---|---|
| องค์กร/ฝ่าย compliance อนุมัติได้ง่าย | ไม่มีลิงก์แชร์ (ผู้ใช้ต้องส่งไฟล์เอง — แต่นั่นคือ workflow ที่เขาทำอยู่แล้ว) |
| ไม่มีต้นทุน server, scale ฟรี | ทำงานข้ามอุปกรณ์ไม่ได้ |
| ไม่มีความเสี่ยงข้อมูลรั่ว, ไม่ต้องทำ GDPR/PDPA data processing | วัดผลการใช้งานจริงยาก (ต้องพึ่ง feedback ตรง) |
| โหลดเร็ว offline ได้ | กู้คืนไม่ได้ถ้าผู้ใช้ล้างข้อมูลเบราว์เซอร์ |

**ถ้าอนาคตจะเพิ่ม cloud:** ต้องเป็น **opt-in ต่อ board** เท่านั้น, ต้องเข้ารหัสฝั่ง client, และต้องไม่ทำให้ flow เดิมช้าลงแม้แต่คลิกเดียว

---

## 10. Security

| ความเสี่ยง | มาตรการ |
|---|---|
| **SVG ที่มีสคริปต์ฝัง** | **ไม่รับ SVG ใน MVP** (Phase 6 ค่อยรับโดย rasterize ผ่าน `<img>` + blob URL ซึ่งไม่รันสคริปต์ และห้าม inline ลง DOM เด็ดขาด) |
| ไฟล์ปลอม (นามสกุลรูปแต่ไม่ใช่รูป) | ตรวจ magic bytes ไม่เชื่อ MIME จาก OS; ถ้า decode ไม่ผ่าน → ปฏิเสธพร้อมข้อความสุภาพ |
| Decompression bomb (รูป 60000×60000) | จำกัดพื้นที่พิกเซล (เช่น ≤ 100MP) และขนาดไฟล์ (≤ 50MB/รูป) ก่อน decode |
| XSS ผ่าน caption / ข้อความ annotation | ข้อความถูกวาดลง canvas ด้วย `fillText` **ไม่เคยเข้าสู่ DOM เป็น HTML** → พื้นผิวการโจมตีแทบเป็นศูนย์; textarea ตอนแก้ไขใช้ค่า `.value` เท่านั้น |
| ชื่อไฟล์อันตรายตอน export | sanitize ชื่อไฟล์, ตัดอักขระควบคุม/path separator |
| Clipboard permission abuse | เราแค่ **เขียน** clipboard ในจังหวะ user gesture เท่านั้น; **ไม่เคยอ่าน** clipboard แบบเงียบ ๆ (อ่านเฉพาะตอนผู้ใช้กด Ctrl+V ซึ่งเป็น paste event) |
| Supply chain (npm) | dependency น้อยมาก, ล็อกเวอร์ชัน, `npm audit` ใน CI, ไม่ใช้ lib ที่โหลดโค้ดตอน runtime |
| Clickjacking | `frame-ancestors 'none'` |
| ข้อมูลค้างในเครื่องสาธารณะ | ปุ่มล้างข้อมูล + แจ้งเตือนตอนกู้คืน board |

**หลักการ:** พื้นผิวการโจมตีของแอปนี้เล็กผิดปกติเพราะ **ไม่มี server, ไม่มี user content ที่แชร์กัน, ไม่มี HTML rendering ของ input ผู้ใช้** — เราต้องรักษาคุณสมบัตินี้ไว้ในทุกฟีเจอร์ใหม่

---

## 11. Performance Strategy

### 11.1 งบประมาณประสิทธิภาพ (Performance Budget)

| ตัวชี้วัด | เป้าหมาย |
|---|---|
| First paint (โหลดครั้งแรก) | < 1.0s บน 4G |
| JS bundle (gzip) | < 200KB |
| เวลาจากวางรูป → เห็นรูปบน board | < 300ms (รูป 4K) |
| ลาก/ปรับขนาด | 60fps ตลอด |
| วาง 10 รูปพร้อมกัน | < 2s ทั้งหมด, UI ไม่ค้างเลย |
| Export 2x ของ board 10 รูป | < 3s |
| หน่วยความจำ, 20 รูป 4K | < 600MB |

### 11.2 เทคนิค

- **Decode ใน Worker** ด้วย `createImageBitmap` → main thread ไม่เคยค้าง
- **Display bitmap ย่อ** (≤2048px ด้านยาว) แยกจาก blob ต้นฉบับ
- **Canvas 2 ชั้น:** ชั้นเนื้อหา (วาดใหม่เมื่อ scene เปลี่ยน) + ชั้น interaction (handle/guide วาดใหม่ทุกเฟรม) → ลากรูปแล้วไม่ต้องวาดรูปอื่นใหม่
- **Dirty-rect rendering** เมื่อจำเป็น (Phase 6, เฉพาะถ้าวัดแล้วช้าจริง)
- **rAF-throttled** ทุก pointer handler
- **Progressive placeholder** — แสดงกรอบเทาก่อน decode เสร็จ ผู้ใช้เห็น layout ทันที
- **DPR-aware** — canvas คูณ `devicePixelRatio` (จำกัดที่ 2 เพื่อกันจอ 3x กินแรงเกิน)
- **Lazy** — โค้ด export/crop/annotation แยก chunk โหลดเมื่อใช้
- **หลีกเลี่ยง** re-render React ตอนลาก — ตำแหน่งขณะลากอยู่ใน ref ไม่ใช่ state, commit เข้า store ตอนปล่อยเมาส์เท่านั้น

### 11.3 กรณีขอบที่ต้องรับมือ

| กรณี | พฤติกรรม |
|---|---|
| สกรีนช็อต full-page สูง 20000px | ย่อลงพอดี column, มีปุ่ม "ครอบตัด" แนะนำ |
| รูป 5000px วางลงไป | **ไม่แสดงที่ขนาดดิบ** — layout engine กำหนดขนาดที่พอดีเสมอ |
| PNG โปร่งใส | รักษา alpha, แสดงลายหมากรุกใต้รูปเฉพาะตอนแก้ไข ไม่ติดไป export |
| รูปซ้ำกัน | อนุญาต (บางทีตั้งใจ) แต่ dedupe ที่ระดับ asset ด้วย content hash → ประหยัดหน่วยความจำ |
| ลากไฟล์ 50 ไฟล์ | ประมวลผลทีละ 4, แสดงความคืบหน้า, ยกเลิกได้ |
| ไฟล์ HEIC (จาก iPhone) | เบราว์เซอร์ decode ไม่ได้ → แจ้งชัดเจน "ไฟล์ HEIC ยังไม่รองรับ ลองแปลงเป็น JPG" |
| หน่วยความจำใกล้เต็ม | ปล่อย display bitmap ของรูปนอกจอ, สร้างใหม่เมื่อต้องใช้ |

---

## 12. Phase-by-Phase Roadmap

> หลักการ: **ทุก phase ต้องได้ของที่ใช้งานได้จริง** และ Phase 1 เพียงลำพังก็ดีกว่า merge tool ทุกตัวในตลาดแล้ว

### Phase 0 — ตรวจสอบทางเทคนิค (1–2 วัน)
- **วัตถุประสงค์:** ล้มความเสี่ยงที่ล้มโปรเจกต์ได้ ก่อนลงทุนเขียนจริง
- **งาน (spike แบบทิ้งได้):**
  1. เขียน canvas ลง clipboard ให้สำเร็จบน Chrome / Edge / Safari / Firefox — ยืนยันเทคนิค Promise-in-ClipboardItem
  2. วัดเวลา decode รูป 4K จำนวน 20 ใบผ่าน worker + วัดหน่วยความจำ
  3. หา limit ขนาด canvas จริงในแต่ละเบราว์เซอร์
  4. ต้นแบบ `renderScene` + hit-test ~200 บรรทัด → ตัดสินใจ **เขียนเอง vs Konva**
  5. ทดสอบ paste event: ได้ไฟล์จาก Windows Snipping Tool / macOS screenshot / Chrome "copy image"
- **DoD:** มี ADR 5 ฉบับใน `docs/decisions/` พร้อมผลวัดจริง + ตัดสินใจเรื่อง renderer แล้ว
- **ความเสี่ยง:** clipboard บน Firefox อาจต้อง fallback ถาวร (ยอมรับได้)

### Phase 1 — Core loop: วาง → จัด → คัดลอก (5–7 วัน)
- **วัตถุประสงค์:** ทำ **วงจรคุณค่าหลักให้ครบ** ตั้งแต่ต้นจนจบ
- **ฟีเจอร์:** paste, drag-drop หลายไฟล์, ปุ่มเลือกไฟล์, auto-layout 5 โหมด + ฮิวริสติก, พื้นหลัง (ขาว/ดำ/เทา/โปร่งใส), style preset 3 แบบ, slider ระยะห่าง+ขอบ, canvas โตอัตโนมัติ, ปุ่มคัดลอก, ปุ่มบันทึก PNG, empty state
- **งานเทคนิค:** scene model, store, layout engine, renderScene, asset pipeline + worker, export pipeline, clipboard + fallback
- **งาน UX:** empty state, drop overlay, animation รูปเข้าตำแหน่ง, toast "คัดลอกแล้ว"
- **Acceptance:**
  - วางรูป 3 ใบ → ได้ผลลัพธ์ที่ส่งได้โดยไม่ต้องแก้อะไร
  - **TTC < 20 วินาที** (วัดจริงกับคน 3 คนที่ไม่เคยเห็นแอป)
  - Ctrl+V แล้ววาง Ctrl+V ในแอปอื่นได้บน Chrome/Edge/Safari
- **DoD:** deploy ขึ้น staging, e2e ผ่านทั้ง 3 เบราว์เซอร์, มี golden image test, เขียน `docs/phases/phase-1.md`
- **ความเสี่ยง:** ฮิวริสติก auto-layout ให้ผลไม่สวยในบางชุดรูป → เก็บชุดรูปทดสอบจริงไว้ 10 ชุดตั้งแต่วันแรก

### Phase 2 — ควบคุมด้วยมือ + undo (4–6 วัน)
- **วัตถุประสงค์:** ให้ทางหนีทีไล่เมื่อ auto-layout ไม่ตรงใจ
- **ฟีเจอร์:** เลือก/หลายเลือก (คลิก, shift-คลิก, ลากกรอบ), ย้าย, ปรับขนาด (คงอัตราส่วน), ลากสลับลำดับใน auto mode, ลบ, ทำซ้ำ, จัดลำดับชั้น, snapping + guide, zoom/pan/fit, undo/redo, คีย์ลัดครบ, autosave กันแท็บปิด
- **งานเทคนิค:** interact layer, history (snapshot), interaction canvas ชั้นสอง, IndexedDB autosave
- **Acceptance:** ลากรูป 10 ใบได้ 60fps · undo ย้อนได้ 50 ขั้น · ปิดแท็บแล้วเปิดใหม่งานยังอยู่ · ทุกการกระทำมีคีย์ลัด
- **DoD:** unit test ครอบคลุม geometry/history/layout · e2e drag-resize-undo · `docs/phases/phase-2.md`

### Phase 3 — Export ระดับโปรดักชัน (3–4 วัน)
- **วัตถุประสงค์:** ทำให้ทางออกของผลิตภัณฑ์เชื่อถือได้ 100%
- **ฟีเจอร์:** เลือก 1x/2x/3x, PNG/JPG + คุณภาพ, พื้นหลังโปร่งใส, ตั้งชื่อไฟล์อัตโนมัติแบบมีความหมาย (`snapboard-2026-09-10-1432.png`), แสดงขนาดผลลัพธ์ก่อน export, guard ขนาด canvas, fallback ทุกเบราว์เซอร์, คัดลอกด้วยคีย์ลัด
- **Acceptance:** export ตรงกับที่เห็น 100% (pixel diff < 0.1%) · canvas 15000px ไม่ crash · Firefox fallback ทำงานสวยงาม
- **DoD:** ทดสอบวางลงจริงใน Slack, LINE, Jira, Gmail, Word, Figma, Google Docs — ทำเป็นตารางผล

### Phase 4 — คำอธิบายภาพ (5–7 วัน)
- **วัตถุประสงค์:** เปลี่ยนจาก "ต่อรูป" เป็น "อธิบาย"
- **ฟีเจอร์:** ลูกศร (โค้งเล็กน้อย ดูเป็นมิตร), กล่องกรอบ, ข้อความ, badge เลขอัตโนมัติ, เซ็นเซอร์ (เบลอ/pixelate/ทึบ), caption ใต้รูป, ครอบตัด
- **งานเทคนิค:** node types ใหม่ใน renderer, text layout engine (ตัดบรรทัดด้วย `measureText` — ใช้ตัวเดียวกันทั้ง preview และ export), textarea overlay, crop interaction
- **งาน UX:** เครื่องมือ 5 ปุ่ม กดคีย์เดียวสลับได้, สีอัตโนมัติ (แดงเป็นค่าเริ่มต้น เห็นชัดบนทุกพื้นหลัง), ขนาดลูกศร/ฟอนต์ปรับตาม board scale
- **Acceptance:** ใส่ลูกศร+เลขบน bug report เสร็จใน < 15 วินาที · เซ็นเซอร์แล้วข้อมูลเดิม **กู้คืนจากไฟล์ export ไม่ได้จริง ๆ** (ทดสอบด้วยการซูม)
- **ความเสี่ยง:** เซ็นเซอร์แบบเบลอ อาจถูกกู้คืนได้ถ้าเบลอน้อย → **บังคับ pixelate ขั้นต่ำที่ปลอดภัย** และแนะนำ "ทึบ" เป็นค่าเริ่มต้นสำหรับข้อมูลอ่อนไหว

### Phase 5 — ความประณีต (4–5 วัน)
- **วัตถุประสงค์:** ทำให้รู้สึก "พรีเมียม" ไม่ใช่ "เครื่องมือฟรีบนเว็บ"
- **ฟีเจอร์:** design system เก็บกวาด, พื้นหลังไล่สี 6 แบบ, dark mode, animation/micro-interaction, right-click menu, หน้า help คีย์ลัด (`?`), ข้อความ error ที่เป็นมิตรทุกจุด, a11y (focus ring, ARIA, ใช้คีย์บอร์ดล้วนได้), i18n ไทย/อังกฤษ, โหมด lite บนมือถือ
- **Acceptance:** ผู้ใช้ใหม่ 5 คนเข้าใจภายใน 10 วินาทีโดยไม่ต้องอธิบาย · Lighthouse a11y > 95

### Phase 6 — คงอยู่และออฟไลน์ (3–4 วัน)
- **ฟีเจอร์:** เก็บหลาย board + หน้ารายการ, PWA + offline เต็มรูปแบบ, ไฟล์โปรเจกต์ `.snapboard`, ล้างข้อมูล, แจ้งเตือน quota, รองรับ SVG แบบ rasterize
- **Acceptance:** ถอด internet แล้วใช้งานได้ครบทุกฟีเจอร์

### Phase 7 — Chrome Extension (แยกโปรเจกต์, ประเมินใหม่ก่อนเริ่ม)
- **วัตถุประสงค์:** ตัดขั้นตอน "เซฟรูป" ออกจากชีวิตผู้ใช้
- **ฟีเจอร์:** แคปพื้นที่/ทั้งหน้า (เลื่อนต่อภาพ) → เข้า board ตรง, คลิกขวาที่รูปในเว็บ → "เพิ่มลง Snapboard"
- **เงื่อนไขก่อนเริ่ม:** Phase 1–5 ต้องมีผู้ใช้จริงและมี feedback ยืนยันว่าขั้นตอน "เซฟรูป" คือความเจ็บปวดจริง
- **ความเสี่ยง:** MV3, การรีวิวของ Chrome Web Store, การต่อภาพเลื่อนหน้าจอยากกว่าที่คิดเสมอ

### Phase 8 — เซ็นเซอร์อัตโนมัติในเครื่อง (ตัวเลือก)
- OCR ในเครื่อง (tesseract.js / WebGPU) → ตรวจอีเมล เบอร์โทร เลขบัตร API key → เสนอเซ็นเซอร์ให้
- **โหลดแบบ lazy เท่านั้น** และต้องไม่มี network — เป็นฟีเจอร์เดียวในหมวด "AI" ที่ผมเห็นด้วย เพราะมันเสริมคูเมือง privacy แทนที่จะทำลาย

**รวมเวลาโดยประมาณ Phase 0–5 (MVP ที่ปล่อยได้จริง): ~4–6 สัปดาห์**

---

## 13. Testing Strategy

### 13.1 พีระมิดการทดสอบ

**Unit (Vitest) — เร็ว เยอะ**
- `computeLayout` ทุกโหมด + ฮิวริสติก `auto` (ทดสอบด้วยชุดอัตราส่วนจริง)
- geometry: hit-test, snapping, bounds, crop
- history: undo/redo, การรวม action ที่ต่อเนื่องกัน
- text layout: การตัดบรรทัด (ต้องได้ผลเดียวกันเสมอ)
- asset guard: magic bytes, ขนาดเกิน, ไฟล์เสีย
- ตัวสร้างชื่อไฟล์, การ sanitize

**Golden image (Vitest + pixelmatch) — หัวใจของความมั่นใจ**
- scene ตัวอย่าง 12 แบบ → `renderScene` → เทียบกับ PNG อ้างอิงที่ commit ไว้
- ทดสอบ **ที่ scale 1x และ 2x** เพื่อยืนยันว่า export ขยายถูกต้อง
- จับ regression ด้านการวาดที่ e2e จับไม่ได้

**Integration (Vitest + jsdom/happy-dom)**
- store + layout + persist ทำงานร่วมกัน
- autosave/restore ผ่าน fake IndexedDB

**E2E (Playwright — Chromium, WebKit, Firefox)**
- ลากไฟล์จริงเข้าไป (สร้าง `DataTransfer` ใน page context)
- **paste event** (สร้าง ClipboardEvent พร้อม image blob)
- **clipboard write** — Chromium ให้สิทธิ์ผ่าน context permission; WebKit ยืนยันว่าไม่ throw; Firefox ยืนยันว่า fallback เป็นดาวน์โหลด
- export → เปิดไฟล์ที่ดาวน์โหลด → ตรวจขนาด + ค่าสีบางจุด
- drag/resize/undo/redo ด้วยเมาส์จริง
- คีย์ลัดทุกตัว
- โหลดรูปใหญ่ (8000×6000) แล้วไม่ค้าง

**Performance (Playwright + tracing)**
- วัด TTC อัตโนมัติในสถานการณ์จำลอง
- assert ว่า frame ตกไม่เกิน N% ตอนลาก
- assert ขนาด bundle ใน CI

### 13.2 การทดสอบด้วยมือ (ทำทุก phase)

**สถานการณ์หลัก ที่ต้องรู้สึกดีเยี่ยม:**
```
เปิดเว็บ → Win+Shift+S แคป → Ctrl+V → แคปอีก → Ctrl+V → แคปอีก → Ctrl+V
  → ใส่ลูกศร → Ctrl+Shift+C → สลับไป Slack → Ctrl+V → กด Enter
```
ต้องทำได้ **โดยไม่ต้องคิด** และไม่มีจังหวะไหนที่รู้สึกสะดุด

**เมทริกซ์:**
| OS | เบราว์เซอร์ | ระดับ |
|---|---|---|
| Windows 11 | Chrome, Edge | **บังคับ** |
| macOS | Chrome, Safari | **บังคับ** |
| Windows/macOS | Firefox | รองรับแบบมี fallback |
| iPadOS | Safari | โหมด lite (Phase 5) |
| Android | Chrome | โหมด lite (Phase 5) |

**ทดสอบการวางผลลัพธ์จริงใน:** Slack, LINE, Discord, Jira, Gmail, Outlook, Google Docs, Word, Notion, Figma
(ตารางนี้ต้องอัปเดตทุก Phase 3+ เพราะแต่ละแอปรับ clipboard image ต่างกัน)

**ทดสอบกับคนจริง:** ทุก phase ให้คน 3 คนที่ไม่เคยเห็นแอป ทำ task โดยไม่มีคำอธิบาย แล้วจับเวลา + สังเกตจุดที่ลังเล

---

## 14. Deployment Strategy

- **Static hosting** — Cloudflare Pages (หรือ Vercel static / Netlify) ไม่มี server-side runtime
- **CI (GitHub Actions):** typecheck → lint → unit → golden → build → e2e (3 เบราว์เซอร์) → ตรวจ bundle size → deploy preview
- **Branch:** `main` = production, ทุก PR ได้ preview URL
- **Headers:** CSP ตามข้อ 9.2, `Permissions-Policy` ปิดทุกอย่างที่ไม่ใช้, HSTS, `X-Content-Type-Options: nosniff`
- **Caching:** asset มี hash → immutable 1 ปี; `index.html` ไม่ cache
- **Versioning:** แสดงเวอร์ชัน+commit ในเมนู help เพื่อให้ผู้ใช้แจ้งบั๊กได้แม่น
- **Error tracking:** ⚠️ **ไม่ใช้ Sentry แบบส่งข้อมูลออก** ในหน้าเอดิเตอร์ (ขัด `connect-src 'none'`) — ใช้ error boundary ที่แสดงข้อมูลให้ผู้ใช้คัดลอกส่งเองแทน
- **Rollback:** deploy ก่อนหน้าคงอยู่, กดย้อนได้ทันที

---

## 15. Risks & Trade-offs

| # | ความเสี่ยง | ผลกระทบ | โอกาส | การรับมือ |
|---|---|---|---|---|
| R1 | **Export ไม่ตรงกับที่เห็นบนจอ** | สูงมาก (ทำลายความเชื่อใจ) | ต่ำ (ถ้าใช้ renderer เดียว) | สถาปัตยกรรม renderer เดียว + golden image test ตั้งแต่ Phase 1 |
| R2 | Clipboard write ล้มเหลวในบางเบราว์เซอร์/บริบท | สูง | กลาง | ตรวจความสามารถล่วงหน้า, fallback ดาวน์โหลดทันทีแบบไร้รอยต่อ, ทดสอบใน CI |
| R3 | **auto-layout จัดออกมาไม่สวยในเคสจริง** | สูง (นี่คือจุดขาย) | กลาง | เก็บชุดรูปจริง 10+ ชุดเป็น fixture ตั้งแต่วันแรก, golden test, ปรับฮิวริสติกจาก feedback |
| R4 | ขอบเขตงานบานปลายกลับไปเป็น image editor | สูง | **สูง** | รายการ "ไม่ทำ" ในข้อ 5 คือสัญญา; ทุกฟีเจอร์ใหม่ต้องตอบได้ว่าลด TTC อย่างไร |
| R5 | หน่วยความจำระเบิดเมื่อรูปเยอะ/ใหญ่ | กลาง | กลาง | display bitmap ย่อ, ปล่อยทรัพยากรเมื่อลบ, ทดสอบ 20 รูป 4K ในทุก phase |
| R6 | ขีดจำกัดขนาด canvas (Safari/iOS) | กลาง | กลาง | `guardCanvasSize` ลด scale อัตโนมัติ + แจ้งผู้ใช้อย่างเข้าใจง่าย |
| R7 | ตลาด commoditized หา rev ยาก | กลาง (เชิงธุรกิจ) | สูง | วางตัวเป็นเครื่องมือฟรีคุณภาพสูง/สร้างชื่อ; อย่าออกแบบ MVP รอบการเก็บเงิน |
| R8 | เขียน renderer เองแล้วช้ากว่ากำหนด | กลาง | ต่ำ-กลาง | Phase 0 spike จับเวลา; fallback เป็น Konva โดย scene model ไม่ต้องเปลี่ยน |
| R9 | ผู้ใช้เสียงานเพราะปิดแท็บ | กลาง | สูง (ถ้าไม่มี autosave) | autosave IndexedDB ตั้งแต่ Phase 2 |
| R10 | เซ็นเซอร์ไม่ปลอดภัยจริง (เบลอกู้คืนได้) | **สูงมาก** (ข้อมูลลูกค้ารั่ว) | กลาง | pixelate ขั้นต่ำที่ปลอดภัย, ค่าเริ่มต้นเป็นทึบ, ลบพิกเซลจริงตอน export ไม่ใช่แค่วาดทับ |

### Trade-offs ที่เลือกอย่างตั้งใจ
- **ความเร็ว > ความสามารถ** — เราจะแพ้ Figma ทุกด้านยกเว้นด้านเดียวที่สำคัญ
- **ค่าเริ่มต้นที่ดี > ตัวเลือกเยอะ** — ยอมให้ 5% ปรับไม่ได้ดั่งใจ เพื่อให้ 95% ไม่ต้องปรับเลย
- **Local-only > ฟีเจอร์แชร์** — ยอมเสียลิงก์แชร์ เพื่อได้ความไว้วางใจจากองค์กร
- **Desktop-first > mobile parity** — job หลักเกิดบน desktop
- **เขียน renderer เอง > ใช้ library** — ยอมเขียนเพิ่ม เพื่อกำจัดความเสี่ยง R1 ทั้งหมด

---

## 16. Definition of Done (ใช้กับทุก Phase)

Phase จะถือว่าเสร็จก็ต่อเมื่อ **ครบทุกข้อ**:

1. ✅ ฟีเจอร์ทั้งหมดใน scope ทำงานได้ตาม acceptance criteria
2. ✅ Typecheck + lint ผ่านไม่มี warning
3. ✅ Unit + golden + e2e test ผ่านทั้งหมดใน CI (Chromium/WebKit/Firefox)
4. ✅ ทดสอบด้วยมือตามสถานการณ์หลัก (ข้อ 13.2) บน Windows/Chrome และ macOS/Safari
5. ✅ ไม่มี regression — ชุดทดสอบของ phase ก่อนหน้ายังผ่าน
6. ✅ อยู่ในงบประมาณประสิทธิภาพ (ข้อ 11.1) วัดจริง ไม่ใช่เดา
7. ✅ ตรวจ UX: ไม่มีสถานะที่ผู้ใช้ค้างโดยไม่มี feedback, ทุก error มีข้อความที่เป็นภาษาคน
8. ✅ ตรวจความปลอดภัย: ไม่มี network request ใหม่, ไม่มี input ผู้ใช้เข้า DOM เป็น HTML
9. ✅ เขียน `docs/phases/phase-N.md`: ทำอะไรไปบ้าง / ตัดสินใจอะไร / รู้ปัญหาอะไร / ต่อไปทำอะไร
10. ✅ Deploy ขึ้น preview และลองใช้จริงอย่างน้อย 1 งานจริง
11. ✅ แจ้งสรุปและระบุชัดเจนว่า **ขั้นต่อไปควรทำอะไร** แล้วรอไฟเขียว

---

## 17. Future Possibilities

### ✅ มีประโยชน์จริง (พิจารณาได้)
| ฟีเจอร์ | เหตุผล |
|---|---|
| Chrome Extension แคปหน้าจอ | ตัดขั้นตอน "เซฟรูป" ออก = ลด TTC โดยตรง |
| เซ็นเซอร์อัตโนมัติในเครื่อง (OCR) | เสริมคูเมือง privacy, แก้ pain จริงของ P4 |
| ครอบตัดอัตโนมัติ (ตัดขอบขาว/แถบเบราว์เซอร์) | ลดงานผู้ใช้, ทำได้ในเครื่องล้วน |
| ไฟล์โปรเจกต์ `.snapboard` | แก้งานต่อ/ส่งต่อได้ โดยไม่ต้องมี cloud |
| กรอบอุปกรณ์ (เบราว์เซอร์/มือถือ) | ทำให้ผลลัพธ์ดูโปรขึ้นมาก ต้นทุนต่ำ |
| ส่งออกเป็น PDF หลายหน้า | สำหรับรายงานยาว |

### ❌ ทำให้ผลิตภัณฑ์แย่ลง
| ฟีเจอร์ | เหตุผล |
|---|---|
| Collaboration / comment แบบ realtime | ต้องมีบัญชี+server = ทำลายทุกอย่างที่เราสร้าง; และคนคุยกันใน Slack อยู่แล้ว |
| Version history | ปัญหาที่ไม่มีอยู่จริงสำหรับงาน 30 วินาที |
| Team workspace / template ขององค์กร | เพิ่มความซับซ้อนแลกกับผู้ใช้ส่วนน้อย |
| AI สร้างคำอธิบายอัตโนมัติ | ต้องส่งรูปออกนอกเครื่อง = ฆ่าคูเมือง; และคำอธิบายที่ผิดแย่กว่าไม่มี |
| AI Smart Arrange | ฮิวริสติกธรรมดาทำได้ดีพอ เร็วกว่า ฟรี และคาดเดาได้ |
| ลิงก์แชร์ | ต้องมี server + storage + moderation + กฎหมายข้อมูล |
| รองรับวิดีโอ/GIF | คนละผลิตภัณฑ์ |

---

## 18. Product Positioning (สรุป)

| | |
|---|---|
| **หมวดหมู่** | Screenshot composer — เครื่องมือรวมสกรีนช็อตเพื่อการสื่อสาร (หมวดที่ยังไม่มีเจ้าตลาดชัดเจน) |
| **ผู้ใช้เป้าหมาย** | คนทำงานที่สื่อสารด้วยสกรีนช็อตทุกวัน: QA, Support, PM, Ops, admin, freelancer — **ไม่ใช่ดีไซเนอร์** |
| **Use case หลัก** | รวมสกรีนช็อต 2–8 ใบเป็นภาพเดียวที่อธิบายตัวเองได้ แล้วส่งต่อทันที |
| **คุณค่าหลัก** | เร็วที่สุดจาก "มีหลายรูป" → "มีภาพเดียวที่ส่งได้" โดยไม่ต้องมีทักษะออกแบบ ไม่ต้องล็อกอิน และรูปไม่ออกจากเครื่อง |
| **หนึ่งประโยค** | เว็บแอปที่เปลี่ยนสกรีนช็อตหลายรูปเป็นภาพอธิบายเดียวพร้อมส่ง ในไม่กี่วินาที โดยไม่ต้องล็อกอินและไม่มีการอัปโหลด |
| **Tagline** | "วาง จัด ก๊อป" · "หลายภาพ หนึ่งคำอธิบาย" |
| **ต่างอย่างไร** | merge tool = เร็วแต่ผลลัพธ์ดิบ · beautifier = สวยแต่รูปเดียว · Figma/Canva = เก่งแต่ช้าและต้องล็อกอิน · **Snapboard = เร็ว + สวย + อธิบายได้ + ส่วนตัว** |

### เรื่องชื่อ
โฟลเดอร์ปัจจุบันชื่อ **Snapboard** ซึ่งใช้ได้ดี — สื่อถึง snap (สกรีนช็อต) + board (พื้นที่รวม) จำง่าย ออกเสียงง่ายทั้งไทยและอังกฤษ

แต่ผมยังถือว่า **การตัดสินใจเรื่องชื่อยังเร็วเกินไป** ควรทำหลัง Phase 1 เมื่อเห็นผลิตภัณฑ์จริงแล้ว และต้องตรวจ:
- โดเมนว่างไหม
- ชนกับ "Snapboard" อื่นในตลาดหรือไม่ (มีผลิตภัณฑ์ชื่อใกล้เคียงหลายตัว)
- เครื่องหมายการค้า

**ระหว่างนี้ใช้ Snapboard เป็นชื่อชั่วคราวในโค้ดได้** โดยแยกชื่อแบรนด์ออกเป็นค่าคงที่จุดเดียว เพื่อเปลี่ยนทีหลังได้ในนาทีเดียว

---

## 19. คำแนะนำสุดท้าย

**สิ่งที่ควรทำต่อทันทีหลังอนุมัติ:** Phase 0 (spike 1–2 วัน)
เพราะผลของ Phase 0 อาจเปลี่ยนรายละเอียดของสถาปัตยกรรม และมันถูกมากที่จะรู้ตอนนี้

**สิ่งที่ต้องระวังที่สุดตลอดโปรเจกต์:** R4 — ขอบเขตบานปลาย
ทุกครั้งที่จะเพิ่มฟีเจอร์ ให้ถามคำถามเดียว:

> ฟีเจอร์นี้ทำให้ **Time-To-Copy สั้นลง** หรือทำให้ **ผู้รับเข้าใจเร็วขึ้น** หรือเปล่า?

ถ้าตอบไม่ได้ทันที → ไม่ทำ

---

## 20. การตัดสินใจที่ได้รับอนุมัติ (2026-09-10)

| หัวข้อ | การตัดสินใจ |
|---|---|
| ทิศทางผลิตภัณฑ์ | ✅ **Layout-first** — จัดวางอัตโนมัติทันทีที่วางรูป, ย้าย/ปรับขนาดอิสระเป็นทางเลือกรอง |
| ภาษา UI | ✅ **อังกฤษก่อน** แล้วเพิ่มภาษาไทยใน Phase 5 — แต่ต้องวางโครง i18n รองรับไว้ตั้งแต่แรก (ห้าม hardcode string ในคอมโพเนนต์) |
| ขอบเขตรอบนี้ | ✅ **Phase 0 + Phase 1** แล้วหยุดให้รีวิว |
| ชื่อผลิตภัณฑ์ | Snapboard (ชั่วคราว) — แยกเป็นค่าคงที่จุดเดียวเพื่อเปลี่ยนภายหลัง |
