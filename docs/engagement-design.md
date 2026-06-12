# Engagement & Gamification — Design Document

ออกแบบฟีเจอร์ทั้งหมดจากเซสชันระดมไอเดีย "ความสนุก + การเรียนรู้ระยะยาว"
ทุก design อิงกับ schema/flow ที่มีอยู่จริงใน codebase (อ้างไฟล์ประกอบ) — ไม่ใช่ spec ลอย ๆ

> **หลักการรวม:** เกือบทุกฟีเจอร์ gamification พึ่งโครงสร้างพื้นฐานเดียวกันคือ
> **Event/XP pipeline (§0)** — สร้างครั้งเดียว แล้ว Streak, Level, Badge, Combo,
> Leaderboard, Hint-cost ต่อท่อจากมันทั้งหมด อย่าสร้างแยกทีละฟีเจอร์

---

## §0 โครงสร้างพื้นฐานร่วม: `UserStats` + `XpEvent` + `achievementService`

ทุกอย่างใน Phase 2 ขึ้นกับชิ้นนี้ ทำก่อนเสมอ

### Data model

```js
// src/models/UserStats.js — หนึ่ง doc ต่อ user (unique index)
{
  user:    ObjectId (ref User, unique),
  xp:      Number,                       // สะสมตลอดชีพ ไม่มีลด (hint หักจากโบนัส ไม่หักจากยอดสะสม)
  streak: {
    current:       Number,
    longest:       Number,
    lastActiveDay: String,               // 'YYYY-MM-DD' โซนเวลา Asia/Bangkok เสมอ
  },
  badges:  [{ id: String, at: Date }],   // id อ้าง registry ใน src/config/badges.js
  counters: {                            // ตัวนับสำหรับเงื่อนไข badge (อัปเดตแบบ $inc)
    labsPassed: Number, quizzesPerfect: Number, checksPassed: Number, ...
  },
}

// src/models/XpEvent.js — append-only ledger (audit + leaderboard รายสัปดาห์)
{
  user:   ObjectId,
  type:   String,        // 'lab-pass' | 'quiz-pass' | 'reading' | 'combo' | 'no-hint' | 'daily' | ...
  amount: Number,
  course: ObjectId?, moduleIdx?, lessonIdx?,
  at:     Date (index),
}
```

### Service

```js
// src/services/achievementService.js
await award(userId, type, ctx)
// 1. คำนวณ XP ตามตาราง XP_TABLE (config เดียว แก้ที่เดียว)
// 2. upsert UserStats: $inc xp/counters, อัปเดต streak (ดู §1)
// 3. insert XpEvent
// 4. ไล่เช็ก badge registry เฉพาะ badge ที่ trigger ตรงกับ type (ไม่เช็กทุกใบทุกครั้ง)
// 5. คืน { xpGained, leveledUp, newBadges } → route ส่งต่อให้ frontend เด้ง toast
```

### จุดเกี่ยว (hook points) — มีอยู่แล้วทั้งหมด ไม่ต้องสร้าง flow ใหม่

| เหตุการณ์ | ที่เกี่ยว | หมายเหตุ |
|---|---|---|
| ผ่าน lab / quiz / reading | `markComplete()` ใน `src/models/Progress.js` | **ต้องแก้ให้คืนค่า `{ inserted, improved }`** — ให้ XP เฉพาะตอน insert ครั้งแรก (กัน farm ซ้ำ) ตัว markComplete idempotent อยู่แล้ว ใช้ผลนั้นเป็น gate ได้เลย |
| กดตรวจ lab | `POST /lab/:c/:m/:l/grade` ใน `labRoutes.js` | มี `LabAttempt` history ให้เช็ก first-try/comeback |
| เปิด hint | endpoint ใหม่ §9 | |
| เข้าใช้งานรายวัน | middleware เบา ๆ หลัง login (เช็ก lastActiveDay ≠ วันนี้ค่อยยิง award) | |

### ตาราง XP เริ่มต้น (จูนได้ใน config เดียว)

