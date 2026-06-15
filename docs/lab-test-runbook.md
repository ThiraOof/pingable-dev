# Runbook / เช็คลิสต์ทดสอบแล็บทั้งหมด (เรียงตามความเสี่ยง)

ไล่ทดสอบ **ทุกแล็บ (56 แล็บ)** ทีละตัว เรียงจาก **เสี่ยงสุด → เสี่ยงน้อยสุด** แต่ละรายการมี
คำสั่งที่ต้องพิมพ์เพื่อทำให้ผ่าน + คำสั่งตรวจ + output ที่ควรเห็น เพื่อยืนยันว่าแล็บ
build/boot/grade ได้จริงบนอุปกรณ์จริง

> สร้างจาก seed-data ปัจจุบัน (ดู `scripts/seed-data/*.js`). ค่า `expect` ในที่นี้คือ
> "เฉลย" ฝั่ง grader — ใช้ตอนทดสอบเท่านั้น อย่าหลุดเข้าหน้าเรียน

---

## ก่อนเริ่ม (ทำครั้งเดียว)

- [ ] **GNS3 server** รันอยู่ (`http://localhost:3080`) และ **`GNS3_VYOS_TEMPLATE`** ใน `.env` ชี้ template VyOS จริง (ไม่งั้นแล็บ VyOS ทั้งหมด build ไม่ขึ้น)
- [ ] **MongoDB** รันอยู่ และ `npm run seed` ผ่าน (มี 13 คอร์สในแคตตาล็อก)
- [ ] `npm run validate` ผ่าน (regex/ref/var ใน seed ไม่พัง)
- [ ] **UDP range ของ GNS3** ไม่ชน NVIDIA (Windows: ใช้ 30000–40000 ใน `gns3_server.ini` — ดู memory `gns3-gotchas`)
- [ ] ตั้ง `LAB_MAX_CONCURRENT` ให้รับจำนวนแล็บที่จะเปิดพร้อมกัน (แล็บ 3×VyOS กิน RAM เยอะ)
- [ ] เผื่อ RAM: VyOS แต่ละโหนด ~ใช้เวลา 1–2 นาทีบูต × จำนวนโหนด

## ขั้นตอนมาตรฐานต่อ 1 แล็บ

1. เข้าคอร์ส → โมดูล → บทเรียนชนิด **lab** → กด **เริ่มแล็บ**
2. รอจน **ทุกโหนดบูตเสร็จ** (ปุ่ม "ตรวจ" ปลดล็อก — VyOS ใช้เวลา 1–2 นาที/โหนด)
   - แล็บ **troubleshoot**: รอ `setup.state = done` ด้วย (ปุ่มตรวจถูกล็อกจนฉีด setup สำเร็จ)
3. เปิดคอนโซลโหนดใน iframe Web-UI → พิมพ์ config ตาม **"ตั้งค่าให้ผ่าน"** (VyOS อย่าลืม `commit`)
4. กด **ตรวจ** → ดูผลแต่ละ check → ต้องได้ **≥ passThreshold%**
5. ทดสอบซ้ำ: รีโหลดหน้า → ต้อง **resume** เซสชันเดิม (ไม่ rebuild)
6. กด **หยุดแล็บ** → ยืนยันโปรเจกต์ GNS3 ถูกลบ

## เกณฑ์ "ผ่าน" ของการทดสอบแต่ละแล็บ

- [ ] Build/boot สำเร็จ ทุกโหนดขึ้น (โดยเฉพาะ VyOS หลายตัว)
- [ ] (troubleshoot) setup ฉีดครบ ไม่ latch `failed`
- [ ] ตั้งค่าตามเฉลยแล้ว **กด grade ได้ 100%** (หรืออย่างน้อย ≥ threshold)
- [ ] failHint แสดงถูกตอน check ตก / heartbeat + resume + stop ทำงาน

🟥 = เสี่ยงสุด 🟧 = สูง 🟨 = กลาง 🟩 = ต่ำ ⬜ = sandbox (ไม่มีให้คะแนน)

---

# 🟥 Tier A — เสี่ยงสุด (VPN/crypto + boss + setup-injection)

แล็บกลุ่มนี้พึ่ง timing ของการเจรจา (IPsec/WireGuard), ฉีด config ยาวผ่าน telnet,
หรือมีจุดพังหลายจุด — เป็นกลุ่มที่ "ผ่านในกระดาษแต่พังจริง" บ่อยที่สุด **ทดสอบก่อนเสมอ**

### 1. 🟥 [network-troubleshooting] ซ่อม #7 — VPN เข้ารหัสที่ไม่ยอมขึ้น
- **โหมด:** troubleshoot · 4 โหนด (R1,R2 = VyOS, PC1,PC2) · setup ฉีด R1+R2 (~18 บรรทัด/ตัว)
- **โจทย์:** setup ตั้ง IPsec ไว้ แต่ PSK สองฝั่งไม่ตรง (`BANGKOK-KEY-111` vs `CHIANGMAI-KEY-999`)
- **แก้ให้ผ่าน:** ตั้ง PSK ให้ตรงกันทั้งสองฝั่ง
  - R1 & R2: `set vpn ipsec authentication psk PR secret SAME-KEY-123` → `commit`
- **ตรวจ → ควรเห็น:**
  - R1: `ping 10.0.12.2 count 3` → `bytes from 10.0.12.2` (underlay, 1pt)
  - R1: `show vpn ipsec sa` → สถานะ **up** (4pt)
  - PC1: `ping 192.168.2.10` → `bytes from 192.168.2.10` (4pt)
- **ผ่าน:** ≥60% ของ 9pt → ต้องได้ SA up + ping ข้ามไซต์
- **จุดเฝ้าดู:** ⚠️ setup ยาวมาก — ถ้าโหนดบูตช้า/telnet หลุด setup อาจ latch `failed` (เพิ่ม `LAB_SETUP_MAX_ATTEMPTS`); SA `up` มาช้า ให้รอ 10–20 วิแล้ว grade ซ้ำ; ต้องไม่มี static route ของวง LAN ปลายทาง (policy-based)

