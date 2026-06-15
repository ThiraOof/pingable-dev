// OSPF Hands-On — Routing Protocol ลงมือทำจริงบน VyOS
//
// ปิด gap ที่เห็นได้ชัดที่สุดของหลักสูตร: IP Connectivity = 25% ของ CCNA 200-301
// เดิม OSPF มีแค่ "reading + quiz" ในคอร์ส ccnp-advanced-routing แต่ไม่มี
// hands-on lab เลย ทั้งที่ VyOS (FRR) รองรับ OSPF เต็มรูปแบบและทำงานได้ดีมาก
//
// ทุกแล็บรันบน VyOS Universal Router (โอเพนซอร์ส แทน Cisco IOS ที่ติดลิขสิทธิ์)
// คำสั่งตัวอย่างอ้างอิงไวยากรณ์ VyOS 1.4+/1.5 — การให้คะแนนเน้น "ผลลัพธ์เชิง
// ฟังก์ชัน" (neighbor Full, เรียนรู้เส้นทางจริง, ping ถึงปลายทาง) จึงไม่ผูกกับ
// สตริงคำสั่งเป๊ะ ๆ และทนต่อความต่างของไวยากรณ์ระหว่างเวอร์ชัน

import { vyos } from './_vyos.js';

export default {
  slug: 'ospf-hands-on',
  title: 'OSPF Hands-On',
  description: 'เจาะ OSPF ด้วยการลงมือทำล้วน ๆ บนอุปกรณ์จริง: ตั้ง single area, ขยายเป็น multi-area ผ่าน ABR, ออกแบบ stub/NSSA area, redistribute เส้นทางภายนอกเข้า OSPF และไล่ซ่อมปัญหา OSPF ที่พบจริง (area/hello/MTU mismatch) — ปิดช่องว่างหัวข้อ IP Connectivity ที่เป็น 25% ของ CCNA',
  level: 'advanced',
  track: 'Enterprise Networking',
  estimatedHours: 10,
  prerequisites: ['ผ่าน Introduction to Networks (ccna-intro) หรือเทียบเท่า', 'ใช้ VyOS CLI ได้ (set/commit/show) และเข้าใจ IP routing/subnetting'],
  published: true,
  modules: [
    // ── โมดูล 1 — OSPF Single Area ──────────────────────────────────────
    {
      title: 'โมดูล 1 — OSPF Single Area',
      description: 'หลักการ OSPF, การเป็น neighbor, DR/BDR และการตั้ง area เดียวให้สองเราเตอร์แลกเส้นทางกัน',
      order: 0,
      objectives: [
        'อธิบายขั้นตอนการเป็น neighbor และความหมายของสถานะ Full',
        'อธิบายค่าที่ต้องตรงกันจึงจะจับคู่ neighbor ได้ (area, hello/dead, subnet, MTU)',
        'ตั้ง OSPF area 0 บน VyOS ให้สองเราเตอร์เรียนรู้เส้นทางและ ping ถึงกัน',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'OSPF ทำงานอย่างไร: Neighbor, DR/BDR และ Area 0',
          order: 0,
          estMinutes: 14,
          sections: [
            {
              heading: 'Link-State และฐานข้อมูล LSDB',
              body: [
                'OSPF เป็น **link-state protocol**: ทุกเราเตอร์ในพื้นที่เดียวกันแลก LSA จนมี **link-state database (LSDB)** เหมือนกันทุกตัว แล้วต่างคนต่างคำนวณเส้นทางที่ดีที่สุดด้วยอัลกอริทึม **SPF (Dijkstra)** เอง',
                '',
                'ต่างจาก distance-vector (เช่น RIP) ที่ "เชื่อตามเพื่อนบอก" — OSPF เห็นภาพทั้ง topology จึงเลือกเส้นทางได้ฉลาดและ converge เร็วกว่า',
                '',
                'metric ของ OSPF คือ **cost** ซึ่งผกผันกับ bandwidth ของลิงก์ (ลิงก์เร็ว = cost ต่ำ = ถูกเลือก)',
              ].join('\n'),
            },
            {
              heading: 'ขั้นตอนการเป็น Neighbor',
              body: [
                'สองเราเตอร์ไล่ผ่านสถานะ: `Down → Init → 2-Way → ExStart → Exchange → Loading → Full`',
                '',
                '- **2-Way** — เห็น Hello ของกันและกันแล้ว (บนวง multi-access จะเลือก DR/BDR ตรงนี้)',
                '- **ExStart/Exchange** — ตกลงลำดับและแลกสรุป LSDB (ขั้นนี้ไวต่อ **MTU mismatch** มาก)',
                '- **Full** — LSDB ตรงกันสมบูรณ์ = adjacency พร้อมใช้งาน',
                '',
                'ค่าที่ "ต้องตรงกัน" จึงจะข้ามจาก Init ไป Full ได้: **area เดียวกัน**, **hello/dead timer ตรงกัน**, อยู่ **subnet เดียวกัน**, **MTU ตรงกัน**, และ authentication (ถ้ามี) — ผิดข้อเดียว neighbor ก็ไม่ขึ้น นี่คือเช็คลิสต์ตอนไล่ปัญหาในโมดูล 5',
              ].join('\n'),
            },
            {
              heading: 'DR/BDR และ Area 0',
              body: [
                'บนเครือข่าย **multi-access** (เช่นหลายเราเตอร์ต่อสวิตช์เดียวกัน) ถ้าทุกคู่จับ adjacency เต็มกันหมดจะเกิด LSA ท่วม OSPF จึงเลือก **DR (Designated Router)** และ **BDR (Backup)** ให้ทุกตัวคุยผ่าน DR เป็นศูนย์กลาง',
                '',
                'การเลือก: ดู **OSPF priority** สูงสุดก่อน (เสมอกันดู router-id สูงสุด) — ตั้ง priority 0 เพื่อกันไม่ให้เป็น DR ได้ บนลิงก์ point-to-point ไม่มีการเลือก DR/BDR',
                '',
                'ทุก area ต้องเชื่อมกับ **area 0 (backbone)** การออกแบบ single area คือทุกอย่างอยู่ area 0 — เหมาะกับเครือข่ายเล็ก โมดูลถัดไปจะแตกเป็นหลาย area เมื่อโตขึ้น',
                '',
                '> VyOS ใช้ FRR เป็น OSPF engine คำสั่งหลักคือ `set protocols ospf area 0 network <prefix>` และตรวจด้วย `show ip ospf neighbor` / `show ip route ospf`',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — OSPF Single Area',
          order: 1,
          estMinutes: 30,
          description: 'ตั้ง OSPF area 0 ระหว่างสองเราเตอร์ ให้จับ neighbor เป็น Full แลกเส้นทาง LAN ของกันและกัน แล้วพิสูจน์ด้วยการ ping ข้ามไปยังวงปลายทาง',
          scenario: {
            from: 'พี่ต้น Network Architect',
            priority: 'medium',
            body: 'เครือข่ายเราเริ่มมีหลายวงแล้ว ตอนนี้ยังใช้ static route จดมือกันอยู่ พอเพิ่มวงทีต้องไล่แก้ทุกเราเตอร์ เริ่มไม่ไหว อยากเปลี่ยนมาใช้ dynamic routing ให้เราเตอร์เรียนรู้เส้นทางกันเอง เริ่มจากต้นแบบสองตัวก่อน ตั้ง OSPF area เดียวให้สองฝั่งเห็นวง LAN ของกันและกันอัตโนมัติ ถ้าเวิร์กจะขยายทั้งระบบ',
          },
          objectives: [
            'ตั้ง OSPF area 0 บน R1 และ R2 ครอบลิงก์เชื่อมและวง LAN ของแต่ละฝั่ง',
            'ยืนยันว่า neighbor ขึ้นสถานะ Full',
            'พิสูจน์ว่า R1 เรียนรู้วง LAN ของ R2 และ ping ถึงได้',
          ],
          hints: [
            'โครงสร้าง: R1(eth1=10.0.12.1/24, dum0=192.168.1.1/24) — R2(eth1=10.0.12.2/24, dum0=192.168.2.1/24)',
            'สร้าง LAN จำลองด้วย dummy: `set interfaces dummy dum0 address 192.168.1.1/24` (R2 ใช้ 192.168.2.1/24)',
            'R1: `set protocols ospf parameters router-id 1.1.1.1` · `set protocols ospf area 0 network 10.0.12.0/24` · `set protocols ospf area 0 network 192.168.1.0/24`',
            'R2 ทำเหมือนกัน (router-id 2.2.2.2, network 10.0.12.0/24 + 192.168.2.0/24) — ทั้งคู่ต้องอยู่ area 0',
            'ตรวจ: `show ip ospf neighbor` (ต้องเห็น Full) · `show ip route ospf` (ต้องมี 192.168.2.0/24) · `ping 192.168.2.1`',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 จับ neighbor OSPF เป็น Full', node: 'R1', command: 'show ip ospf neighbor', expect: 'Full', points: 3,
              failHint: 'neighbor ยังไม่ Full — เช็ค: ทั้งสองฝั่งประกาศ network 10.0.12.0/24 ใน area 0 เดียวกันหรือยัง, ลิงก์ `ping 10.0.12.2` ผ่านไหม, commit แล้วหรือยัง' },
            { description: 'R1 เรียนรู้วง LAN ของ R2 (192.168.2.0) ผ่าน OSPF', node: 'R1', command: 'show ip route ospf | match 192.168.2', expect: '192\\.168\\.2\\.0', points: 4,
              failHint: 'neighbor Full แต่ไม่มีเส้นทาง — แปลว่า R2 ยังไม่ได้ประกาศวง LAN ของตัวเอง: `set protocols ospf area 0 network 192.168.2.0/24` และต้องมี dum0 ถือ 192.168.2.1/24 จริง' },
            { description: 'R1 ping วง LAN ของ R2 (192.168.2.1) ได้', node: 'R1', command: 'ping 192.168.2.1 count 3', expect: 'bytes from 192\\.168\\.2\\.1', points: 3,
              failHint: 'route มาแล้วแต่ ping ไม่ถึง — เช็คว่า R2 สร้าง dum0 address 192.168.2.1/24 จริง (โฆษณา network ที่ไม่มี interface รองรับ จะมี route แต่ ping ไม่โดน)' },
          ],
        },
      ],
    },

    // ── โมดูล 2 — OSPF Multi-Area ───────────────────────────────────────
    {
      title: 'โมดูล 2 — OSPF Multi-Area',
      description: 'แตก OSPF เป็นหลาย area ผ่าน ABR และเรียนรู้เส้นทางข้าม area (inter-area / O IA)',
      order: 1,
      objectives: [
        'ออกแบบ topology สาม area: internal area 1 → ABR → backbone area 0',
        'ตั้งเราเตอร์ตัวกลางให้เป็น ABR ที่เชื่อมสอง area',
        'พิสูจน์ว่าเราเตอร์ใน area 1 เรียนรู้เส้นทางข้าม area (O IA) และ ping ถึงได้',
      ],
      lessons: [
        {
          type: 'lab',
          title: 'แล็บ — OSPF Multi-Area และ ABR',
          order: 0,
          estMinutes: 35,
          description: 'สร้าง OSPF สอง area โดยมี R2 เป็น ABR คั่นระหว่าง area 1 (ฝั่ง R1) กับ area 0 (ฝั่ง R3) แล้วพิสูจน์ว่า R1 เรียนรู้เส้นทาง inter-area ของ R3 และ ping ถึงได้',
          scenario: {
            from: 'พี่ต้น Network Architect',
            priority: 'high',
            body: 'OSPF area เดียวเริ่มอืดแล้ว LSDB ใหญ่ขึ้นทุกวัน ทุกครั้งที่ลิงก์ไหนกระพริบ ทั้งโดเมนต้องคำนวณ SPF ใหม่หมด พี่อยากแบ่งเป็นหลาย area ให้ขอบเขตการ flood แคบลง ออกแบบให้ฝั่งสาขาเป็น area 1 แล้วมีเราเตอร์ตัวกลางทำหน้าที่ ABR เชื่อมเข้า backbone area 0 ลองทำต้นแบบสามตัวให้ดูหน่อยว่าฝั่ง area 1 ยังเห็นเส้นทางฝั่ง backbone ได้',
          },
          objectives: [
            'ตั้งลิงก์ R1–R2 อยู่ใน area 1 และลิงก์ R2–R3 อยู่ใน area 0',
            'ให้ R2 เป็น ABR (มี interface ในทั้งสอง area)',
            'พิสูจน์ว่า R1 (ภายใน area 1) เรียนรู้วง LAN ของ R3 แบบ inter-area และ ping ถึง',
          ],
          hints: [
            'โครงสร้าง: R1(eth1=10.0.12.1/24, dum0=192.168.1.1/24) — R2(eth1=10.0.12.2/24, eth2=10.0.23.2/24) — R3(eth1=10.0.23.3/24, dum0=192.168.3.1/24)',
            'R1 (area 1): `set protocols ospf parameters router-id 1.1.1.1` · `set protocols ospf area 1 network 10.0.12.0/24` · `set protocols ospf area 1 network 192.168.1.0/24`',
            'R2 (ABR): `set protocols ospf parameters router-id 2.2.2.2` · `set protocols ospf area 1 network 10.0.12.0/24` · `set protocols ospf area 0 network 10.0.23.0/24`',
            'R3 (area 0): `set protocols ospf parameters router-id 3.3.3.3` · `set protocols ospf area 0 network 10.0.23.0/24` · `set protocols ospf area 0 network 192.168.3.0/24`',
            'ตรวจที่ R1: `show ip route ospf` จะเห็น 192.168.3.0/24 เป็น inter-area (O IA) แล้ว `ping 192.168.3.1` — ฝั่ง R2 ต้องจับ neighbor Full กับทั้ง R1 และ R3',
          ],
          topology: {
            nodes: [ vyos('R1', -300, 0), vyos('R2', 0, 0), vyos('R3', 300, 0) ],
            links: [
              { node1: 'R1', port1: 1, node2: 'R2', port2: 1 },
              { node1: 'R2', port1: 2, node2: 'R3', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'R2 (ABR) จับ neighbor Full กับทั้งสองฝั่ง', node: 'R2', command: 'show ip ospf neighbor', expect: 'Full', points: 3,
              failHint: 'ABR ยังไม่ขึ้น neighbor — R2 ต้องประกาศลิงก์ฝั่ง R1 ใน area 1 (10.0.12.0/24) และลิงก์ฝั่ง R3 ใน area 0 (10.0.23.0/24) ให้ครบทั้งสอง' },
            { description: 'R1 เรียนรู้วง LAN ของ R3 ข้าม area (192.168.3.0)', node: 'R1', command: 'show ip route ospf | match 192.168.3', expect: '192\\.168\\.3\\.0', points: 4,
              failHint: 'R1 ยังไม่เห็นเส้นทางข้าม area — ตรวจว่า R2 เป็น ABR จริง (มีทั้ง area 1 และ area 0) เพราะ inter-area route (O IA) ถูกสร้างจาก ABR เท่านั้น และ R3 ต้องประกาศ 192.168.3.0/24 ใน area 0' },
            { description: 'R1 ping วง LAN ของ R3 (192.168.3.1) ข้าม area ได้', node: 'R1', command: 'ping 192.168.3.1 count 3', expect: 'bytes from 192\\.168\\.3\\.1', points: 3,
              failHint: 'route inter-area มาแล้วแต่ ping ไม่ถึง — เช็ค return path: R3 ต้องเรียนรู้วง 192.168.1.0/24 กลับด้วย (ถ้า R3 ไม่มีเส้นทางกลับ echo reply จะหาย) และ dum0 ของ R3 ต้องถือ 192.168.3.1/24 จริง' },
          ],
        },
      ],
    },

    // ── โมดูล 3 — OSPF Stub / NSSA Areas ────────────────────────────────
    {
      title: 'โมดูล 3 — OSPF Stub และ NSSA Areas',
      description: 'ลดขนาด LSDB ของ area ขอบด้วย stub, totally stubby และ NSSA',
      order: 2,
      objectives: [
        'อธิบายความต่างของ stub, totally stubby และ NSSA',
        'อธิบายว่า ABR ฉีด default route เข้า stub area แทน external LSA อย่างไร',
        'ตั้ง area 1 เป็น stub และพิสูจน์ว่าเราเตอร์ภายในได้รับ default route',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Stub, Totally Stubby และ NSSA',
          order: 0,
          estMinutes: 12,
          sections: [
            {
              heading: 'ทำไมต้องมี Stub Area',
              body: [
                'area ขอบ (ปลายทาง ไม่ได้เป็นทางผ่าน) ไม่จำเป็นต้องรู้ external route (Type 5) ทุกเส้นจากทั้ง AS — เก็บไว้ก็เปลือง LSDB และ SPF เปล่า ๆ',
                '',
                'แนวคิด **stub area** คือ: บล็อก external LSA ไม่ให้เข้ามา แล้วให้ **ABR ฉีด default route (0.0.0.0/0)** เข้ามาแทน — "ออกนอก area ไปทางไหนก็วิ่งไป ABR แล้วกัน" ทำให้ตารางเล็กลงมากแต่ยังออกข้างนอกได้',
              ].join('\n'),
            },
            {
              heading: 'สามระดับของการ "ตัด LSA"',
              body: [
                '| ชนิด area | บล็อก Type 5 (external) | บล็อก Type 3 (inter-area) | ฉีด default |',
                '|---|---|---|---|',
                '| **Stub** | ✅ | ❌ (ยังเห็น inter-area) | ✅ |',
                '| **Totally Stubby** | ✅ | ✅ | ✅ |',
                '| **NSSA** | บางส่วน (อนุญาต external ของตัวเองผ่าน Type 7) | ❌ | ทางเลือก |',
                '',
                '- **Totally stubby** (เฉพาะ Cisco/VyOS) ตัดทั้ง external และ inter-area เหลือแค่ default — เล็กที่สุด',
                '- **NSSA (Not-So-Stubby Area)** ใช้เมื่อ area ขอบ "มี ASBR ของตัวเอง" (ต้อง redistribute external เข้ามา) ซึ่ง stub ปกติทำไม่ได้ — NSSA ห่อ external เป็น **Type 7** แล้วให้ ABR แปลงเป็น Type 5 ออกสู่ backbone',
              ].join('\n'),
            },
            {
              heading: 'ข้อกำหนดและคำสั่งบน VyOS',
              body: [
                'กฎเหล็ก: **เราเตอร์ทุกตัวใน area เดียวกันต้องตั้งชนิด area ให้ตรงกัน** (ทั้งตัวภายในและ ABR) ไม่งั้น neighbor จะไม่ขึ้น (ค่า flag ใน Hello ไม่ตรง)',
                '',
                '```',
                'set protocols ospf area 1 area-type stub              # stub ธรรมดา',
                'set protocols ospf area 1 area-type stub no-summary   # totally stubby (ตั้งที่ ABR)',
                'set protocols ospf area 1 area-type nssa              # NSSA',
                '```',
                '',
                'ในแล็บนี้เราจะตั้ง area 1 เป็น **stub** ทั้ง R1 (ภายใน) และ R2 (ABR) แล้วสังเกตว่า R1 ได้รับ **default route (O IA 0.0.0.0/0)** จาก ABR โดยอัตโนมัติ',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — OSPF Stub Area',
          order: 1,
          estMinutes: 30,
          description: 'ตั้ง area 1 เป็น stub ทั้งเราเตอร์ภายใน (R1) และ ABR (R2) แล้วพิสูจน์ว่า R1 ได้รับ default route จาก ABR แทนที่จะต้องรู้ทุกเส้นทาง และยัง ping ออกไปยัง backbone ได้',
          scenario: {
            from: 'พี่เมษ์ ทีม Data Center',
            priority: 'medium',
            body: 'สาขาเล็ก ๆ ปลายทางพวกนี้เราเตอร์สเปกไม่สูง แต่ตอนนี้มันต้องแบก LSDB ของทั้ง AS ไว้เต็มไปหมด ทั้งที่จริงมันแค่ต้อง "ออกไปข้างนอก" ทางเดียว ฝากแปลง area ของสาขาให้เป็น stub ที จะได้ตัด external route ทิ้ง แล้วให้ ABR ยัด default route เข้ามาแทน เราเตอร์จะได้เบาลงเยอะ',
          },
          objectives: [
            'ตั้ง area 1 เป็น stub บนทั้ง R1 (internal) และ R2 (ABR)',
            'พิสูจน์ว่า R1 ได้รับ default route (0.0.0.0/0) ผ่าน OSPF',
            'พิสูจน์ว่า R1 ยังออกไปยังวง backbone (192.168.3.1) ได้',
          ],
          hints: [
            'โครงสร้างเหมือนแล็บ multi-area: R1(eth1=10.0.12.1/24, dum0=192.168.1.1/24) — R2(ABR: eth1=10.0.12.2/24 area1, eth2=10.0.23.2/24 area0) — R3(eth1=10.0.23.3/24, dum0=192.168.3.1/24, area0)',
            'ตั้ง OSPF ให้ทำงานก่อน (เหมือนโมดูล 2) ให้ neighbor ขึ้น Full ครบ',
            'ทำให้ area 1 เป็น stub: บน R1 `set protocols ospf area 1 area-type stub` และบน R2 `set protocols ospf area 1 area-type stub` (ต้องตั้งทั้งสองตัวให้ตรงกัน ไม่งั้น neighbor หลุด)',
            'ตรวจที่ R1: `show ip route ospf` ต้องมี 0.0.0.0/0 (default ที่ ABR ฉีดเข้ามา) และ `ping 192.168.3.1` ยังต้องผ่าน',
          ],
          topology: {
            nodes: [ vyos('R1', -300, 0), vyos('R2', 0, 0), vyos('R3', 300, 0) ],
            links: [
              { node1: 'R1', port1: 1, node2: 'R2', port2: 1 },
              { node1: 'R2', port1: 2, node2: 'R3', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'R1 ตั้ง area 1 เป็น stub', node: 'R1', command: 'show configuration commands | match "area-type"', expect: 'stub', points: 3,
              failHint: 'ยังไม่ได้ตั้ง stub — `set protocols ospf area 1 area-type stub` และอย่าลืมตั้งที่ R2 (ABR) ให้ตรงกันด้วย ไม่งั้น Hello flag ไม่ตรงและ neighbor จะหลุด' },
            { description: 'R1 ได้รับ default route จาก ABR (0.0.0.0/0)', node: 'R1', command: 'show ip route ospf | match "0.0.0.0/0"', expect: '0\\.0\\.0\\.0/0', points: 4,
              failHint: 'ยังไม่มี default — default จะถูก ABR ฉีดเข้า stub อัตโนมัติเมื่อ "ทั้งสองตัวใน area 1" เป็น stub และ neighbor ยังขึ้น Full อยู่ ถ้า neighbor หลุดหลังตั้ง stub แปลว่าตั้งไม่ตรงกันสองฝั่ง' },
            { description: 'R1 ยังออกไปยังวง backbone (192.168.3.1) ได้', node: 'R1', command: 'ping 192.168.3.1 count 3', expect: 'bytes from 192\\.168\\.3\\.1', points: 3,
              failHint: 'ออก backbone ไม่ได้ — stub ธรรมดายังเห็น inter-area route อยู่ (ยังควร ping ถึง 192.168.3.1) ถ้า ping ไม่ผ่าน ให้ตรวจว่า neighbor ยัง Full และ R3 มีเส้นทางกลับมายัง 192.168.1.0/24' },
          ],
        },
      ],
    },

    // ── โมดูล 4 — OSPF Route Redistribution ─────────────────────────────
    {
      title: 'โมดูล 4 — OSPF Route Redistribution',
      description: 'นำเส้นทางจากนอก OSPF (connected/static) เข้ามาในโดเมนด้วย redistribution และ external route (O E2)',
      order: 3,
      objectives: [
        'อธิบายบทบาทของ ASBR และ external route ชนิด E1/E2',
        'redistribute เส้นทาง connected เข้า OSPF',
        'พิสูจน์ว่าเราเตอร์อีกฝั่งเรียนรู้เส้นทาง external และ ping ถึงได้',
      ],
      lessons: [
        {
          type: 'lab',
          title: 'แล็บ — Redistribute Connected เข้า OSPF',
          order: 0,
          estMinutes: 30,
          description: 'ให้ R1 ทำหน้าที่ ASBR นำวงที่ไม่ได้อยู่ใน OSPF (connected) เข้ามาในโดเมนด้วย redistribution แล้วพิสูจน์ว่า R2 เรียนรู้เป็น external route (O E2) และ ping ถึงได้',
          scenario: {
            from: 'พี่เบียร์ หัวหน้าฝ่าย IT',
            priority: 'medium',
            body: 'เราเพิ่งเอาวงเซิร์ฟเวอร์เก่าวงหนึ่งมาต่อกับ R1 ตรง ๆ มันเป็นวง connected ไม่ได้อยู่ในกระบวนการ OSPF — เลยมีแต่ R1 ที่รู้จัก เราเตอร์ตัวอื่นในโดเมน OSPF มองไม่เห็นวงนี้เลย เข้าไม่ถึงเซิร์ฟเวอร์ ฝากตั้ง R1 ให้ "ป้อน" วงนี้เข้า OSPF ให้ทั้งโดเมนเห็นด้วย (redistribute) จะได้เข้าถึงกันได้ทั้งระบบ',
          },
          objectives: [
            'สร้างวง connected บน R1 (dum1 = 172.16.50.1/24) ที่ไม่ได้ประกาศใน OSPF โดยตรง',
            'ตั้ง R1 ให้ redistribute connected เข้า OSPF (กลายเป็น ASBR)',
            'พิสูจน์ว่า R2 เรียนรู้ 172.16.50.0/24 เป็น external และ ping 172.16.50.1 ได้',
          ],
          hints: [
            'โครงสร้าง: R1(eth1=10.0.12.1/24, dum1=172.16.50.1/24) — R2(eth1=10.0.12.2/24)',
            'ตั้ง OSPF บนลิงก์ก่อน: ทั้งคู่ `set protocols ospf area 0 network 10.0.12.0/24` (R1 router-id 1.1.1.1, R2 router-id 2.2.2.2) ให้ neighbor ขึ้น Full',
            'อย่าประกาศ 172.16.50.0/24 ด้วย `area 0 network` — ให้เข้ามาทาง redistribution แทน: บน R1 `set protocols ospf redistribute connected`',
            'ตรวจที่ R2: `show ip route ospf` จะเห็น 172.16.50.0/24 เป็น external (O E2) แล้ว `ping 172.16.50.1`',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งค่า redistribute เข้า OSPF', node: 'R1', command: 'show configuration commands | match "ospf redistribute"', expect: 'redistribute', points: 3,
              failHint: 'ยังไม่มี redistribute — `set protocols ospf redistribute connected` ทำให้ R1 กลายเป็น ASBR และดึงวง connected (รวม 172.16.50.0/24) เข้า OSPF' },
            { description: 'R2 เรียนรู้เส้นทาง external (172.16.50.0)', node: 'R2', command: 'show ip route ospf | match 172.16.50', expect: '172\\.16\\.50\\.0', points: 4,
              failHint: 'R2 ยังไม่เห็นวง external — ตรวจว่า neighbor R1–R2 ขึ้น Full, R1 มี dum1 ถือ 172.16.50.1/24 จริง และ redistribute connected ถูก commit แล้ว (external route จะขึ้นเป็น O E2)' },
            { description: 'R2 ping วง external (172.16.50.1) ได้', node: 'R2', command: 'ping 172.16.50.1 count 3', expect: 'bytes from 172\\.16\\.50\\.1', points: 3,
              failHint: 'route external มาแล้วแต่ ping ไม่ถึง — เช็คว่า dum1 ของ R1 ขึ้น (address 172.16.50.1/24) และ next-hop ที่ R2 เห็น (10.0.12.1) ถึงกันจริง' },
          ],
        },
      ],
    },

    // ── โมดูล 5 — OSPF Troubleshooting ──────────────────────────────────
    {
      title: 'โมดูล 5 — OSPF Troubleshooting',
      description: 'โจทย์ "OSPF พังมาแล้ว หาให้เจอ ซ่อมให้ได้" — neighbor ไม่ขึ้น, ติด ExStart และจบด้วย boss lab',
      order: 4,
      objectives: [
        'ไล่ปัญหา OSPF neighbor ที่ไม่ขึ้นอย่างเป็นระบบ',
        'วินิจฉัย area mismatch, hello/dead mismatch และ MTU mismatch',
        'พิสูจน์ว่าซ่อมสำเร็จด้วย neighbor Full, เส้นทางที่ถูกเรียนรู้ และ ping',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'ไล่ปัญหา OSPF: อ่านสถานะ Neighbor ให้เป็น',
          order: 0,
          estMinutes: 10,
          sections: [
            {
              heading: 'สถานะ Neighbor บอกชั้นของปัญหา',
              body: [
                'คำสั่งคู่ใจ: `show ip ospf neighbor` — สถานะที่ "ค้าง" บอกได้เลยว่าปัญหาอยู่ตรงไหน',
                '',
                '- **ไม่มี neighbor เลย** — Hello ไปไม่ถึงกัน: ลิงก์ down, ไม่ได้ประกาศ network ใน OSPF, passive-interface, หรือคนละ subnet',
                '- **ค้างที่ Init / 2-Way ไม่ไป Full** — ค่าใน Hello ไม่ตรง: **area mismatch**, **hello/dead timer mismatch**, area-type (stub) ไม่ตรง, หรือ authentication ผิด',
                '- **ค้างที่ ExStart / Exchange** — อาการคลาสสิกของ **MTU mismatch** (สองฝั่ง MTU ไม่เท่ากันจะแลก DBD ไม่สำเร็จ)',
              ].join('\n'),
            },
            {
              heading: 'เช็คลิสต์ค่าที่ต้องตรงกัน',
              body: [
                'จับคู่ neighbor ได้ต่อเมื่อค่าต่อไปนี้ตรงกันทั้งสองฝั่ง:',
                '',
                '1. อยู่ **subnet เดียวกัน** บนลิงก์',
                '2. **area เดียวกัน** (และชนิด area เช่น stub ต้องตรง)',
                '3. **hello/dead timer** ตรงกัน',
                '4. **MTU** ตรงกัน (หรือเปิด `mtu-ignore`)',
                '5. authentication ตรงกัน (ถ้ามี)',
                '',
                'คำสั่งช่วยขุด: `show ip ospf interface <ifname>` (ดู area, hello/dead, MTU, สถานะ), `show configuration commands | match ospf`, และ `show interfaces` (ดู MTU + สถานะ u/u)',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'ซ่อม #1 — neighbor ไม่ขึ้น (area ไม่ตรง)',
          order: 1,
          estMinutes: 25,
          mode: 'troubleshoot',
          description: 'OSPF ถูกตั้งไว้เกือบครบ ลิงก์ก็ปกติ แต่ neighbor ไม่ยอมขึ้น Full สักที — หาให้เจอว่าทำไมแล้วซ่อมให้ R1 เรียนรู้เส้นทางของ R2 ได้',
          scenario: {
            from: 'คุณฝน NOC กะดึก',
            priority: 'high',
            body: 'มีคนตั้ง OSPF ลิงก์ใหม่ไว้เมื่อเย็นนี้ แต่จนป่านนี้สองฝั่งยังไม่เห็นเส้นทางของกันเลยค่ะ ลิงก์ ping หากันได้ปกตินะ (10.0.12.x ถึงกัน) แต่ `show ip ospf neighbor` ว่างเปล่า เหมือน OSPF ไม่ยอมจับคู่ ช่วยดูหน่อยว่าใครตั้งอะไรพลาดไว้',
          },
          objectives: [
            'หาสาเหตุที่ neighbor OSPF ไม่ขึ้น ทั้งที่ลิงก์ปกติ',
            'ซ่อมให้ R1 และ R2 จับ neighbor เป็น Full',
            'พิสูจน์ว่า R1 เรียนรู้วง LAN ของ R2 และ ping ถึงได้',
          ],
          hints: [
            'ลิงก์ปกติ (ping 10.0.12.2 ผ่าน) แต่ neighbor ว่าง → ปัญหาอยู่ที่ค่าใน Hello ไม่ตรง ไม่ใช่ L1/L2',
            'เทียบสองฝั่งด้วย `show ip ospf interface eth1` — ดูบรรทัด Area ของแต่ละตัวว่าตรงกันไหม',
            'ดู config: `show configuration commands | match "ospf area"` ทั้งสองเครื่อง — ลิงก์ 10.0.12.0/24 ถูกประกาศไว้คนละ area',
            'ซ่อมให้ลิงก์อยู่ area เดียวกัน เช่นบน R2: `delete protocols ospf area 1 network 10.0.12.0/24` แล้ว `set protocols ospf area 0 network 10.0.12.0/24` (อย่าลืม commit)',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.1/24',
              'set interfaces dummy dum0 address 192.168.1.1/24',
              'set protocols ospf parameters router-id 1.1.1.1',
              'set protocols ospf area 0 network 10.0.12.0/24',
              'set protocols ospf area 0 network 192.168.1.0/24',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.2/24',
              'set interfaces dummy dum0 address 192.168.2.1/24',
              'set protocols ospf parameters router-id 2.2.2.2',
              'set protocols ospf area 1 network 10.0.12.0/24',
              'set protocols ospf area 0 network 192.168.2.0/24',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'R1 จับ neighbor OSPF เป็น Full', node: 'R1', command: 'show ip ospf neighbor', expect: 'Full', points: 4,
              failHint: 'neighbor ยังไม่ขึ้น — ลิงก์ 10.0.12.0/24 ถูกประกาศคนละ area (ฝั่งหนึ่ง area 0 อีกฝั่ง area 1) ทำให้ Hello flag ไม่ตรง จับคู่ไม่ได้ ปรับให้ทั้งสองฝั่งอยู่ area เดียวกันบนลิงก์นี้' },
            { description: 'R1 เรียนรู้วง LAN ของ R2 (192.168.2.0)', node: 'R1', command: 'show ip route ospf | match 192.168.2', expect: '192\\.168\\.2\\.0', points: 3,
              failHint: 'พอ neighbor ขึ้น Full เส้นทางควรมาเอง — ถ้ายังไม่มา ตรวจว่าแก้ฝั่งที่ผิด area แล้ว commit จริง' },
            { description: 'R1 ping วง LAN ของ R2 (192.168.2.1) ได้', node: 'R1', command: 'ping 192.168.2.1 count 3', expect: 'bytes from 192\\.168\\.2\\.1', points: 3,
              failHint: 'ยัง ping ไม่ถึง — ยืนยันว่า neighbor Full และเส้นทาง 192.168.2.0/24 อยู่ใน routing table แล้ว' },
          ],
        },
        {
          type: 'lab',
          title: 'ซ่อม #2 — neighbor วูบ ๆ (hello timer ไม่ตรง)',
          order: 2,
          estMinutes: 25,
          mode: 'troubleshoot',
          description: 'OSPF เคยทำงาน แต่หลังมีคน "จูน" ค่าบนอินเทอร์เฟซฝั่งหนึ่ง neighbor ก็ไม่ยอมขึ้นอีกเลย — หาค่าที่ถูกแก้แล้วคืนให้ตรงกัน',
          scenario: {
            from: 'พี่เบียร์ หัวหน้าฝ่าย IT',
            priority: 'medium',
            body: 'เมื่อวานมีน้องฝึกงานไป "ปรับจูนให้ OSPF เร็วขึ้น" บนเราเตอร์ตัวหนึ่ง ปรากฏว่าหลังจากนั้น neighbor หลุดเลยจับไม่ติดอีก ทั้งที่ก่อนหน้านี้ทำงานดี ๆ ฝากย้อนดูว่ามันไปแตะค่าอะไรบนอินเทอร์เฟซไว้ แล้วทำให้สองฝั่งกลับมาคุยกันได้เหมือนเดิม',
          },
          objectives: [
            'หาค่าบนอินเทอร์เฟซที่ถูกแก้จนทำให้ Hello ไม่ตรงกัน',
            'คืนค่าให้สองฝั่งตรงกันจน neighbor กลับมา Full',
            'พิสูจน์ด้วยเส้นทางที่เรียนรู้และ ping',
          ],
          hints: [
            'ลิงก์ปกติและ area ตรงกัน แต่ neighbor ไม่ขึ้น → สงสัย hello/dead timer ก่อน',
            'เทียบ `show ip ospf interface eth1` สองฝั่ง — มองหาบรรทัด Timer (Hello/Dead) ที่ตัวเลขไม่ตรงกัน',
            'หาในconfig: `show configuration commands | match "hello-interval"` — ฝั่งที่ถูกแก้จะมีบรรทัดนี้โผล่มา',
            'คืนค่าเริ่มต้น: `delete protocols ospf interface eth1 hello-interval` (ค่ามาตรฐานคือ 10 วินาที) แล้ว commit',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.1/24',
              'set interfaces dummy dum0 address 192.168.1.1/24',
              'set protocols ospf parameters router-id 1.1.1.1',
              'set protocols ospf area 0 network 10.0.12.0/24',
              'set protocols ospf area 0 network 192.168.1.0/24',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.2/24',
              'set interfaces dummy dum0 address 192.168.2.1/24',
              'set protocols ospf parameters router-id 2.2.2.2',
              'set protocols ospf area 0 network 10.0.12.0/24',
              'set protocols ospf area 0 network 192.168.2.0/24',
              'set protocols ospf interface eth1 hello-interval 5',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'R1 จับ neighbor OSPF เป็น Full', node: 'R1', command: 'show ip ospf neighbor', expect: 'Full', points: 4,
              failHint: 'neighbor ยังไม่ขึ้น — ฝั่งหนึ่งถูกตั้ง hello-interval ไม่เท่าอีกฝั่ง (ค่ามาตรฐาน 10) OSPF บังคับให้ hello/dead ตรงกันเป๊ะ คืนค่าฝั่งที่ถูกแก้ด้วย `delete protocols ospf interface eth1 hello-interval`' },
            { description: 'R1 เรียนรู้วง LAN ของ R2 (192.168.2.0)', node: 'R1', command: 'show ip route ospf | match 192.168.2', expect: '192\\.168\\.2\\.0', points: 3,
              failHint: 'เส้นทางจะมาเองเมื่อ neighbor Full — ถ้ายังไม่มา แปลว่า timer ยังไม่ตรงหรือยังไม่ commit' },
            { description: 'R1 ping วง LAN ของ R2 (192.168.2.1) ได้', node: 'R1', command: 'ping 192.168.2.1 count 3', expect: 'bytes from 192\\.168\\.2\\.1', points: 3,
              failHint: 'ยัง ping ไม่ถึง — ยืนยัน neighbor Full และมีเส้นทาง 192.168.2.0/24 ใน routing table' },
          ],
        },
        {
          type: 'lab',
          title: 'Boss — neighbor ติด ExStart และเส้นทางหาย',
          order: 3,
          estMinutes: 35,
          mode: 'troubleshoot',
          isBoss: true,
          passThreshold: 80,
          description: 'โจทย์ท้าทายปลายโมดูล: OSPF จับคู่ค้างอยู่ที่ ExStart ไม่ยอมไป Full และต่อให้แก้ได้ เส้นทางปลายทางก็ยังหายไปอีกจุด — มีสองอย่างที่พังพร้อมกัน หาให้ครบแล้วซ่อมให้จบ',
          scenario: {
            from: 'พี่ปอนด์ Security Officer',
            priority: 'high',
            body: 'เคสนี้ส่งต่อมาจากกะเช้าแล้วยังแก้ไม่ได้ — เราเตอร์คู่นี้ neighbor ขึ้น ๆ ดับ ๆ ค้างอยู่แถว ExStart ไม่เคยถึง Full เลย ทีมก่อนหน้าเดาว่า "น่าจะค่า MTU" แต่ลองแก้แล้วก็ยังไม่หมดปัญหา เหมือนมีอะไรพังซ้อนอยู่อีกชั้น ฝากสางให้จบ ทำให้ R1 มองเห็นและ ping วง LAN ของ R2 ให้ได้',
          },
          objectives: [
            'วินิจฉัยสาเหตุที่ neighbor ค้างที่ ExStart (อาการคลาสสิกของ MTU mismatch)',
            'หาจุดพังที่สอง: วง LAN ปลายทางที่ไม่ถูกประกาศเข้า OSPF',
            'ซ่อมให้ครบทั้งสองจุดจน R1 เรียนรู้และ ping วง LAN ของ R2 ได้',
          ],
          hints: [
            'จุดที่ 1 — neighbor ค้าง ExStart: เกือบทุกครั้งคือ MTU สองฝั่งไม่เท่ากัน เทียบ `show interfaces` (ดูคอลัมน์ MTU) หรือ `show ip ospf interface eth1`',
            'แก้ MTU ได้สองทาง: ปรับ MTU ให้เท่ากัน เช่น `set interfaces ethernet eth1 mtu 1500` ฝั่งที่ถูกย่อ — หรือสั่งให้ OSPF เลิกเช็ค MTU ด้วย `set protocols ospf interface eth1 mtu-ignore` (ทำทั้งสองฝั่ง)',
            'จุดที่ 2 — พอ neighbor Full แล้วแต่ยังไม่เห็น 192.168.2.0/24: ตรวจ `show configuration commands | match "ospf area"` ฝั่ง R2 ว่าได้ประกาศวง LAN ของตัวเองเข้า OSPF หรือยัง',
            'เพิ่มที่ R2: `set protocols ospf area 0 network 192.168.2.0/24` แล้ว commit จากนั้นทดสอบ `ping 192.168.2.1` จาก R1',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.1/24',
              'set interfaces dummy dum0 address 192.168.1.1/24',
              'set protocols ospf parameters router-id 1.1.1.1',
              'set protocols ospf area 0 network 10.0.12.0/24',
              'set protocols ospf area 0 network 192.168.1.0/24',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.2/24',
              'set interfaces ethernet eth1 mtu 1400',
              'set interfaces dummy dum0 address 192.168.2.1/24',
              'set protocols ospf parameters router-id 2.2.2.2',
              'set protocols ospf area 0 network 10.0.12.0/24',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'R1 จับ neighbor OSPF เป็น Full (แก้ MTU แล้ว)', node: 'R1', command: 'show ip ospf neighbor', expect: 'Full', points: 4,
              failHint: 'ยังค้าง ExStart — MTU สองฝั่งไม่เท่ากัน OSPF จึงแลก DBD ไม่สำเร็จ ปรับ MTU ให้ตรง (`set interfaces ethernet eth1 mtu 1500` ฝั่งที่ถูกย่อ) หรือเปิด `mtu-ignore` ทั้งสองฝั่ง' },
            { description: 'R1 เรียนรู้วง LAN ของ R2 (192.168.2.0)', node: 'R1', command: 'show ip route ospf | match 192.168.2', expect: '192\\.168\\.2\\.0', points: 3,
              failHint: 'จุดพังที่สอง: ถึง neighbor Full แล้ว R2 ก็ยังไม่ได้ประกาศวง LAN ของตัวเอง — เพิ่ม `set protocols ospf area 0 network 192.168.2.0/24` ที่ R2' },
            { description: 'R1 ping วง LAN ของ R2 (192.168.2.1) ได้', node: 'R1', command: 'ping 192.168.2.1 count 3', expect: 'bytes from 192\\.168\\.2\\.1', points: 3,
              failHint: 'ต้องแก้ครบทั้งสองจุด (MTU ให้ neighbor Full + ประกาศ network ให้เส้นทางมา) ping ถึงจะผ่าน' },
          ],
        },
      ],
    },
  ],
};