| เหตุการณ์ | XP |
|---|---|
| อ่านบทเรียนจบ (ครั้งแรก) | 10 |
| ผ่าน quiz (ครั้งแรก) | 20 (+10 ถ้า 100%) |
| ผ่าน lab (ครั้งแรก) | 50 |
| โบนัส first-try 100% (§4 Combo) | +25 |
| โบนัสไม่เปิด hint (§9) | +15 (เปิด hint = สละโบนัสนี้ + ลดอีกใบละ 5 ขั้นต่ำเหลือ 10) |
| กิจกรรมแรกของวัน | +5 |

---

## §1 Streak 🔥

- **กติกา:** กิจกรรมที่นับ = เรียนจบ lesson, กดตรวจ lab (ไม่ต้องผ่าน — ความพยายามก็นับ), ทำ quiz
  คำนวณวันด้วย **Asia/Bangkok เสมอ** (อย่าใช้ UTC — ผู้ใช้ไทยทำตอน 23:30 แล้ว streak ขาดจะหัวร้อน)
- **อัลกอริทึม (ใน `award()`):** `today === lastActiveDay` → ไม่ทำอะไร; `lastActiveDay === เมื่อวาน` → `current+1`; อื่น ๆ → `current = 1` แล้ว `longest = $max(longest, current)` — ทำใน update เดียวให้ atomic
- **UI:** ชิป 🔥N บน navbar (เห็นทุกหน้า ไม่ใช่แค่ dashboard) + การ์ดบน dashboard โชว์ปฏิทิน 7 วันล่าสุด + longest
- **v1 ไม่มี streak freeze** — ถ้าคนบ่นค่อยเพิ่ม "วันหยุดสตรีค" แลกด้วย XP ทีหลัง
- **Badge เกี่ยวเนื่อง:** 7 วัน "ติดลม", 30 วัน "สายแข็ง", 100 วัน "ตำนาน"

## §2 XP & Level = Career Path

Level ไม่ใช่ตัวเลขลอย ๆ แต่เป็นตำแหน่งงานจริงในสายเน็ตเวิร์ก:

| Level | ตำแหน่ง | XP สะสม |
|---|---|---|
| 1 | Helpdesk | 0 |
| 2 | Junior NOC | 100 |
| 3 | NOC Engineer | 300 |
| 4 | Network Engineer | 700 |
| 5 | Senior Network Engineer | 1,500 |
| 6 | Network Architect | 3,000 |

- เก็บแค่ `xp` — level **คำนวณจากตาราง** (อย่า denormalize จะได้จูน threshold ทีหลังได้โดยไม่ migrate)
- **UI:** dashboard โชว์ตำแหน่งปัจจุบัน + progress bar ไปตำแหน่งถัดไป ("อีก 120 XP จะได้เลื่อนเป็น NOC Engineer") — ภาษาแบบ "เลื่อนตำแหน่ง" ให้ฟีล career จริง
- **Anti-farm:** XP ให้เฉพาะ first-completion ต่อ lesson (gate ด้วยผลคืนของ `markComplete`) — ตรวจ lab ซ้ำเพื่ออัปคะแนน % ได้ แต่ไม่ได้ XP เพิ่ม

## §3 Badges

- **Registry แบบ declarative** ที่ `src/config/badges.js`:
  ```js
  { id: 'first-ping', icon: '🏓', title: 'First Ping!', desc: 'ผ่าน check แรกในชีวิต',
    trigger: 'grade', check: (ctx, stats) => stats.counters.checksPassed === 0 && ctx.score > 0 }
  ```
  เพิ่ม badge ใหม่ = เพิ่ม entry เดียว ไม่แตะ service
