# Deploy — Dev server บน GCP Free Trial (งบ 0 บาท)

คู่มือ deploy **dev server** ของ Pingable-Dev บน Google Cloud Free Trial ($300 / 90 วัน)
ช่วงแรกเปิดเฉพาะ **browse คอร์ส / สมัคร / เนื้อหา** — ยังไม่รัน lab (GNS3 ปิดไว้)
แต่เลือก VM แบบเปิด nested virtualization ไว้แล้ว เพื่อเพิ่ม GNS3 ทีหลังบนเครื่องเดิมได้เลย

> ค่าใช้จ่ายจริง: VM `e2-small` ≈ $13/เดือน หรือ `n2-standard-2` ≈ $50/เดือน
> ($300 เครดิตเหลือสบายสำหรับ 90 วัน; ปิด VM ตอนไม่ใช้เพื่อประหยัดเครดิต)
> GCP **ไม่ตัดเงิน**จนกว่าจะกด "Upgrade account" เอง

---

## 0. สิ่งที่ได้เตรียมไว้ในรีโปแล้ว

| ไฟล์ | หน้าที่ |
|---|---|
| `Dockerfile` | build bundle + รัน prod (มีอยู่เดิม) |
| `docker-compose.prod.yml` | app + MongoDB + Caddy (HTTPS อัตโนมัติ) |
| `Caddyfile` | reverse proxy + Let's Encrypt |
| `.env.production.example` | ต้นแบบ env — copy เป็น `.env.production` |

---

## 1. สร้าง VM บน GCP

```bash
# ติดตั้ง gcloud CLI แล้ว login ก่อน:  gcloud init
gcloud compute instances create pingable-dev \
  --zone=asia-southeast1-b \
  --machine-type=e2-small \
  --image-family=ubuntu-2404-lts-amd64 \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --enable-nested-virtualization \
  --tags=http-server,https-server
```

> `asia-southeast1` = สิงคโปร์ (ใกล้ไทยสุด). `--enable-nested-virtualization`
> ใส่ไว้เผื่อ GNS3 ทีหลัง (ใช้ได้กับตระกูล N2/N1/C2; ถ้าจะรัน lab จริงค่อยเปลี่ยน
> machine-type เป็น `n2-standard-2`). เปิด lab ทีหลังให้รัน GNS3 **แบบ native บน
> VM** (ต้องใช้ `/dev/kvm`) แล้วตั้ง `GNS3_HOST=http://host.docker.internal`
> ในไฟล์ env — **ไม่ใช่ `localhost`** เพราะแอปรันใน container, `localhost` คือตัว
> container เอง (ดูหัวข้อ "เพิ่ม lab" ท้ายไฟล์).

เปิด firewall ให้ port 80/443:

```bash
gcloud compute firewall-rules create allow-web \
  --allow=tcp:80,tcp:443 --target-tags=http-server,https-server
```

จด **external IP** ของ VM ไว้ (`gcloud compute instances list`).

---

## 2. ติดตั้ง Docker บน VM

```bash
gcloud compute ssh pingable-dev --zone=asia-southeast1-b
# บน VM:
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && exit   # ออกแล้ว ssh ใหม่ให้ group มีผล
```

---

## 3. เอาโค้ดขึ้น VM

```bash
gcloud compute ssh pingable-dev --zone=asia-southeast1-b
git clone <repo-url> pingable-dev && cd pingable-dev
```

---

## 4. ตั้งค่า env

```bash
cp .env.production.example .env.production
nano .env.production
```

ใส่อย่างน้อย:
- `SESSION_SECRET` — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `SITE_ADDRESS` — ไม่มีโดเมน ใช้ **nip.io**: เอา external IP เช่น `34.101.22.7`
  แปลงจุดเป็นขีด → `SITE_ADDRESS=34-101-22-7.nip.io`
- `APP_URL` — `https://34-101-22-7.nip.io` (ตรงกับ SITE_ADDRESS)

ที่เหลือ (SMTP / OAuth / GNS3) เว้นว่างได้ — ฟีเจอร์นั้นจะถูกซ่อน/ปิดเอง