### 2. 🟥 [network-security] แล็บ — IPsec Site-to-Site VPN  *(คอร์สใหม่ ยังไม่เคยเทสต์จริง)*
- **โหมด:** config · 4 โหนด (R1,R2 = VyOS, PC1,PC2)
- **ตั้งค่าให้ผ่าน:** R1 eth1=192.168.1.1/24, eth2=10.0.12.1/24 · R2 eth1=10.0.12.2/24, eth2=192.168.2.1/24
  - IKE/ESP เหมือนกันสองฝั่ง: `set vpn ipsec ike-group IKE proposal 1 encryption aes256` / `hash sha256` / `dh-group 14`; `set vpn ipsec esp-group ESP proposal 1 encryption aes256` / `hash sha256`
  - `set vpn ipsec interface eth2` · PSK: `set vpn ipsec authentication psk PR1 id 10.0.12.1` / `id 10.0.12.2` / `secret MYSECRET123`
  - peer (R1): `... site-to-site peer 10.0.12.2 local-address 10.0.12.1`, `ike-group IKE`, `default-esp-group ESP`, `tunnel 1 local prefix 192.168.1.0/24`, `tunnel 1 remote prefix 192.168.2.0/24` · R2 กลับด้าน
- **ตรวจ → ควรเห็น:**
  - R1: `show configuration commands | match "pre-shared-secret"` → `pre-shared-secret` (2pt)
  - R1: `show vpn ipsec sa` → **up** (4pt)
  - PC1: `ping 192.168.2.10` → `bytes from 192.168.2.10` (4pt)
- **ผ่าน:** ≥60% ของ 10pt
- **จุดเฝ้าดู:** ⚠️ ไวยากรณ์ VyOS 1.4 vs 1.5 ของ `vpn ipsec` ต่างกัน; SA ใช้เวลาขึ้น; PC ต้องตั้ง gateway ไป R

### 3. 🟥 [network-security] แล็บ — WireGuard Tunnel  *(คอร์สใหม่)*
- **โหมด:** config · 2 โหนด VyOS
- **ตั้งค่าให้ผ่าน:** underlay R1 eth1=10.0.12.1/24, R2=10.0.12.2/24 (ping ให้ผ่านก่อน)
  - สร้างคีย์: `run generate pki wireguard key-pair` (คัด private มาใส่ของตัวเอง, public ให้อีกฝั่ง)
  - R1: `set interfaces wireguard wg0 address 172.16.0.1/30` / `private-key <R1-PRIV>` / `port 51820`
  - R1 peer: `... wg0 peer R2 public-key <R2-PUB>` / `address 10.0.12.2` / `port 51820` / `allowed-ips 172.16.0.0/30` · R2 กลับด้าน
- **ตรวจ → ควรเห็น:**
  - R1: `show configuration commands | match "interfaces wireguard wg0"` → `wireguard` (3pt)
  - R1: `show configuration commands | match "wg0 peer"` → `allowed-ips` (3pt)
  - R1: `ping 172.16.0.2 count 3` → `bytes from 172.16.0.2` (4pt)
- **ผ่าน:** ≥60% ของ 10pt
- **จุดเฝ้าดู:** ⚠️ ต้อง gen คีย์เอง (interactive) — handshake ไม่ขึ้นถ้าสลับ public key สองฝั่ง; ตรวจ `show interfaces wireguard wg0` ดู latest handshake

### 4. 🟥 [network-troubleshooting] 👹 BOSS — เครือข่ายสาขาล่มสามจุดซ้อน
- **โหมด:** troubleshoot · **boss (ผ่าน 80%)** · 3 โหนด (R1,R2=VyOS, PC1) · setup R1+R2
- **3 จุดพัง:** (1) R1 eth2 ถูก `disable` (2) R1 static route ไป 192.168.2.0/24 ชี้ next-hop ผิด (10.0.12.99) (3) R2 ไม่มี route กลับวง 192.168.1.0/24
- **แก้ให้ผ่าน:**
  - R1: `delete interfaces ethernet eth2 disable` · แก้ `set protocols static route 192.168.2.0/24 next-hop 10.0.12.2`
  - R2: `set protocols static route 192.168.1.0/24 next-hop 10.0.12.1` → `commit`
- **ตรวจ → ควรเห็น:** R1 `show interfaces | match eth2` → `eth2 ... u/u` (2pt) · R1 `ping 10.0.12.2` → reply (2pt) · R1 `ping 192.168.2.1` → reply (3pt) · R2 `show configuration commands | match "192.168.1.0/24"` → มี (2pt) · PC1 `ping 192.168.2.1` → reply (4pt)
- **ผ่าน:** ≥80% ของ 13pt → **ต้องได้ ≥11pt** (แก้ครบ 3 จุด)
- **จุดเฝ้าดู:** ⚠️ boss 80% — แก้ตกจุดเดียวก็ไม่ผ่าน; return-path เป็นจุดที่คนลืมบ่อย

### 5. 🟥 [ospf-hands-on] Boss — neighbor ติด ExStart และเส้นทางหาย  *(คอร์สใหม่)*
- **โหมด:** troubleshoot · **boss (ผ่าน 80%)** · 2 โหนด VyOS · setup R1+R2
- **2 จุดพัง:** (1) R2 eth1 ตั้ง `mtu 1400` → neighbor ค้าง ExStart (2) R2 ไม่ประกาศ 192.168.2.0/24 เข้า OSPF
- **แก้ให้ผ่าน:**
  - R2: `set interfaces ethernet eth1 mtu 1500` (หรือ `set protocols ospf interface eth1 mtu-ignore` ทั้งสองฝั่ง)
  - R2: `set protocols ospf area 0 network 192.168.2.0/24` → `commit`
- **ตรวจ → ควรเห็น:** R1 `show ip ospf neighbor` → `Full` (4pt) · R1 `show ip route ospf | match 192.168.2` → `192.168.2.0` (3pt) · R1 `ping 192.168.2.1 count 3` → reply (3pt)
- **ผ่าน:** ≥80% ของ 10pt → **ต้องได้ ≥8pt**
- **จุดเฝ้าดู:** ⚠️ ต้องเห็นพฤติกรรม ExStart จริงจาก MTU mismatch (ยืนยันว่า setup ฉีด mtu 1400 สำเร็จ)