- **ชุดเริ่มต้น 12 ใบ:**
  | id | เงื่อนไข | ข้อมูลที่ใช้ (มีแล้ว) |
  |---|---|---|
  | first-ping | check แรกที่ผ่าน | ผล `runChecks` |
  | one-shot | 100% ตั้งแต่ attempt แรกของ lab | `LabAttempt.countDocuments` ก่อนบันทึก |
  | no-hint | ผ่าน lab โดยไม่เปิด hint | `LabSession.hintsUsed` (§9) |
  | speedrunner | ผ่านภายใน ≤ ครึ่งของ `estMinutes` | `gradedAt - session.createdAt` |
  | night-owl | ผ่าน lab ช่วง 00:00–04:59 | เวลาตอน grade (Asia/Bangkok) |
  | comeback | ผ่านหลัง fail ≥ 3 ครั้ง | `LabAttempt` history |
  | perfect-quiz | quiz 100% | score ตอน submit |
  | streak-7 / 30 / 100 | ตาม §1 | UserStats.streak |
  | course-done | จบคอร์สแรก 100% | `coursePercent` |
  | boss-slayer | ผ่าน Boss Lab (§5) | lab.isBoss |
- **UI:** ตู้โชว์บน dashboard (ใบที่ยังไม่ได้เป็นเงา + บอกเงื่อนไขแบบยั่ว ๆ), toast ตอนได้ใหม่, แสดงในหน้า portfolio (§20)

## §4 Combo / First-try bonus

ใช้ของที่มีอยู่ล้วน ๆ: ใน grade route ก่อน `LabAttempt.create` นับ attempt เดิมของ lab นี้
ถ้า `count === 0 && pct === 100` → `award(userId, 'combo')` + badge `one-shot`
ผลพลอยได้เชิงพฤติกรรม: คน**คิดก่อนกดตรวจ** แทนการ spam grade ซึ่งลด load ที่ grader ด้วย

## §5 Boss Lab + Certificate

- **Boss Lab:** เพิ่มฟิลด์ใน `lessonSchema` (lab): `isBoss: Boolean`, และใช้ `passThreshold` กับ lab ด้วย
  (ตอนนี้ quiz มีแล้ว แต่ lab **hardcode 60** ใน `labRoutes.js` บรรทัด `passed = pct >= 60` → เปลี่ยนเป็น `lab.passThreshold ?? 60`; Boss ตั้ง 80)
  เนื้อหา: lab ใหญ่ท้ายคอร์สที่รวมทุกหัวข้อ (เช่น VLAN + OSPF + NAT ใน topology เดียว) ทำเป็น seed data ปกติ
- **Certificate:**
  ```js
  // src/models/Certificate.js
  { user, course, issuedAt, serial: String (unique, อ่านง่าย เช่น 'PNG-2026-000123'), displayName: String }
  ```
  - ออกอัตโนมัติเมื่อ `coursePercent === 100` **และ** Boss Lab ผ่าน threshold (เช็กหลัง markComplete)
  - หน้า public verify `/cert/:serial` — นายจ้างเปิดเช็กได้ว่าใบจริง (จุดขายสำคัญ)
  - ตัวใบ: หน้า `.njk` + print stylesheet (A4 landscape) — **ไม่ต้องพึ่ง lib สร้าง PDF** ให้ browser print เป็น PDF เอง
  - ชื่อบนใบ: ให้ user กรอก `displayName` ตอนรับใบ (username ไม่เหมาะกับใบประกาศ)

---

## §6 Troubleshooting Mode 🔧 (ฟีเจอร์เรือธง)

เปลี่ยนโจทย์จาก "config จากศูนย์" เป็น "ระบบพังอยู่ หาให้เจอ ซ่อมให้ได้" — เหมือนงานจริงที่สุด

- **Schema:** เพิ่มใน lab lesson:
  ```js
  mode: { type: String, enum: ['config', 'troubleshoot'], default: 'config' },
  setupCommands: [{ node: String, commands: [String] }],   // config "ที่พังมาแล้ว" ฉีดตอน boot เสร็จ
  ```
- **Flow ฉีด config:** ใช้ machinery ของ grader เดิมทั้งดุ้น — `gradingService` มี telnet+auto-login+รันคำสั่งอยู่แล้ว
  แยก export ฟังก์ชัน `runCommands(node, commands)` ออกมา แล้วใน `labSessionService.probeBoot()`:
  เมื่อ `allBooted` ครั้งแรก → รัน setupCommands → set `setupDone: true` บน LabSession →
  status endpoint คืน `allBooted && setupDone` ค่อยปลดปุ่มตรวจ (หน้า lab ขึ้น "กำลังจัดฉากความพัง... 🎬")