---

## 5. รัน

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

เปิด data คอร์ส (seed) ครั้งแรก:

```bash
docker compose -f docker-compose.prod.yml exec app npm run seed
```

> seed อ่าน `GNS3_VYOS_TEMPLATE` ได้แม้ยังไม่ตั้ง — มันจะใส่ placeholder ไว้
> คอร์ส/บทเรียนขึ้นครบ; เฉพาะ topology ของ VyOS เท่านั้นที่จะ instantiate ไม่ได้
> (ซึ่งช่วงนี้เราไม่รัน lab อยู่แล้ว)

เช็คสุขภาพ:

```bash
# พอร์ต 3000 ของ app ไม่ได้ publish ออก host (expose only — Caddy fronts it),
# เลย curl localhost:3000 ไม่ติด. เช็คผ่าน Caddy แทน (ใส่ domain ของคุณ):
curl -s https://34-101-22-7.nip.io/health    # {"status":"ok","db":true}
# (หรือเช็คในคอนเทนเนอร์ตรง ๆ: docker compose -f docker-compose.prod.yml exec app wget -qO- http://localhost:3000/health)
docker compose -f docker-compose.prod.yml logs -f caddy   # ดู cert ออกสำเร็จ
```

เปิดเบราว์เซอร์ → `https://34-101-22-7.nip.io`

---

## 6. อัปเดตเวอร์ชันใหม่

```bash
cd pingable-dev && git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## ประหยัดเครดิตตอนไม่ใช้

```bash
gcloud compute instances stop  pingable-dev --zone=asia-southeast1-b
gcloud compute instances start pingable-dev --zone=asia-southeast1-b   # IP อาจเปลี่ยน
```

> ถ้าใช้ nip.io แล้ว IP เปลี่ยนหลัง start ใหม่ ต้องแก้ `SITE_ADDRESS`/`APP_URL`
> ให้ตรง IP ใหม่ แล้ว `up -d` อีกที. อยาก IP คงที่ให้จอง static external IP
> (ฟรีเมื่อ VM กำลังรัน): `gcloud compute addresses create ...`

---

## เพิ่ม lab (GNS3) ทีหลัง — สรุปสั้น

1. เปลี่ยน VM เป็น `n2-standard-2`+ (RAM สำหรับ VyOS VMs; VyOS ตัวละ ≈512MB–1GB).
   ยืนยัน KVM ใช้ได้: `sudo apt install cpu-checker && kvm-ok` (เห็น `/dev/kvm`).
2. ลง **GNS3 server แบบ native บน VM** (ต้องเข้าถึง `/dev/kvm` — รันใน container
   ยุ่งกว่า), register VyOS appliance, จด `template_id`. ตั้ง GNS3 ให้ **bind
   `0.0.0.0`** (`host = 0.0.0.0` ใน `gns3_server.conf`) ไม่ใช่ `127.0.0.1` —
   ไม่งั้น app container ต่อไม่ได้.
3. ใน `.env.production` ตั้ง **`GNS3_HOST=http://host.docker.internal`** (ไม่ใช่
   `localhost` — app อยู่ใน container; compose map `host.docker.internal` ไป
   host gateway ให้แล้ว), `GNS3_PORT=3080`, `GNS3_VYOS_TEMPLATE=<uuid>`,
   `LAB_MAX_CONCURRENT` ตั้งตาม RAM (8GB ≈ 4–6). แล้ว seed ใหม่ + `up -d`.
4. เบราว์เซอร์เข้า GNS3 ผ่าน proxy ของแอป — **ไม่ต้องเปิด port GNS3 (3080/console)
   ออกเน็ต** ปล่อย firewall ไว้แค่ 80/443 เหมือนเดิม. (จะตั้ง `GNS3_USER/PASS`
   เป็น defense-in-depth ด้วยก็ได้.)
5. ทดสอบ: start 1 lab → รอ node บูต (`allBooted`) → กด grade ให้ผ่านสัก check
   เพื่อยืนยันทั้ง REST proxy และ telnet ของ grader ทะลุ container → host จริง.
