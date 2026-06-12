# Pingable

แพลตฟอร์มคอร์สเรียน Network ภาษาไทย ที่ผู้เรียนได้ **ทำ Lab บนอุปกรณ์จริง** (router/switch จำลองด้วย QEMU ผ่าน [GNS3](https://gns3.com)) ตรงในเบราว์เซอร์ พร้อมระบบตรวจคำตอบอัตโนมัติที่ telnet เข้า console ของอุปกรณ์แล้วเช็คผลลัพธ์จริง — ไม่ใช่แค่ quiz

- เนื้อหาแบบ Course → Module → Lesson (ทฤษฎี / Lab / Quiz) เก็บ progress ต่อผู้ใช้
- Lab provision GNS3 topology สดต่อคน คนละ project แยกขาดจากกัน (proxy บังคับสิทธิ์ — GNS3 ไม่ต้อง expose)
- Lab ของคอร์ส Enterprise Networking ใช้ [VyOS](https://vyos.io) (open source) แทน Cisco IOS ที่ติดไลเซนส์
- ควบคุมต้นทุน: 1 lab ต่อผู้ใช้, เพดานรวมทั้งระบบ (`LAB_MAX_CONCURRENT`), sweeper ปิด lab ร้าง

## Quick start (dev)

ต้องมี: Node.js ≥ 22, MongoDB (local), GNS3 server (เฉพาะตอนทำ lab — เปิดดูคอร์สไม่ต้องมี)

```bash
cp .env.example .env        # แก้ค่าตามเครื่อง (อย่างน้อย GNS3_VYOS_TEMPLATE ถ้าจะใช้ lab VyOS)
npm install
npm run seed                # ใส่คอร์สตัวอย่างลง MongoDB
npm run dev                 # http://localhost:3000
```

## Quick start (Docker)

รัน app + MongoDB ด้วย compose (GNS3 ยังต้องรันแยกบน host/เครื่องอื่น):

```bash
cp .env.example .env
docker compose up --build
docker compose exec app npm run seed
```

ค่า GNS3 ใน compose ชี้ไป `host.docker.internal:3080` (GNS3 บนเครื่อง host) — override ได้ใน `.env`

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รันแบบ auto-reload |
| `npm test` | เทสต์ทั้งหมด (`node:test` — GNS3/console ถูก fake ในตัว, ส่วนที่ใช้ DB ต้องมี Mongo local ไม่งั้น skip) |
| `npm run seed` | upsert คอร์สตัวอย่าง (ยึดตาม `slug` — progress ผู้ใช้ไม่หาย) |
| `npm run validate` | ตรวจความถูกต้องของ seed data โดยไม่แตะ DB |
| `npm run build` | bundle Web Components สำหรับ production |

## Deploy notes

- ตั้ง `NODE_ENV=production` และ `SESSION_SECRET` (ไม่ตั้ง = ไม่ยอม start), รัน `npm run build` ก่อนเสมอ (bundle ไม่อยู่ใน git)
- มี `GET /health` สำหรับ load balancer / uptime check (เช็คการเชื่อมต่อ DB)
- GNS3 server อยู่ในเครือข่ายภายในได้เลย — เบราว์เซอร์คุยผ่าน proxy ของแอป ([รายละเอียด](CLAUDE.md))
- **สำรองข้อมูล MongoDB สม่ำเสมอ** เช่น cron `mongodump --uri "$MONGODB_URI" --archive=/backup/pingable-$(date +%F).gz --gzip` — ข้อมูลผู้ใช้/progress ทั้งหมดอยู่ใน DB เดียว

สถาปัตยกรรมโดยละเอียด (lab lifecycle, grading, การเพิ่มคอร์ส/lab ใหม่) อยู่ใน [CLAUDE.md](CLAUDE.md)