- **Grading ไม่ต้องแก้เลย** — checks เชิง functional (`ping`, route learned, `u/u`) ใช้กับโหมดนี้ได้ทันที
- **ข้อควรระวัง (จาก gotchas ที่เจอมาแล้ว):**
  - VPCS ไม่ persist config ข้าม restart → setupCommands ควรลงที่ VyOS เป็นหลัก
  - setup ต้อง idempotent (ถ้า probeBoot รันซ้ำเพราะ race ต้องไม่พังเพิ่ม) — gate ด้วย `setupDone` แบบ atomic update
  - ความพังต้อง "ยุติธรรม": 1 จุดต่อ lab ระดับต้น, 2–3 จุดระดับสูง และ hints เขียนเป็นบันได (อาการ → จุดที่ควรดู → คำสั่งที่ช่วย)
- **คอนเทนต์ชุดแรก:** หยิบ 5 lab VyOS เดิมมาทำเวอร์ชัน troubleshoot (interface down, ลืม `set protocols bgp neighbor`, NAT rule ผิด subnet, VLAN id ไม่ตรง, GRE tunnel source ผิด) — โครง topology เดิม เขียนแค่ setupCommands + hints ใหม่

## §7 Mystery Lab (สุ่มค่าโจทย์ต่อคน)

กันลอกคำตอบ + ทำซ้ำได้ไม่เบื่อ — **ซับซ้อนสุดในกลุ่ม lab ทำหลัง §6**

- **Schema:** lab เพิ่ม `variables: [{ name, kind: 'ipv4Net'|'int'|'pick', min, max, choices }]`
- **Flow:** `startSession()` สุ่มค่า → เก็บ `vars: {}` บน LabSession → ฟังก์ชัน `interpolate(str, vars)` แทนที่ `{{LAN_NET}}` ใน objectives/hints/setupCommands **และใน `expect`** ตอน grade (escape ค่าก่อนแปะลง regex!)
- **Validator:** `npm run validate` ต้อง compile `expect` ด้วยค่าตัวอย่าง (substitute ก่อนค่อย `new RegExp`) ไม่งั้น template string จะ fail validation
- **Scope v1:** ใช้กับ troubleshoot labs ก่อน (สุ่มว่า "พังจุดไหน" จาก 3 จุดที่เตรียมไว้ — ได้ replay value สูงสุดด้วยโค้ดน้อยสุด แค่ `pick` อย่างเดียวยังไม่ต้องทำ ipv4Net)

## §8 Partial-credit Progress (frontend ล้วน)

ข้อมูลครบแล้ว: grade response มี `results` ต่อ check + `points` และ `/history` มี attempt ย้อนหลัง

- Progress ring ใหญ่ "60/100" + checklist รายข้อ: ✅/❌ + คะแนนข้อ + **"เหลืออีก 2 ข้อ ได้แก่..."**
- เทียบกับ attempt ก่อนหน้า: "ดีขึ้นจากครั้งที่แล้ว +20!" (ดึงจาก history)
- ทำเป็น component `png-grade-report` (ตามแพทเทิร์น DSD + hydration ที่ใช้กับ 26 ตัวเดิม) แล้ว reuse ในหน้า shared (§13) ด้วย

## §9 Hint แบบมีราคา

- **หลัก:** เนื้อ hint **ต้องไม่อยู่ใน HTML ของหน้า** (ไม่งั้นเปิด devtools อ่านฟรี) → ส่งเฉพาะจำนวน+หัวข้อ
- **Endpoint:** `POST /lab/:c/:m/:l/hint/:idx` → บันทึก idx ลง `LabSession.hintsUsed: [Number]` แล้วคืนเนื้อ hint
- **ราคา:** เปิดใบแรก = สละโบนัส no-hint (+15); ใบถัดไปลด XP ของ lab ใบละ 5 (ขั้นต่ำ 10) — **หักจากโบนัสที่จะได้ ไม่หักจากยอดสะสม** (XP ติดลบ/ลดลงทำให้คนเสียกำลังใจเกินเหตุ)
- **สำคัญ:** `hintsUsed` ต้อง persist บน LabSession (ไม่ใช่ฝั่ง client) เพื่อให้ badge `no-hint` เชื่อถือได้ และต้องเก็บลง `LabAttempt` ตอน grade ด้วย (session โดน sweep แล้วประวัติยังอยู่)
- UI: ปุ่ม "เปิดคำใบ้ที่ 1 (สละโบนัส +15)" — บอกราคาชัดก่อนกด