### 6. 🟥 [network-security] แล็บ — Zone-Based Firewall (Stateful)  *(คอร์สใหม่)*
- **โหมด:** config · 3 โหนด (R1=VyOS, PC1,PC2)
- **ตั้งค่าให้ผ่าน:** R1 eth1=192.168.1.1/24 (LAN), eth2=203.0.113.1/24 (WAN) · PC1=192.168.1.10 gw .1 · PC2=203.0.113.10 gw .1
  - ขาออก: `set firewall ipv4 name LAN-WAN default-action drop` / `rule 10 action accept` / `rule 10 state new enable`
  - ขากลับ (stateful): `set firewall ipv4 name WAN-LAN rule 10 action accept` / `state established enable` / `state related enable` / `default-action drop`
  - โซน: `set firewall zone LAN interface eth1` / `zone WAN interface eth2` / `zone WAN from LAN firewall name LAN-WAN` / `zone LAN from WAN firewall name WAN-LAN`
- **ตรวจ → ควรเห็น:** R1 `show configuration commands | match "firewall zone"` → `zone` (3pt) · R1 `show configuration commands | match "state established"` → `established` (3pt) · PC1 `ping 203.0.113.10` → `bytes from 203.0.113.10` (4pt)
- **ผ่าน:** ≥60% ของ 10pt
- **จุดเฝ้าดู:** ⚠️ ลืมกฎ `established` ฝั่งขากลับ = echo reply โดน drop, ping ไม่ผ่าน (self-lockout)

---

# 🟧 Tier B — สูง (3×VyOS / troubleshoot setup-injection)

### 7. 🟧 [ccnp-advanced-routing] แล็บ — BGP Route Reflector
- **โหมด:** config · 4 โหนด (RR,C1,C2 = VyOS, SW1) — **3×VyOS บนสวิตช์เดียว**
- **ตั้งค่าให้ผ่าน:** RR=10.0.0.1/24, C1=10.0.0.2/24, C2=10.0.0.3/24 (AS เดียว 65010, iBGP)
  - RR: `set protocols bgp system-as 65010` · ต่อ client: `neighbor 10.0.0.2 remote-as 65010` + `address-family ipv4-unicast route-reflector-client` (ทำซ้ำ .3)
  - C1: `neighbor 10.0.0.1 remote-as 65010` + โฆษณา `dum0 192.168.1.0/24` · C2 โฆษณา 192.168.2.0/24 (C1/C2 ไม่ peer กันเอง)
- **ตรวจ → ควรเห็น:** RR `show configuration commands | match "route-reflector-client"` → มี (4pt) · C1 `show ip route bgp | match 192.168.2` → `192.168.2.0` (4pt) · C1 `ping 192.168.2.1 count 3` → reply (3pt)
- **ผ่าน:** ≥60% ของ 11pt
- **จุดเฝ้าดู:** ⚠️ 3 VyOS บูตพร้อมกัน (RAM + เวลา); RR ต้อง reflect ระหว่าง client จริง

### 8. 🟧 [ospf-hands-on] แล็บ — OSPF Multi-Area และ ABR  *(คอร์สใหม่)*
- **โหมด:** config · 3 โหนด VyOS (R1—R2(ABR)—R3)
- **ตั้งค่าให้ผ่าน:** R1(area1): network 10.0.12.0/24 + 192.168.1.0/24 · R2(ABR): area1 net 10.0.12.0/24 + area0 net 10.0.23.0/24 · R3(area0): net 10.0.23.0/24 + 192.168.3.0/24 (router-id 1/2/3.x)
- **ตรวจ → ควรเห็น:** R2 `show ip ospf neighbor` → `Full` (3pt) · R1 `show ip route ospf | match 192.168.3` → `192.168.3.0` (O IA, 4pt) · R1 `ping 192.168.3.1 count 3` → reply (3pt)
- **ผ่าน:** ≥60% ของ 10pt
- **จุดเฝ้าดู:** ⚠️ 3 VyOS; R2 ต้องจับ Full กับทั้งสองฝั่ง; return path R3→192.168.1.0

### 9. 🟧 [ospf-hands-on] แล็บ — OSPF Stub Area  *(คอร์สใหม่)*
- **โหมด:** config · 3 โหนด VyOS (เหมือน multi-area)
- **ตั้งค่าให้ผ่าน:** ตั้ง OSPF ให้ Full ก่อน → ทำ area 1 เป็น stub ทั้ง R1 **และ** R2: `set protocols ospf area 1 area-type stub` (ต้องตรงกันสองฝั่ง)
- **ตรวจ → ควรเห็น:** R1 `show configuration commands | match "area-type"` → `stub` (3pt) · R1 `show ip route ospf | match "0.0.0.0/0"` → `0.0.0.0/0` (default จาก ABR, 4pt) · R1 `ping 192.168.3.1 count 3` → reply (3pt)
- **ผ่าน:** ≥60% ของ 10pt
- **จุดเฝ้าดู:** ⚠️ ตั้ง stub ไม่ตรงสองฝั่ง = neighbor หลุด (Hello flag ไม่ตรง) → default ไม่มา

### 10. 🟧 [ipv6-deep-dive] แล็บ — Static Route6 ข้ามสามเราเตอร์  *(คอร์สใหม่)*
- **โหมด:** config · 3 โหนด VyOS (R1—R2—R3, IPv6)
- **ตั้งค่าให้ผ่าน:** R1 `set protocols static route6 2001:db8:3::/64 next-hop 2001:db8:12::2` · R2 (ตัวกลาง) route6 ไป ::1 ผ่าน ::1 และ ::3 ผ่าน ::3 · R3 route6 กลับ 2001:db8:1::/64 ผ่าน 2001:db8:23::2
- **ตรวจ → ควรเห็น:** R1 `show configuration commands | match "route6 2001:db8:3"` → `2001:db8:3::/64` (3pt) · R3 `show ipv6 route | match 2001:db8:1` → `2001:db8:1::` (3pt) · R1 `ping 2001:db8:3::1 count 3` → `bytes from 2001:db8:3::1` (4pt)
- **ผ่าน:** ≥60% ของ 10pt
- **จุดเฝ้าดู:** ⚠️ 3 VyOS + ต้องวาง route ทั้งไป-กลับครบทุกเราเตอร์ ไม่งั้น echo reply หาย