## §10 Scenario เล่าเรื่อง 🎬 (seed data ล้วน — ถูกสุด คุ้มสุด)

- **Schema:** lab เพิ่ม `scenario: { role, setting, ticket }` (ข้อความไทย markdown)
- **UI:** component `png-ticket` หน้าตาเป็น "ใบแจ้งซ่อม/ticket ระบบ" — Priority: 🔴 สูง, ผู้แจ้ง: คุณสมศรี ฝ่ายบัญชี, อาการ: "สาขาเชียงใหม่ ping สำนักงานใหญ่ไม่ได้ ลูกค้ารอออกใบกำกับภาษีอยู่!"
- เขียน scenario ไทย บริบทบริษัทไทย ให้ครบทุก lab ที่มีอยู่ — งานเขียนล้วน ไม่มี backend
- ผูกกับ §6: troubleshoot lab + ticket = ประสบการณ์ NOC จำลองเต็มรูปแบบ

---

## §11 Leaderboard รายสัปดาห์

- **Query:** aggregate `XpEvent` (§0) ตั้งแต่จันทร์ 00:00 Asia/Bangkok → `$group` sum ต่อ user → top 20 + อันดับของตัวเอง (แม้หลุด top)
- **Cache:** in-memory 5 นาที (แพทเทิร์นเดียวกับ rate-limit ที่เป็น per-instance อยู่แล้ว) — พอ scale หลาย instance ค่อยย้าย
- **รีเซ็ตทุกสัปดาห์ = คนใหม่มีลุ้นเสมอ** (แก้ปัญหาคนเก่าผูกขาดที่ leaderboard ตลอดชีพเจอ) + แท็บแยกต่อ course
- **Privacy:** แสดง username เท่านั้น + ตัวเลือก opt-out ใน `/auth/settings` (`User.hideFromLeaderboard`)
- รางวัล top 3: badge ประจำสัปดาห์ ("แชมป์สัปดาห์ที่ 24/2026") — ไม่ต้องมีของจริง badge ก็ขลังพอ

## §12 "ตอนนี้มีคนทำ Lab อยู่ N คน" (เล็กสุดในเอกสารนี้)

`LabSession.countDocuments({ status: 'ready', lastActivityAt: { $gt: Date.now() - 5*60*1000 } })`
โชว์บน dashboard + หน้า catalog ("🟢 ตอนนี้มี 4 คนกำลังทำ lab") — cache 60 วิ พอ
สร้างความรู้สึก "ไม่ได้เรียนคนเดียว" ด้วยโค้ด ~10 บรรทัด

## §13 Share Card (ต่อยอดของที่มีอยู่)

มีแล้ว: `shareToken` + `/lab/shared/:token` + ปุ่ม share → เหลือทำให้ "อวดได้จริง":

1. แต่งหน้า `lab-shared.njk` เป็น achievement card (คะแนนใหญ่ ๆ, ชื่อ lab, badge, วันที่)
2. **OG meta tags** — แชร์ลง LINE/Facebook แล้ว preview ขึ้น "ผ่าน Lab BGP Peering แล้ว — 95% 🎉" (สำคัญสุด: LINE คือช่องทางหลักของผู้ใช้ไทย)
3. รูป OG: ทำ route `/lab/shared/:token/card.svg` render SVG จาก template njk (ไม่ต้องพึ่ง headless browser) — ถ้า platform ไหนไม่กิน SVG ค่อยพิจารณา sharp แปลง PNG ทีหลัง

ทุกแชร์คือ marketing ฟรี — ใส่ "เรียนฟรีที่ pingable.dev" ท้ายการ์ด

## §14 Lab Duel ⚔️ (Phase 4 — event เท่านั้น)

- **เกม:** สองคนได้ troubleshoot lab พังเหมือนกัน ใครตรวจผ่าน 100% ก่อนชนะ
- **Design คร่าว:** `Duel` model `{ labRef, players: [2], state: 'open'|'running'|'done', winner }`; คนสร้างได้ invite link; เริ่มเมื่อครบสอง; ฝั่งละ 1 LabSession ตามปกติ (unique per user เดิมใช้ได้); ประกาศผลจาก attempt แรกที่ 100%; หน้า duel โพล /status ของตัวเอง + สถานะคู่แข่ง (% ล่าสุด — เห็นว่าคู่แข่งได้ 80 แล้วคือความกดดันที่สนุก)
- **เหตุผลที่ต้องเป็น event:** กิน 2 slot จาก `LAB_MAX_CONCURRENT` (default 10) ต่อหนึ่งคู่ — เปิด ad-hoc ทั้งระบบไม่ไหว จัดเป็น "ศึกวันเสาร์" ที่ admin เปิด แล้วความ scarce กลายเป็นจุดขายแทน

---

## §15 Spaced Repetition Quiz

- **เก็บผลรายข้อ:** ตอน submit quiz บันทึกข้อที่ตอบผิดเป็น `ReviewItem { user, course, m, l, qIdx, box: 0..3, dueAt }`
- **Leitner 3 กล่อง:** ผิด → box 0 due +3 วัน; ตอบถูกตอน review → เลื่อนกล่อง (+7, +21 วัน); ถูกใน box 2 → จบ (ลบทิ้ง); ผิดตอน review → กลับ box 0
- **UI:** การ์ดบน dashboard "📚 มี 5 ข้อรอทบทวน" → หน้า `/review` ถามทีละข้อ (ดึง question จาก Course ตาม ref — **อย่า copy เนื้อคำถามลง ReviewItem** เดี๋ยว seed ใหม่แล้วข้อมูลค้าง)
- ตอบครบ = นับเป็นกิจกรรม streak + XP เล็กน้อย (5/รอบ) → เหตุผลให้เปิดแอپทุกวันแม้ไม่มีเวลาเข้า lab

## §16 "ทำไมถึงผิด" — Grade ที่สอนด้วย

- **Schema:** `checkSchema` เพิ่ม `failHint: String` — ข้อความไทยต่อ check: "ยังไม่เห็น route 10.0.2.0/24 ใน routing table — ลอง `show ip route` ดูว่า BGP session up หรือยัง (`show ip bgp summary`)"
- **Output จริง:** `runChecks` มี output ในมืออยู่แล้ว → คืน tail ~400 ตัวอักษร (strip ANSI แล้ว) ของ check ที่ fail ใน response ให้ UI โชว์ "สิ่งที่อุปกรณ์ตอบ" คู่กับ failHint
- **ห้ามโชว์ `expect` regex ดิบ** — มันคือเฉลย (คนจะ echo string ให้ match ได้); failHint คือคำอธิบายที่มนุษย์เขียนเท่านั้น
- งานหลักคือเขียน failHint ภาษาไทยให้ครบทุก check ใน seed data — งานคอนเทนต์ 80% โค้ด 20%

## §17 Cheat Sheet ส่วนตัว / สมุดโน้ต

- **ความจริงทางเทคนิค:** เราไม่เห็นคำสั่งที่ user พิมพ์ (เขาคุยกับ GNS3 web-ui ตรง ๆ ผ่าน iframe) — การดัก keystroke ผ่าน WS proxy ทำได้แต่ทั้ง creepy ทั้งแพง **ไม่ทำ**
- **ทางที่ดีกว่า:** สมุดโน้ตที่ระบบช่วยเริ่มให้ — ผ่าน lab แล้วระบบ generate โน้ตตั้งต้นจาก objectives + คำสั่งใน hints ของ lab นั้น แล้ว user แก้/เพิ่มเองได้ (มี editor markdown)
- **Model:** `Note { user, course?, labRef?, title, body (markdown), updatedAt }` — หน้า `/notes` จัดกลุ่มตามหัวข้อ ค้นหาได้
- มีปุ่ม "จดโน้ต" ลอยอยู่ในหน้า lab (sidebar) — จดได้ระหว่างทำโดยไม่ต้องสลับแท็บ