### 11. 🟧 [ospf-hands-on] ซ่อม #1 — neighbor ไม่ขึ้น (area ไม่ตรง)  *(คอร์สใหม่)*
- **โหมด:** troubleshoot · 2 VyOS · setup R1(area0)+R2(area1 บนลิงก์)
- **แก้ให้ผ่าน:** R2: `delete protocols ospf area 1 network 10.0.12.0/24` → `set protocols ospf area 0 network 10.0.12.0/24` → `commit`
- **ตรวจ → ควรเห็น:** R1 `show ip ospf neighbor` → `Full` (4pt) · R1 `show ip route ospf | match 192.168.2` → `192.168.2.0` (3pt) · R1 `ping 192.168.2.1 count 3` → reply (3pt)
- **ผ่าน:** ≥60% ของ 10pt
- **จุดเฝ้าดู:** setup ฉีดสำเร็จ (ลิงก์ ping ผ่านแต่ neighbor ว่าง)

### 12. 🟧 [ospf-hands-on] ซ่อม #2 — neighbor วูบ ๆ (hello timer ไม่ตรง)  *(คอร์สใหม่)*
- **โหมด:** troubleshoot · 2 VyOS · setup R2 ตั้ง `hello-interval 5`
- **แก้ให้ผ่าน:** R2: `delete protocols ospf interface eth1 hello-interval` → `commit` (คืนค่า default 10)
- **ตรวจ → ควรเห็น:** R1 `show ip ospf neighbor` → `Full` (4pt) · R1 `show ip route ospf | match 192.168.2` → `192.168.2.0` (3pt) · R1 `ping 192.168.2.1 count 3` → reply (3pt)
- **ผ่าน:** ≥60% ของ 10pt

### 13. 🟧 [network-troubleshooting] ซ่อม #6 — สาขาขอ IP อัตโนมัติไม่ได้
- **โหมด:** troubleshoot · 3 โหนด (R1,R2=VyOS, PC1) · setup R1(relay ชี้ผิด)+R2(server)
- **แก้ให้ผ่าน:** R1: `set service dhcp-relay server 10.0.12.2` + `delete service dhcp-relay server 10.0.12.99` → `commit` → PC1 `dhcp` ใหม่
- **ตรวจ → ควรเห็น:** R1 `show configuration commands | match "dhcp-relay server"` → `10.0.12.2` (3pt) · PC1 `dhcp` → `192.168.50.1xx/2xx` (5pt) · PC1 `show ip` → `192.168.50.1xx` (2pt)
- **ผ่าน:** ≥60% ของ 10pt
- **จุดเฝ้าดู:** ⚠️ DHCP ข้ามวงผ่าน relay + ต้องมี static route กลับวง LAN; lease ใช้เวลา

### 14. 🟧 [network-troubleshooting] ซ่อม #3 — ออฟฟิศทั้งวงออกเน็ตไม่ได้ (NAT)
- **โหมด:** troubleshoot · 3 โหนด (R1,R2=VyOS, PC1) · setup NAT rule source ผิดวง (192.168.99.0/24)
- **แก้ให้ผ่าน:** R1: `set nat source rule 100 source address 192.168.1.0/24` → `commit`
- **ตรวจ → ควรเห็น:** PC1 `ping 192.168.1.1` → reply (2pt) · PC1 `ping 10.0.12.2` → reply (5pt) · R1 `show configuration commands | match "source address"` → `192.168.1.0/24` (2pt)
- **ผ่าน:** ≥60% ของ 9pt

### 15. 🟧 [network-troubleshooting] ซ่อม #5 — อุโมงค์ GRE ที่ชี้ผิดทิศ
- **โหมด:** troubleshoot · 2 VyOS · setup tun0 remote ของ R1 ชี้ 10.0.12.99 (ไม่มีจริง)
- **แก้ให้ผ่าน:** R1: `set interfaces tunnel tun0 remote 10.0.12.2` → `commit`
- **ตรวจ → ควรเห็น:** R1 `ping 10.0.12.2 count 3` → reply (underlay, 1pt) · R1 `show configuration commands | match "tun0 remote"` → `10.0.12.2` (3pt) · R1 `ping 172.16.0.2 count 3` → `bytes from 172.16.0.2` (5pt)
- **ผ่าน:** ≥60% ของ 9pt

### 16. 🟧 [network-troubleshooting] ซ่อม #4 — สอง VLAN ที่ไม่เคยเจอกัน
- **โหมด:** troubleshoot · 2 VyOS · setup R1 vif 10 / R2 vif 20 (VLAN ID ไม่ตรง)
- **แก้ให้ผ่าน:** R2: `delete interfaces ethernet eth1 vif 20` → `set interfaces ethernet eth1 vif 10 address 10.0.10.2/24` → `commit`
- **ตรวจ → ควรเห็น:** R2 `show configuration commands | match "vif 10"` → `vif 10` (3pt) · R1 `ping 10.0.10.2 count 3` → reply (5pt)
- **ผ่าน:** ≥60% ของ 8pt

### 17. 🟧 [network-troubleshooting] ซ่อม #2 — BGP peering ไม่ยอมขึ้น
- **โหมด:** troubleshoot · 2 VyOS · setup R1 neighbor remote-as 65999 (ผิด, R2 จริง = 65002)
- **แก้ให้ผ่าน:** R1: `set protocols bgp neighbor 10.0.12.2 remote-as 65002` → `commit`
- **ตรวจ → ควรเห็น:** R1 `show ip route bgp | match 192.168.2` → `192.168.2.0` (4pt) · R1 `ping 192.168.2.1 count 3` → reply (4pt) · R1 `show configuration commands | match "remote-as"` → `65002` (1pt)
- **ผ่าน:** ≥60% ของ 9pt