## §18 เส้นทางตามเป้าหมายอาชีพ

- `User.goal: enum ['exam-ccna', 'job-noc', 'job-neteng', 'career-switch', 'hobby']` — ถามตอน register (ข้ามได้) + แก้ใน settings
- ตาราง mapping goal → ลำดับ track/course ใน config (ไม่ต้องมี model ใหม่) → dashboard ใช้เรียง "คอร์สแนะนำ" + copy หัว dashboard เปลี่ยนตาม goal ("เป้าหมาย: สอบ CCNA — เหลืออีก 2 คอร์ส")
- อนาคต: ผูกกับ §2 ให้ level ladder ต่างกันตาม goal (v1 ใช้ ladder เดียวพอ)

---

## §19 Sandbox Mode 🏖️ (backend แทบศูนย์)

ค้นพบสำคัญ: **grade route รองรับ lab ที่ไม่มี checks อยู่แล้ว** และ lifecycle ทั้งหมด (start/heartbeat/sweep/stop) ไม่สน checks เลย

- **ทำเป็นคอร์สจริง** slug `playground` (published, ไม่มี prerequisites): 4–5 lab เปล่า — "VyOS 2 ตัว", "VyOS 3 ตัว + 2 PC", "สวิตช์ + 4 PC", "Full mesh 4 routers" — objectives เขียนเป็นไอเดียชวนลอง ("ลองทำ OSPF ดูสิ / ลองพัง routing แล้วซ่อมดู") ไม่มี gradingChecks
- UI หน้า lab ถ้าไม่มี checks → ซ่อนปุ่มตรวจ แสดง "โหมดเล่นอิสระ" แทน
- ใช้ idle sweeper เดิมคุมค่าใช้จ่าย — sandbox โดนกติกาเดียวกับ lab ปกติ
- คุณค่า: คนที่ "เล่น" คือคนที่อยู่ยาว และ sandbox คือพื้นที่ซ้อมก่อนสอบ Boss Lab

## §20 Public Portfolio `/u/:username`

- **Opt-in เท่านั้น** (`User.profilePublic`, default false) — เปิดแล้วโชว์: ตำแหน่ง level, badges, คอร์สที่จบ + %, certificates (ลิงก์ verify §5), best lab scores
- ออกแบบให้ **แนบใน resume ได้จริง**: URL สั้น สวย พิมพ์ลงกระดาษได้, มีปุ่ม print-friendly
- SEO: meta + og ครบ — ทุก portfolio ที่ติด Google คือทางเข้าเว็บ
- ระวัง: หน้า public ห้าม leak email/กิจกรรม timestamp ละเอียด (โชว์แค่เดือน-ปีที่จบ)

## §21 Exam Simulator ⏱️ (Phase 4)

- **โจทย์ design หลัก:** มี LabSession ได้คนละ 1 → สอบแบบ **ต่อเนื่องทีละข้อ** (ไม่ใช่เปิดพร้อมกัน): `ExamAttempt { user, labs: [{c,m,l}], currentIdx, startedAt, timeLimitMin, perLabResults, state }`
- **Flow:** เริ่มสอบ → start lab ข้อแรกอัตโนมัติ → grade แล้ว (ผ่านหรือยอมข้าม) → stop + start ข้อถัดไป → หมดเวลา = server ปฏิเสธ grade (เช็ก `startedAt + timeLimit` ฝั่ง server เสมอ — timer ฝั่ง client เป็นแค่จอแสดงผล)
- **กติกาห้องสอบ:** ไม่มี hint, ไม่มี failHint, เห็นแค่ ผ่าน/ไม่ผ่าน รายข้อ; จบแล้วค่อยเห็นรายงานเต็ม
- ใบรายงานผล: เปอร์เซ็นต์รวม + เวลาที่ใช้ + แชร์ได้แบบ §13 — "สอบจำลอง CCNA ได้ 87% ใน 42 นาที"
- หมายเหตุ capacity: 1 ผู้สอบ = 1 slot ตลอดช่วงสอบ ราว 1–2 ชม. — ควรอยู่หลังเพิ่ม `LAB_MAX_CONCURRENT` หรือจัดรอบ

## §22 AI Mentor 🤖 (Phase 4 — feature flag)

- **หลักการ:** ไม่บอกคำตอบ — ถามนำแบบโสเครติส ("ลอง `show ip bgp summary` หรือยัง สถานะ neighbor เป็นอะไร?")
- **Flow:** ปุ่ม "ขอคำแนะนำจากพี่เลี้ยง AI" บนผลตรวจที่ fail → server รวบ context: ชื่อ lab + objectives + checks ที่ fail (description + output จริง ไม่ส่ง expect regex) → เรียก Claude API (โมเดลเล็ก/เร็ว เช่น Haiku tier ก็พอ — งานสั้น มี context ชัด) ด้วย system prompt ไทยที่สั่งห้ามเฉลย → ตอบ 2–3 ประโยค
- **คุมต้นทุน:** feature flag `ANTHROPIC_API_KEY` (ไม่ตั้ง = ปุ่มไม่โชว์), rate-limit 5 ครั้ง/lab/วัน ต่อ user, จำกัด max_tokens, log ทุก call ลง XpEvent-style ledger ไว้ดู cost
- **ทำไมได้เปรียบ ChatGPT ที่ผู้เรียนเปิดเองข้าง ๆ:** mentor ของเราเห็น **output จริงจากอุปกรณ์ของเขา** — แนะนำตรงจุดกว่า copy-paste เองหลายเท่า และอยู่ในจอเดียวกัน
- เปิด hint AI = สละโบนัส no-hint เหมือน §9 (มันคือ hint รูปแบบหนึ่ง)

---

## Roadmap สรุป

| Phase | ของ | เหตุผลลำดับ |
|---|---|---|
| **1 — Quick wins** (เนื้อหา+frontend, ไม่มี migration) | §10 Scenario, §8 Partial-credit UI, §16 ทำไมถึงผิด, §12 ตัวนับคนทำ lab, §13 Share card OG, §19 Sandbox, §18 Career goal | เห็นผลเร็ว เสี่ยงต่ำ ใช้ของที่มีอยู่ |
| **2 — Gamification core** | §0 พื้นฐาน → §1 Streak, §2 XP/Level, §3 Badges, §4 Combo, §9 Hint cost, §11 Leaderboard | ทั้งกลุ่มรอ §0 ตัวเดียว ทำรวดเดียวคุ้มสุด |
| **3 — Learning systems** | §6 Troubleshooting (เรือธง!), §5 Boss+Cert, §15 Spaced repetition, §17 Notes, §20 Portfolio | ใช้ schema ใหม่+คอนเทนต์มาก แต่คือความต่างเชิงผลิตภัณฑ์ |
| **4 — Big bets** | §7 Mystery, §21 Exam sim, §22 AI mentor, §14 Duel | ต้นทุน/ความเสี่ยงสูง ควรมีฐานผู้ใช้ก่อน |

### หนี้เชิงเทคนิคที่ควรเก็บระหว่างทาง
- `passed = pct >= 60` hardcode ใน `labRoutes.js` → ย้ายไป `lab.passThreshold` (ต้องใช้ใน §5 อยู่ดี)
- `markComplete` ควรคืน `{ inserted, improved }` (จำเป็นต่อ anti-farm ของ §0)
- ฟิลด์ schema ใหม่ทุกตัว (scenario, mode, setupCommands, failHint, isBoss, variables) ต้องเพิ่ม validation ใน `npm run validate` ด้วย — seeder ปฏิเสธของพังก่อนเขียน DB เป็นด่านเดียวที่กัน content เสียได้