### 18. 🟧 [network-troubleshooting] 🎲 ซ่อมลิงก์ลึกลับ (Mystery — สุ่มต่อ attempt)
- **โหมด:** troubleshoot · 2 VyOS · **มี variable `NET`** (สุ่มจาก 10.40.12 / 172.20.12 / 192.168.42 / 10.99.7)
- **แก้ให้ผ่าน:** R1: `delete interfaces ethernet eth1 disable` → `commit` (eth1 ถูก disable ไว้)
- **ตรวจ → ควรเห็น:** R1 `show interfaces | match eth1` → `eth1 ... u/u` (4pt) · R1 `ping {{NET}}.2 count 3` → `bytes from {{NET}}.2` (5pt) — `{{NET}}` แทนค่าที่สุ่มได้จริง
- **ผ่าน:** ≥60% ของ 9pt
- **จุดเฝ้าดู:** ⚠️ ทดสอบ **2–3 รอบ** ให้เห็นค่าสุ่มต่างกัน + ยืนยัน `expect` ถูก escape (interpolateExpect) และ objectives/hints แสดงค่าจริงจาก `/status`

### 19. 🟧 [network-troubleshooting] ซ่อม #1 — ลิงก์ระหว่างสาขาเงียบสนิท
- **โหมด:** troubleshoot · 2 VyOS · setup R1 eth1 ถูก `disable`
- **แก้ให้ผ่าน:** R1: `delete interfaces ethernet eth1 disable` → `commit`
- **ตรวจ → ควรเห็น:** R1 `show interfaces | match eth1` → `eth1 ... u/u` (4pt) · R1 `ping 10.0.12.2 count 3` → reply (5pt)
- **ผ่าน:** ≥60% ของ 9pt
- **จุดเฝ้าดู:** แล็บ troubleshoot ที่ง่ายสุด — ใช้เป็น "smoke test" ของ setup-injection pipeline

---

# 🟨 Tier C — กลาง (1–2×VyOS, ฟีเจอร์เดี่ยว)

### 20. 🟨 [ccnp-advanced-routing] แล็บ — eBGP Configuration
- 2 VyOS · R1(AS65001) eth1=10.0.12.1/24 dum0=192.168.1.1/24 · R2(AS65002) .2 + 192.168.2.1/24
- ตั้ง: `set protocols bgp system-as 65001` / `neighbor 10.0.12.2 remote-as 65002` / `address-family ipv4-unicast network 192.168.1.0/24` (R2 กลับด้าน)
- **ตรวจ:** R1 `show ip route bgp | match 192.168.2` → `192.168.2.0` (4pt) · R1 `ping 192.168.2.1 count 3` → reply (3pt) · R1 `show configuration commands | match "remote-as"` → `65002` (2pt) — ผ่าน ≥60%/9pt

### 21. 🟨 [ccnp-advanced-routing] แล็บ — BGP Route Map
- 2 VyOS · R2 โฆษณาทั้ง 192.168.2.0/24 และ 192.168.20.0/24 → R1 กรองรับเฉพาะ /2.0
- ตั้ง: R1 `set policy prefix-list ALLOW rule 10 action permit prefix 192.168.2.0/24` · `set policy route-map FROM-R2 rule 10 action permit` + `match ip address prefix-list ALLOW` · `... bgp neighbor 10.0.12.2 address-family ipv4-unicast route-map import FROM-R2`
- **ตรวจ:** R1 `show configuration commands | match "route-map import"` → `route-map import` (4pt) · R1 `show ip route bgp | match 192.168.2.0` → `192.168.2.0` (มี /2.0 แต่ไม่มี /20.0) (4pt) — ผ่าน ≥60%/8pt

### 22. 🟨 [ccnp-advanced-routing] แล็บ — GRE Tunnel Configuration
- 2 VyOS · underlay 10.0.12.0/24 · R1 tun0 172.16.0.1/30, source 10.0.12.1, remote 10.0.12.2 (R2 กลับด้าน)
- **ตรวจ:** R1 `show configuration commands | match "encapsulation gre"` → `gre` (3pt) · R1 `show interfaces | match tun0` → `tun0 ... u/u` (3pt) · R1 `ping 172.16.0.2 count 3` → reply (3pt) — ผ่าน ≥60%/9pt

### 23. 🟨 [ccnp-advanced-routing] แล็บ — Static NAT Configuration
- 2 VyOS + PC1 · R1 nat rule 10 source 192.168.1.10 → translation 203.0.113.10 (eth2) · R2 route กลับ 203.0.113.0/24 → 10.0.12.1
- **ตรวจ:** PC1 `ping 10.0.12.2` → reply (4pt) · R1 `show nat source translations` → `203.0.113.10` (3pt) · R1 `show configuration commands | match "translation address 203"` → `203.0.113.10` (2pt) — ผ่าน ≥60%/9pt

### 24. 🟨 [ccnp-advanced-routing] แล็บ — Dynamic NAT Configuration
- 2 VyOS + 2 PC + SW · R1 nat rule 20 source 192.168.1.0/24 → pool 203.0.113.10-20 · R2 route กลับ
- **ตรวจ:** PC1 `ping 10.0.12.2` → reply (3pt) · PC2 `ping 10.0.12.2` → reply (3pt) · R1 `show nat source translations` → `203.0.113.1x` (3pt) — ผ่าน ≥60%/9pt

### 25. 🟨 [ccnp-advanced-routing] แล็บ — PAT Configuration (NAT Overload)
- 2 VyOS + 2 PC + SW · R1 nat rule 100 source 192.168.1.0/24 → `translation address masquerade`
- **ตรวจ:** PC1 `ping 10.0.12.2` → reply (3pt) · PC2 `ping 10.0.12.2` → reply (3pt) · R1 `show configuration commands | match "translation address masquerade"` → `masquerade` (3pt) — ผ่าน ≥60%/9pt

### 26. 🟨 [ccnp-advanced-routing] แล็บ — DHCP Relay Agent
- 2 VyOS + PC1 · R1(relay) eth1=192.168.50.1/24, eth2=10.0.12.1/30 → `dhcp-relay server 10.0.12.2` · R2(server) pool 192.168.50.0/24 + static route กลับ
- **ตรวจ:** R1 `show configuration commands | match "dhcp-relay"` → `10.0.12.2` (4pt) · PC1 `dhcp` → `192.168.50.x` (5pt) — ผ่าน ≥60%/9pt

### 27. 🟨 [ccnp-advanced-routing] แล็บ — DHCP Configuration
- 1 VyOS + PC1 · R1 eth1=192.168.10.1/24 · pool 192.168.10.100-200, default-router .1
- **ตรวจ:** R1 `show configuration commands | match "dhcp-server"` → `dhcp-server` (3pt) · PC1 `dhcp` → `192.168.10.1xx/2xx` (4pt) · PC1 `show ip` → `192.168.10.1` (2pt) — ผ่าน ≥60%/9pt

### 28. 🟨 [ccnp-advanced-routing] แล็บ — Extended ACL (Firewall by Protocol/Port)
- 1 VyOS + 2 PC · R1 route LAN A (192.168.1.0/24) ↔ LAN B (192.168.2.0/24)
- ตั้ง: `set firewall ipv4 name AtoB rule 10 action accept` + `protocol icmp` · `rule 20 action drop` + `protocol tcp` + `destination port 23` · `default-action accept`
- **ตรวจ:** R1 `show configuration commands | match "name AtoB"` → `protocol` (3pt) · R1 `show configuration commands | match "AtoB"` → `AtoB` (2pt) · PC1 `ping 192.168.2.10` → reply (4pt) — ผ่าน ≥60%/9pt

### 29. 🟨 [ospf-hands-on] แล็บ — OSPF Single Area  *(คอร์สใหม่)*
- 2 VyOS · R1/R2 eth1=10.0.12.x/24, dum0=192.168.1/2.1/24 · area 0 network ทั้งลิงก์+LAN (router-id 1/2)
- **ตรวจ:** R1 `show ip ospf neighbor` → `Full` (3pt) · R1 `show ip route ospf | match 192.168.2` → `192.168.2.0` (4pt) · R1 `ping 192.168.2.1 count 3` → reply (3pt) — ผ่าน ≥60%/10pt

### 30. 🟨 [ospf-hands-on] แล็บ — Redistribute Connected เข้า OSPF  *(คอร์สใหม่)*
- 2 VyOS · R1 dum1=172.16.50.1/24 (ไม่ประกาศใน OSPF ตรง ๆ) → `set protocols ospf redistribute connected`
- **ตรวจ:** R1 `show configuration commands | match "ospf redistribute"` → `redistribute` (3pt) · R2 `show ip route ospf | match 172.16.50` → `172.16.50.0` (O E2, 4pt) · R2 `ping 172.16.50.1 count 3` → reply (3pt) — ผ่าน ≥60%/10pt

### 31. 🟨 [ipv6-deep-dive] แล็บ — กำหนดที่อยู่ IPv6 และ ping6  *(คอร์สใหม่)*
- 2 VyOS · R1 eth1=2001:db8:12::1/64 dum0=2001:db8:1::1/64 (R2 ::2 / 2001:db8:2::1) + static route6 ไป LAN อีกฝั่ง
- **ตรวจ:** R1 `show configuration commands | match "eth1 address 2001"` → `2001:db8:12::1` (3pt) · R1 `ping 2001:db8:12::2 count 3` → reply (3pt) · R1 `ping 2001:db8:2::1 count 3` → `bytes from 2001:db8:2::1` (4pt) — ผ่าน ≥60%/10pt

### 32. 🟨 [ipv6-deep-dive] แล็บ — OSPFv3 แลกเส้นทาง IPv6  *(คอร์สใหม่)*
- 2 VyOS · `set protocols ospfv3 area 0.0.0.0 interface eth1` + `interface dum0` (router-id 1/2) — ห้ามใส่ static route6 ของ LAN ปลายทาง
- **ตรวจ:** R1 `show configuration commands | match ospfv3` → `ospfv3` (3pt) · R1 `show ipv6 route | match 2001:db8:2` → `2001:db8:2::` (4pt) · R1 `ping 2001:db8:2::1 count 3` → reply (3pt) — ผ่าน ≥60%/10pt

### 33. 🟨 [network-security] แล็บ — SSH Hardening และ Login Banner  *(คอร์สใหม่)*
- 1 VyOS + PC1 · R1 eth1=192.168.1.1/24 · `set service ssh port 22` + `listen-address 192.168.1.1` + `disable-password-authentication` · `set system login banner pre-login "..."`
- **ตรวจ:** R1 `show configuration commands | match "service ssh"` → `listen-address 192.168.1.1` (4pt) · R1 `show configuration commands | match "login banner"` → `banner` (3pt) · PC1 `ping 192.168.1.1` → reply (3pt) — ผ่าน ≥60%/10pt

### 34. 🟨 [ip-services] แล็บ — NTP Client และ Server  *(คอร์สใหม่)*
- 2 VyOS · R2(server) `set service ntp allow-client address 10.0.12.0/24` + `listen-address 10.0.12.2` · R1(client) `set service ntp server 10.0.12.2`
- **ตรวจ:** R1 `show configuration commands | match "service ntp server"` → `10.0.12.2` (4pt) · R2 `show configuration commands | match "ntp allow-client"` → `allow-client` (3pt) · R1 `ping 10.0.12.2 count 3` → reply (3pt) — ผ่าน ≥60%/10pt

### 35. 🟨 [ip-services] แล็บ — DNS Forwarder และ Name Resolution  *(คอร์สใหม่)*
- 1 VyOS + PC1 · R1 eth1=192.168.1.1/24 · `set service dns forwarding listen-address 192.168.1.1` + `allow-from 192.168.1.0/24` + `name-server 1.1.1.1` · `set system static-host-mapping host-name server1 inet 192.168.1.10`
- **ตรวจ:** R1 `show configuration commands | match "dns forwarding"` → `forwarding` (3pt) · R1 `show configuration commands | match "static-host-mapping"` → `server1` (3pt) · R1 `ping server1 count 3` → `bytes from 192.168.1.10` (4pt) — ผ่าน ≥60%/10pt

### 36. 🟨 [ip-services] แล็บ — Traffic Shaping ด้วย traffic-policy  *(คอร์สใหม่)*
- 2 VyOS · `set traffic-policy shaper WAN-OUT bandwidth 10mbit` + class · `set interfaces ethernet eth1 traffic-policy out WAN-OUT`
- **ตรวจ:** R1 `show configuration commands | match "traffic-policy shaper"` → `shaper` (3pt) · R1 `show configuration commands | match "traffic-policy out"` → `traffic-policy out` (4pt) · R1 `ping 10.0.12.2 count 3` → reply (3pt) — ผ่าน ≥60%/10pt

### 37. 🟨 [ccnp-core] แล็บ — VRRP Configuration
- 2 VyOS + SW + PC1 · R1 eth1=10.0.0.2/24 prio 150, R2=10.0.0.3/24 prio 100, VIP 10.0.0.1 (vrid 10)
- **ตรวจ:** R1 `show vrrp` → `MASTER` (4pt) · R2 `show vrrp` → `BACKUP` (2pt) · PC1 `ping 10.0.0.1` → reply (3pt) — ผ่าน ≥60%/9pt

### 38. 🟨 [ccnp-core] แล็บ — HSRP (จำลองด้วย VRRP Active/Standby + Preempt)
- 2 VyOS + SW + PC1 · vrid 11, VIP 10.0.0.1, R1 prio 150, R2 prio 100, preempt
- **ตรวจ:** R1 `show vrrp` → `MASTER` (3pt) · R1 `show configuration commands | match "priority"` → `priority 150` (3pt) · PC1 `ping 10.0.0.1` → reply (3pt) — ผ่าน ≥60%/9pt

### 39. 🟨 [ccnp-core] แล็บ — EtherChannel Configuration (LACP Bonding)
- 2 VyOS (2 ลิงก์) · `set interfaces bonding bond0 mode 802.3ad` + eth1/eth2 `bond-group bond0` + `bond0 address 10.0.12.1/24` (ลบ address บน eth ก่อน)
- **ตรวจ:** R1 `show configuration commands | match "bonding bond0 mode"` → `802.3ad` (3pt) · R1 `show interfaces | match bond0` → `bond0 ... u/u` (3pt) · R1 `ping 10.0.12.2 count 3` → reply (3pt) — ผ่าน ≥60%/9pt

### 40. 🟨 [ccnp-core] แล็บ — VLAN Configuration (802.1Q)
- 2 VyOS · R1 eth1 vif 10 = 10.0.10.1/24, vif 20 = 10.0.20.1/24 (R2 ใช้ .2)
- **ตรวจ:** R1 `show configuration commands | match "vif 10"` → `vif 10` (2pt) · `... vif 20` → `vif 20` (2pt) · R1 `ping 10.0.10.2 count 3` → reply (3pt) · R1 `ping 10.0.20.2 count 3` → reply (3pt) — ผ่าน ≥60%/10pt

### 41. 🟨 [ccnp-core] แล็บ — Inter-VLAN Routing (Router-on-a-Stick)
- 1 VyOS + 2 PC + SW · R1 eth1 vif 10/20 = .1 · SW: PC1 access VLAN10, PC2 access VLAN20, พอร์ตไป R1 = dot1q trunk · PC gateway = vif IP
- **ตรวจ:** PC1 `ping 10.0.10.1` → reply (2pt) · PC2 `ping 10.0.20.1` → reply (2pt) · PC1 `ping 10.0.20.10` → reply (ข้าม VLAN, 4pt) — ผ่าน ≥60%/8pt
- **จุดเฝ้าดู:** ต้องตั้งพอร์ต SW เป็น access/trunk ในหน้า config ของ SW1 (GNS3) เอง

### 42. 🟨 [ccnp-core] แล็บ — Port Security (MAC Filtering)
- 1 VyOS + PC1 · R1 eth1=10.0.0.1/24 · `set firewall ipv4 name PORTSEC rule 10 action accept` + `source mac-address <MAC ของ PC1>` + `default-action drop` ผูก eth1 ทิศ in
- **ตรวจ:** R1 `show configuration commands | match "mac-address"` → `mac-address` (4pt) · R1 `show configuration commands | match "PORTSEC"` → `PORTSEC` (2pt) · PC1 `ping 10.0.0.1` → reply (3pt) — ผ่าน ≥60%/9pt
- **จุดเฝ้าดู:** ต้องดู MAC จริงของ PC1 (`show ip`) ก่อน — ใส่ผิด MAC = ping ตัวเองไม่ผ่าน

### 43. 🟨 [ccnp-core] แล็บ — PortFast / STP Edge (VyOS Bridge)
- 1 VyOS + 2 PC · R1 `set interfaces bridge br0 stp true` + `member interface eth1` + `eth2` · PC1/PC2 ใน 10.0.0.0/24
- **ตรวจ:** R1 `show configuration commands | match "bridge br0 stp"` → `stp` (3pt) · R1 `show configuration commands | match "br0 member interface eth1"` → `eth1` (2pt) · PC1 `ping 10.0.0.12` → reply (4pt) — ผ่าน ≥60%/9pt

### 44. 🟨 [ccnp-core] แล็บ — Local SPAN (Port Mirroring)
- 1 VyOS + 2 PC · R1 `set interfaces ethernet eth2 mirror ingress eth1`
- **ตรวจ:** R1 `show configuration commands | match "eth2 mirror"` → `mirror` (4pt) · R1 `show configuration commands | match "eth2 mirror"` → `eth1` (3pt) — ผ่าน ≥60%/7pt
- **จุดเฝ้าดู:** ตรวจแค่ config (ไม่มี ping) — แล็บนี้พึ่งการมีอยู่ของ config ล้วน

### 45. 🟨 [ccnp-core] แล็บ — SSH Configuration
- 1 VyOS + PC1 · `set service ssh port 22` · `set system login user netadmin authentication plaintext-password <รหัส>`
- **ตรวจ:** R1 `show configuration commands | match "service ssh"` → `service ssh` (4pt) · `... service ssh port` → `port 22` (3pt) · `... login user` → `login user` (2pt) — ผ่าน ≥60%/9pt

### 46. 🟨 [ccnp-core] แล็บ — Syslog Configuration
- 1 VyOS + PC1 · `set system syslog host 10.0.0.50 facility all level info`
- **ตรวจ:** R1 `show configuration commands | match "syslog host"` → `10.0.0.50` (5pt) · `... syslog host` → `facility|level` (3pt) — ผ่าน ≥60%/8pt

---

# 🟩 Tier D — ต่ำ (VPCS อย่างเดียว, บูตเร็ว, ping/show ip)

### 47. 🟩 [ccna-intro] แล็บ — Fix the Broken Host
- 3 PC + SW (ไม่มี VyOS) · ทุกเครื่อง /24, network 192.168.50, host part ไม่ซ้ำ
- ตั้ง: PC1 `ip 192.168.50.10 255.255.255.0` · PC2 `.20` · PC3 `.30`
- **ตรวจ:** PC1/2/3 `show ip` → `192.168.50.10/20/30/24` (2pt ละ) · PC1 `ping 192.168.50.20` → reply (2pt) · PC2 `ping 192.168.50.30` → reply (2pt) — ผ่าน ≥60%/10pt

### 48. 🟩 [ccna-intro] แล็บ — Multi-Switch LAN
- 4 PC + 2 SW · ทุกเครื่อง 172.16.0.x/24 (host ไม่ซ้ำ), uplink SW1–SW2
- **ตรวจ:** PC1 `show ip` → `172.16.0.11/24` (1pt) · PC4 `show ip` → `172.16.0.44/24` (1pt) · PC1 `ping 172.16.0.22/.33/.44` → reply (2+3+3pt) — ผ่าน ≥60%/10pt

### 49. 🟩 [ip-subnetting] แล็บ — Default Gateway
- 2 PC + SW · `ip 192.168.20.10 255.255.255.0 192.168.20.1` (PC2 = .20)
- **ตรวจ:** PC1/2 `show ip` → IP/24 + `GATEWAY : 192.168.20.1` · PC1 `ping 192.168.20.20` → reply — ผ่าน ≥60%/12pt

### 50. 🟩 [ip-subnetting] แล็บ — Hosts in a /26 Subnet
- 3 PC + SW · `ip 192.168.10.11 255.255.255.192` (PC2=.22, PC3=.33) — mask เดียวกันทั้งหมด
- **ตรวจ:** PC1/2/3 `show ip` → `192.168.10.11/22/33/26` · PC1 `ping .22` และ `.33` → reply — ผ่าน ≥60%/10pt

### 51. 🟩 [networking-basics] แล็บ — Basic IP & Ping
- 2 PC + SW · `ip 192.168.1.1 255.255.255.0` (PC2 = .2)
- **ตรวจ:** PC1/2 `show ip` → `192.168.1.1/.2` · PC1 `ping 192.168.1.2` + PC2 `ping 192.168.1.1` → reply — ผ่าน ≥60%/10pt

### 52. 🟩 [networking-basics] แล็บ — Multiple Subnets
- 4 PC + 2 SW · PC1/2 = 192.168.1.1/.2, PC3/4 = 10.0.0.1/.2 (คนละ broadcast domain)
- **ตรวจ:** PC1–4 `show ip` ตรงค่า · PC1 `ping 192.168.1.2` → reply · PC3 `ping 10.0.0.2` → reply (ข้าม subnet จะไม่ผ่าน — เป็นบทเรียน) — ผ่าน ≥60%/10pt

---

# ⬜ Tier E — Sandbox (playground — ไม่มี grading, ทดสอบแค่ build/boot/เล่นอิสระ)

แล็บกลุ่มนี้ `gradingChecks` ว่าง → render เป็น free-play (ไม่มีปุ่มตรวจ) ทดสอบแค่:
build ขึ้น, ทุกโหนดบูต, คอนโซลใช้ได้, กด **หยุด** แล้วลบโปรเจกต์

### 53. ⬜ [playground] สนามซ้อม — LAN สวิตช์ + 4 PC
- 4 PC + SW (ไม่มี VyOS) · ทดสอบ `ip`/`show ip`/`ping`/`trace` บน VPCS ได้

### 54. ⬜ [playground] สนามซ้อม — VyOS Router คู่
- 2 VyOS (2 ลิงก์) · `configure`/`set`/`commit`/`show interfaces` ใช้ได้ · login vyos/vyos

### 55. ⬜ [playground] สนามซ้อม — Router + สวิตช์ + 2 PC
- 1 VyOS + 2 PC + SW · ทดสอบ VLAN/DHCP บน VyOS + ตั้งพอร์ต SW

### 56. ⬜ [playground] สนามซ้อม — สามเหลี่ยม Router + 2 LAN
- **3 VyOS** + 2 PC (5 ลิงก์) · topology ใหญ่สุดของ playground — ทดสอบ static route + RAM/boot ของ 3×VyOS

---

## สรุปจุดที่ต้องเฝ้าระวังเป็นพิเศษ

| ความเสี่ยง | แล็บที่กระทบ |
|---|---|
| **VPN/crypto timing** (SA/handshake มาช้า → grade ซ้ำ) | #1 IPsec-TS, #2 IPsec, #3 WireGuard |
| **setup-injection ยาว/พลาด → latch failed** | ทุก troubleshoot โดยเฉพาะ #1 (VPN), #13 (DHCP relay) |
| **boss 80% — แก้ตกจุดเดียวก็ไม่ผ่าน** | #4 (3 จุด), #5 (2 จุด) |
| **3×VyOS — RAM + เวลา boot** | #7 RR, #8/#9 OSPF multi, #10 route6, #56 playground |
| **คอร์สใหม่ ยังไม่เคย grade จริง** | network-security, ospf-hands-on, ip-services, ipv6-deep-dive (#2,3,5,6,8–12,29–36) |
| **ต้องตั้งค่าฝั่ง GNS3 switch เอง** | #41 RoaS (access/trunk) |
| **Mystery — ทดสอบหลายรอบให้เห็นค่าสุ่ม** | #18 |

> **คอร์สที่ไม่มีแล็บ:** `wireless-networking`, `network-automation` (reading + quiz ล้วน — ไม่ต้องทดสอบแล็บ)
