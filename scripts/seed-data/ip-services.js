// IP Services — บริการเครือข่ายที่ใช้งานทุกวัน (DNS / NTP / SNMP / Syslog / QoS)
//
// ครอบคลุมหัวข้อ IP Services ที่เป็น 10% ของ CCNA 200-301 ซึ่งหลักสูตรเดิมแตะ
// แค่ DHCP/NAT — เพิ่ม DNS, NTP, SNMP, Syslog และ QoS ให้ครบโดเมน
//
// บริการเหล่านี้บางตัวพิสูจน์ผลเชิงฟังก์ชันบน VyOS+VPCS ได้ตรง ๆ (DNS ตอบชื่อ,
// NTP/ลิงก์ถึงกัน) จึงทำเป็นแล็บ ส่วนที่ต้องมี NMS/collector ภายนอกมายืนยัน
// (SNMP polling, syslog ปลายทาง) เน้นเป็น reading + แบบทดสอบเชิงแนวคิดแทน
// คำสั่งอ้างอิงไวยากรณ์ VyOS 1.4+/1.5 — การให้คะแนนเน้นผลลัพธ์/ความถูกต้องของ config

import { vyos, pc } from './_vyos.js';

export default {
  slug: 'ip-services',
  title: 'IP Services',
  description: 'บริการโครงสร้างพื้นฐานที่เครือข่ายทุกที่ต้องมี: DNS (การแปลงชื่อ), NTP (เวลาตรงกันทั้งระบบ), SNMP (การมอนิเตอร์), Syslog (การเก็บ log รวมศูนย์) และ QoS (จัดลำดับความสำคัญทราฟฟิก) — ปิดช่องว่างหัวข้อ IP Services ที่เป็น 10% ของ CCNA พร้อมแล็บลงมือทำบน VyOS',
  level: 'intermediate',
  track: 'Networking',
  estimatedHours: 8,
  prerequisites: ['ผ่าน IP Subnetting หรือเทียบเท่า', 'ใช้ VyOS CLI พื้นฐานได้ (set/commit/show)'],
  published: true,
  modules: [
    // ── โมดูล 1 — DNS ───────────────────────────────────────────────────
    {
      title: 'โมดูล 1 — DNS: การแปลงชื่อเป็นที่อยู่',
      description: 'ลำดับชั้นของ DNS, การ resolve แบบ recursive/iterative, ชนิดเรกคอร์ด และการตั้ง DNS forwarder บน VyOS',
      order: 0,
      objectives: [
        'อธิบายลำดับชั้น DNS (root → TLD → authoritative) และบทบาท resolver',
        'แยกความต่างของการ query แบบ recursive กับ iterative',
        'ตั้ง DNS forwarder และ name resolution บน VyOS แล้วพิสูจน์ด้วยการ ping ด้วยชื่อ',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'ลำดับชั้น DNS, Recursive/Iterative และชนิดเรกคอร์ด',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'ทำไมต้องมี DNS',
              body: [
                'มนุษย์จำชื่อได้ (www.example.com) แต่เครือข่ายเดินทางด้วยตัวเลข (93.184.216.34) **DNS (Domain Name System)** คือ "สมุดโทรศัพท์ของอินเทอร์เน็ต" ที่แปลงชื่อเป็นที่อยู่ IP',
                '',
                'ลำดับชั้นแบบกระจาย ไม่มีเครื่องเดียวรู้ทุกอย่าง:',
                '- **Root servers (.)** — ชี้ไปยัง TLD',
                '- **TLD servers (.com, .th)** — ชี้ไปยัง authoritative ของโดเมน',
                '- **Authoritative server** — ผู้รู้คำตอบจริงของโดเมนนั้น',
              ].join('\n'),
            },
            {
              heading: 'Recursive เทียบ Iterative',
              body: [
                '- **Recursive query** — client ถาม resolver แล้ว "ขอคำตอบสุดท้าย" resolver รับภาระไปไล่ถามต่อเองจนได้ที่อยู่ แล้วส่งกลับมาให้',
                '- **Iterative query** — resolver ถาม root → root ตอบ "ไปถาม TLD สิ" → resolver ถาม TLD → TLD ตอบ "ไปถาม authoritative" ไล่ทีละขั้นจนได้คำตอบ',
                '',
                'ในชีวิตจริง: เครื่องผู้ใช้ส่ง **recursive** ไปที่ resolver/forwarder ของเรา แล้ว resolver ทำ **iterative** ต่อกับชั้นต่าง ๆ ผลลัพธ์ถูก **cache** ไว้ตาม TTL เพื่อตอบครั้งถัดไปได้เร็ว',
              ].join('\n'),
            },
            {
              heading: 'ชนิดเรกคอร์ดที่ต้องรู้จัก',
              body: [
                '| Record | ใช้ทำอะไร |',
                '|---|---|',
                '| **A** | ชื่อ → IPv4 |',
                '| **AAAA** | ชื่อ → IPv6 |',
                '| **CNAME** | ชื่อเล่น (alias) → ชื่อจริง |',
                '| **MX** | เซิร์ฟเวอร์อีเมลของโดเมน |',
                '| **NS** | name server ที่ดูแลโดเมน |',
                '| **PTR** | IP → ชื่อ (reverse lookup) |',
                '',
                'บน VyOS เราตั้งให้เราเตอร์เป็น **DNS forwarder** (`set service dns forwarding`) เพื่อรับ query จาก LAN แล้วส่งต่อ/แคชให้ และตั้ง **static host mapping** (`set system static-host-mapping`) สำหรับชื่อภายในที่ไม่มีใน DNS สาธารณะ — แล็บถัดไปจะลงมือทำและพิสูจน์ด้วยการ `ping` ด้วยชื่อ',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — DNS Forwarder และ Name Resolution',
          order: 1,
          estMinutes: 25,
          description: 'ตั้ง VyOS ให้เป็น DNS forwarder ของวง LAN และเพิ่ม static host mapping สำหรับชื่อเซิร์ฟเวอร์ภายใน แล้วพิสูจน์ว่าเราเตอร์ resolve ชื่อเป็น IP และ ping ด้วยชื่อได้',
          scenario: {
            from: 'พี่เบียร์ หัวหน้าฝ่าย IT',
            priority: 'medium',
            body: 'พนักงานบ่นว่าต้องจำเลข IP ของเซิร์ฟเวอร์ภายในเองทุกตัว เช่นเครื่องไฟล์เซิร์ฟเวอร์ก็ต้องพิมพ์ 192.168.1.10 ตลอด จำยากและพิมพ์ผิดบ่อย ฝากตั้งเราเตอร์ให้ทำหน้าที่ DNS ของวงออฟฟิศ แล้วผูกชื่อ "server1" ให้ชี้ไปเครื่องนั้นที จะได้เรียกด้วยชื่อแทนตัวเลข',
          },
          objectives: [
            'ตั้ง R1 เป็น DNS forwarder รับ query จากวง LAN',
            'เพิ่ม static host mapping ให้ชื่อ server1 → 192.168.1.10 (เครื่อง PC1)',
            'พิสูจน์ว่า R1 ping ด้วยชื่อ server1 ได้ (resolve เป็น 192.168.1.10 และถึงจริง)',
          ],
          hints: [
            'โครงสร้าง: PC1(192.168.1.10) — R1(eth1=192.168.1.1/24) — ตั้ง PC1 ด้วย `ip 192.168.1.10 255.255.255.0 192.168.1.1`',
            'DNS forwarder: `set service dns forwarding listen-address 192.168.1.1` · `set service dns forwarding allow-from 192.168.1.0/24` · `set service dns forwarding name-server 1.1.1.1`',
            'ผูกชื่อภายใน: `set system static-host-mapping host-name server1 inet 192.168.1.10` (เขียนลง /etc/hosts ของ R1 — ตัว resolver จะหาในนี้ก่อน)',
            'commit แล้วทดสอบบน R1: `ping server1 count 3` — บรรทัดแรกต้องขึ้น (192.168.1.10) และต้องมี reply กลับมา',
          ],
          topology: {
            nodes: [ pc('PC1', -260, 0), vyos('R1', 60, 0) ],
            links: [ { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งค่า DNS forwarding', node: 'R1', command: 'show configuration commands | match "dns forwarding"', expect: 'forwarding', points: 3,
              failHint: 'ยังไม่มี DNS forwarder — เริ่มจาก `set service dns forwarding listen-address 192.168.1.1` และ `set service dns forwarding allow-from 192.168.1.0/24` (อย่าลืม name-server ปลายทางด้วย)' },
            { description: 'R1 มี static host mapping ของ server1', node: 'R1', command: 'show configuration commands | match "static-host-mapping"', expect: 'server1', points: 3,
              failHint: 'ยังไม่ผูกชื่อ — `set system static-host-mapping host-name server1 inet 192.168.1.10` (ชื่อ host เป็น server1 ชี้ไป IP ของ PC1)' },
            { description: 'R1 ping ด้วยชื่อ server1 แล้ว resolve + ถึงปลายทางได้', node: 'R1', command: 'ping server1 count 3', expect: 'bytes from 192\\.168\\.1\\.10', points: 4,
              failHint: 'ping ด้วยชื่อไม่ผ่าน — ถ้าขึ้น "unknown host" แปลว่า static-host-mapping ยังไม่ commit; ถ้า resolve ได้ (192.168.1.10) แต่ไม่มี reply ให้เช็คว่า PC1 ตั้ง IP 192.168.1.10/24 จริง' },
          ],
        },
      ],
    },

    // ── โมดูล 2 — NTP ───────────────────────────────────────────────────
    {
      title: 'โมดูล 2 — NTP: เวลาที่ตรงกันทั้งระบบ',
      description: 'ความสำคัญของเวลาที่ตรงกัน, stratum hierarchy และการตั้ง NTP client/server บน VyOS',
      order: 1,
      objectives: [
        'อธิบายว่าทำไมเวลาที่ตรงกันจึงสำคัญต่อ log, certificate และการยืนยันตัวตน',
        'อธิบายแนวคิด stratum และลำดับชั้นของแหล่งเวลา',
        'ตั้ง NTP server และ client บน VyOS',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'ทำไมเวลาต้องตรง และ Stratum Hierarchy',
          order: 0,
          estMinutes: 11,
          sections: [
            {
              heading: 'เวลาเพี้ยน = ปัญหาลูกโซ่',
              body: [
                'นาฬิกาของอุปกรณ์แต่ละตัวไหลไม่เท่ากัน ถ้าไม่ sync จะเพี้ยนเรื่อย ๆ และก่อปัญหาใหญ่กว่าที่คิด:',
                '',
                '- **Log/ไล่เหตุการณ์** — ถ้า log แต่ละเครื่องเวลาไม่ตรง การปะติดปะต่อเหตุการณ์ตอนสอบสวนเหตุจะมั่วทันที',
                '- **Certificate/TLS** — ใบรับรองมีวันหมดอายุ เวลาเพี้ยนทำให้ตรวจ valid/expired ผิด',
                '- **การยืนยันตัวตน (Kerberos)** — ทนเวลาคลาดเคลื่อนได้แค่ไม่กี่นาที เพี้ยนเกินก็ล็อกอินไม่ได้',
                '',
                '**NTP (Network Time Protocol)** จึงทำหน้าที่ sync นาฬิกาทุกเครื่องให้ตรงกับแหล่งเวลาที่เชื่อถือได้',
              ].join('\n'),
            },
            {
              heading: 'Stratum: ชั้นของความน่าเชื่อถือ',
              body: [
                'NTP จัดแหล่งเวลาเป็นชั้น **stratum** ตามระยะห่างจากนาฬิกาอ้างอิงจริง:',
                '',
                '- **Stratum 0** — นาฬิกาอ้างอิง (atomic clock, GPS) ไม่ได้ต่อเน็ตโดยตรง',
                '- **Stratum 1** — เซิร์ฟเวอร์ที่ต่อกับ stratum 0 ตรง ๆ (แม่นที่สุดบนเน็ต)',
                '- **Stratum 2, 3, …** — sync ต่อ ๆ กันลงมา ยิ่งเลขมากยิ่งห่างต้นทาง',
                '',
                'เลข stratum เพิ่มทีละหนึ่งเมื่อไกลออกจากต้นทาง (สูงสุด 15; 16 = ใช้ไม่ได้) ในองค์กรมักมีเราเตอร์/เซิร์ฟเวอร์ไม่กี่ตัว sync กับ NTP สาธารณะ แล้วเป็นแหล่งเวลาให้อุปกรณ์ภายในที่เหลือต่อ',
              ].join('\n'),
            },
            {
              heading: 'NTP บน VyOS',
              body: [
                'VyOS sync เวลากับ upstream ด้วย `set service ntp server <addr>` และทำตัวเป็นแหล่งเวลาให้เครื่องอื่นด้วย `set service ntp allow-client`:',
                '',
                '```',
                '# ฝั่ง server (ให้บริการเวลาแก่วง LAN)',
                'set service ntp allow-client address 10.0.12.0/24',
                'set service ntp listen-address 10.0.12.2',
                '',
                '# ฝั่ง client (ขอเวลาจาก server ภายใน)',
                'set service ntp server 10.0.12.2',
                '```',
                '',
                'ตรวจสถานะแหล่งเวลาด้วย `show ntp` (จะเห็นรายการ source ที่กำลัง sync) — การ sync จริงใช้เวลาสักครู่หลัง config',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — NTP Client และ Server',
          order: 1,
          estMinutes: 25,
          description: 'ตั้ง R2 เป็นแหล่งเวลา (NTP server) ให้วง และ R1 เป็น client ที่ขอเวลาจาก R2 แล้วตรวจว่า client อ้างอิงแหล่งเวลาที่ถูกต้องและลิงก์ถึงกันจริง',
          scenario: {
            from: 'พี่ปอนด์ Security Officer',
            priority: 'medium',
            body: 'ตอนสอบสวนเหตุครั้งล่าสุด log จากเราเตอร์แต่ละตัวเวลาไม่ตรงกันเลย ต่างกันเป็นนาที ทำให้ปะติดปะต่อเหตุการณ์แทบไม่ได้ — ออดิทสั่งว่าทุกอุปกรณ์ต้อง sync เวลาจากแหล่งกลางเดียวกัน ฝากตั้งให้เราเตอร์ตัวหนึ่งเป็นแหล่งเวลาของวง แล้วให้อีกตัวขอเวลาจากมัน เป็นต้นแบบก่อนขยายทั้งระบบ',
          },
          objectives: [
            'ตั้ง R2 ให้เป็น NTP server ที่อนุญาตให้วง 10.0.12.0/24 ขอเวลาได้',
            'ตั้ง R1 ให้เป็น NTP client ที่ขอเวลาจาก R2 (10.0.12.2)',
            'ยืนยันว่า R1 อ้างอิง R2 เป็นแหล่งเวลาและลิงก์ถึงกัน',
          ],
          hints: [
            'โครงสร้าง: R1(eth1=10.0.12.1/24) — R2(eth1=10.0.12.2/24) — ตรวจ `ping 10.0.12.2` ให้ผ่านก่อน',
            'R2 (server): `set service ntp allow-client address 10.0.12.0/24` · `set service ntp listen-address 10.0.12.2`',
            'R1 (client): `set service ntp server 10.0.12.2`',
            'commit แล้วบน R1 ดู `show ntp` จะเห็น 10.0.12.2 อยู่ในรายการ source (การ sync ให้เวลาตรงจริงใช้เวลาสักครู่)',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 (client) ตั้งค่าขอเวลาจาก R2', node: 'R1', command: 'show configuration commands | match "service ntp server"', expect: '10\\.0\\.12\\.2', points: 4,
              failHint: 'R1 ยังไม่ได้ชี้ไปแหล่งเวลา — `set service ntp server 10.0.12.2` (ค่าเริ่มต้นของ VyOS มักมี pool สาธารณะอยู่ ให้เพิ่ม server ภายในนี้เข้าไป)' },
            { description: 'R2 (server) อนุญาตให้ client ในวงขอเวลา', node: 'R2', command: 'show configuration commands | match "ntp allow-client"', expect: 'allow-client', points: 3,
              failHint: 'R2 ยังไม่เปิดเป็นแหล่งเวลา — `set service ntp allow-client address 10.0.12.0/24` ไม่งั้น client จะถูกปฏิเสธ' },
            { description: 'R1 ถึง R2 ได้ (เส้นทางสำหรับ NTP)', node: 'R1', command: 'ping 10.0.12.2 count 3', expect: 'bytes from 10\\.0\\.12\\.2', points: 3,
              failHint: 'NTP ต้องมีเส้นทางถึง server ก่อน — ถ้า ping ไม่ผ่าน เช็ค IP/สาย eth1 ทั้งสองฝั่งให้อยู่วง 10.0.12.0/24' },
          ],
        },
      ],
    },

    // ── โมดูล 3 — SNMP ──────────────────────────────────────────────────
    {
      title: 'โมดูล 3 — SNMP และการมอนิเตอร์',
      description: 'manager/agent, MIB/OID, community string (v2c) เทียบกับความปลอดภัยของ v3 และ polling/trap',
      order: 2,
      objectives: [
        'อธิบายบทบาท manager กับ agent และโครงสร้าง MIB/OID',
        'แยกความต่างด้านความปลอดภัยของ SNMP v2c กับ v3',
        'แยกความต่างระหว่าง polling กับ trap',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'SNMP: Manager/Agent, MIB/OID และ v2c เทียบ v3',
          order: 0,
          estMinutes: 12,
          sections: [
            {
              heading: 'โมเดล Manager–Agent',
              body: [
                '**SNMP (Simple Network Management Protocol)** ให้เรามอนิเตอร์และจัดการอุปกรณ์จากศูนย์กลาง:',
                '',
                '- **Manager (NMS)** — ระบบกลางที่เก็บ/แสดงผล (เช่น Zabbix, PRTG, LibreNMS)',
                '- **Agent** — ซอฟต์แวร์บนอุปกรณ์ที่ตอบคำถามและส่งแจ้งเตือน',
                '',
                'ข้อมูลที่ถามได้ถูกจัดเป็นต้นไม้ชื่อ **MIB (Management Information Base)** แต่ละค่ามีที่อยู่เป็นตัวเลขเรียก **OID (Object Identifier)** เช่น OID ของ sysUpTime ที่บอกว่าอุปกรณ์เปิดมานานแค่ไหน',
              ].join('\n'),
            },
            {
              heading: 'Polling เทียบ Trap',
              body: [
                '- **Polling** — manager "ถาม" agent เป็นรอบ ๆ (เช่นทุก 5 นาที): ตอนนี้ CPU เท่าไร, อินเทอร์เฟซ up ไหม',
                '- **Trap** — agent "บอกเอง" ทันทีเมื่อเกิดเหตุ (เช่นลิงก์ down) โดยไม่ต้องรอให้ถาม',
                '',
                'ทั้งสองเสริมกัน: polling เก็บแนวโน้มระยะยาว ส่วน trap แจ้งเหตุด่วนแบบเรียลไทม์',
              ].join('\n'),
            },
            {
              heading: 'v2c เทียบ v3: ความปลอดภัย',
              body: [
                '- **SNMP v2c** — ยืนยันตัวตนด้วย **community string** (คล้ายรหัสผ่านร่วม) ที่ส่งแบบ **plaintext** ใครดักได้ก็อ่านได้ — ปลอดภัยต่ำ ควรใช้เฉพาะวงจัดการที่แยกออกมา',
                '- **SNMP v3** — เพิ่ม **authentication** (ยืนยันว่าใครส่ง) และ **privacy/encryption** (เข้ารหัสข้อมูล) ระดับความปลอดภัยกำหนดได้สามแบบ: noAuthNoPriv, authNoPriv, authPriv (แนะนำ)',
                '',
                'บน VyOS: v2c ใช้ `set service snmp community <name>` ส่วน v3 ใช้ `set service snmp v3 user <name> ...` กำหนด auth/privacy',
                '',
                '> หลัก least privilege: ตั้ง community/user แบบ **read-only** ไว้ก่อน เปิด write เฉพาะเมื่อจำเป็นจริง ๆ',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — SNMP',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'ในโมเดล SNMP ซอฟต์แวร์บนอุปกรณ์ที่ตอบคำถามและส่งแจ้งเตือนเรียกว่าอะไร',
              choices: ['Manager (NMS)', 'Agent', 'Collector', 'Resolver'],
              answer: [1],
              explanation: 'Agent อยู่บนอุปกรณ์ที่ถูกมอนิเตอร์ ส่วน Manager (NMS) คือระบบกลาง',
              points: 1,
            },
            {
              prompt: 'ข้อใดคือข้อด้อยด้านความปลอดภัยหลักของ SNMP v2c',
              choices: [
                'ช้ากว่า v3 มาก',
                'community string ส่งแบบ plaintext ไม่เข้ารหัส',
                'ไม่รองรับ polling',
                'ใช้ได้กับ IPv6 เท่านั้น',
              ],
              answer: [1],
              explanation: 'v2c ยืนยันตัวตนด้วย community string ที่ส่งเป็น plaintext ส่วน v3 เพิ่ม authentication + encryption',
              points: 1,
            },
            {
              prompt: 'การที่ agent "บอกเหตุการณ์เอง" ทันทีเมื่อเกิดเหตุ (เช่นลิงก์ down) โดยไม่รอให้ถามคืออะไร',
              choices: ['Polling', 'Trap', 'Walk', 'Recursive query'],
              answer: [1],
              explanation: 'Trap คือการที่ agent ส่งแจ้งเตือนเองทันที ส่วน polling คือ manager ถามเป็นรอบ ๆ',
              points: 1,
            },
            {
              prompt: 'ที่อยู่แบบตัวเลขที่ใช้ชี้ค่าหนึ่ง ๆ ในต้นไม้ MIB เรียกว่าอะไร',
              choices: ['OID (Object Identifier)', 'URL', 'MAC address', 'Community'],
              answer: [0],
              explanation: 'OID คือที่อยู่ของ object ในต้นไม้ MIB เช่น sysUpTime',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 4 — Syslog ────────────────────────────────────────────────
    {
      title: 'โมดูล 4 — Syslog และการเก็บ Log รวมศูนย์',
      description: 'ระดับความรุนแรง (severity), facility และเหตุผลของการรวม log ไว้ที่ศูนย์กลาง',
      order: 3,
      objectives: [
        'อธิบายระดับความรุนแรงของ syslog (0–7) และความหมาย',
        'อธิบายเหตุผลของการส่ง log ไปเก็บที่ collector กลาง',
        'อธิบายว่า facility และ severity ใช้กรอง log อย่างไร',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Severity Levels, Facility และ Centralized Logging',
          order: 0,
          estMinutes: 11,
          sections: [
            {
              heading: 'ทำไมต้องรวม Log ไว้ที่เดียว',
              body: [
                'log ที่เก็บไว้ในเครื่องแต่ละตัวมีปัญหา: พื้นที่จำกัด (log เก่าถูกทับ), ถ้าเครื่องพังหรือถูกแฮ็ก log ก็หายไปด้วย และการไล่ดูทีละเครื่องตอนเกิดเหตุช้ามาก',
                '',
                '**Centralized logging (syslog server)** แก้ทั้งหมด: อุปกรณ์ทุกตัวส่ง log ไปเก็บที่ collector กลาง ทำให้ค้นข้ามอุปกรณ์ได้ที่เดียว, เก็บได้นาน, และ log ปลอดภัยแม้ต้นทางถูกบุกรุก',
              ].join('\n'),
            },
            {
              heading: 'Severity Levels 0–7',
              body: [
                'syslog จัดความรุนแรงเป็น 8 ระดับ (จำง่าย ๆ: ยิ่งเลขน้อยยิ่งร้ายแรง)',
                '',
                '| ระดับ | ชื่อ | ความหมาย |',
                '|---|---|---|',
                '| 0 | Emergency | ระบบใช้ไม่ได้ |',
                '| 1 | Alert | ต้องแก้ทันที |',
                '| 2 | Critical | วิกฤต |',
                '| 3 | Error | ข้อผิดพลาด |',
                '| 4 | Warning | คำเตือน |',
                '| 5 | Notice | ปกติแต่ควรสังเกต |',
                '| 6 | Informational | ข้อมูลทั่วไป |',
                '| 7 | Debug | ละเอียดสำหรับดีบัก |',
                '',
                'การตั้ง level ที่ collector หมายถึง "เก็บระดับนี้ขึ้นไป (รุนแรงกว่าหรือเท่ากัน)" เช่นตั้ง warning (4) จะเก็บ 0–4 แต่ทิ้ง notice/info/debug — ช่วยลด log ขยะ',
              ].join('\n'),
            },
            {
              heading: 'Facility และ Syslog บน VyOS',
              body: [
                '**Facility** บอกว่า log มาจากระบบส่วนไหน (เช่น auth, kern, daemon, local0–7) ใช้จัดหมวดและกรอง log ที่ปลายทาง',
                '',
                'บน VyOS ส่ง log ไป collector กลางด้วย:',
                '',
                '```',
                'set system syslog remote 10.0.12.2 facility all level warning',
                '```',
                '',
                '> มี syslog lab แบบลงมือทำอยู่แล้วในคอร์ส Enterprise Core Networking (ccnp-core) — โมดูลนี้เน้นแนวคิด severity/facility ที่ออกสอบ CCNA และต่อยอดสู่การออกแบบ centralized logging',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — Syslog',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'syslog severity level ใดรุนแรงที่สุด',
              choices: ['0 — Emergency', '7 — Debug', '4 — Warning', '5 — Notice'],
              answer: [0],
              explanation: 'ยิ่งเลขน้อยยิ่งรุนแรง — 0 (Emergency) คือระบบใช้ไม่ได้ ส่วน 7 (Debug) ละเอียดสุดแต่ไม่รุนแรง',
              points: 1,
            },
            {
              prompt: 'ถ้าตั้ง syslog ให้เก็บที่ระดับ warning (4) ข้อใดถูกต้อง',
              choices: [
                'เก็บเฉพาะ warning (4) เท่านั้น',
                'เก็บระดับ 0–4 (รุนแรงกว่าหรือเท่ากับ warning)',
                'เก็บระดับ 4–7',
                'เก็บทุกระดับ',
              ],
              answer: [1],
              explanation: 'ตั้ง level หมายถึงเก็บระดับนั้นขึ้นไป (รุนแรงกว่า) คือ 0–4 และทิ้ง notice/info/debug',
              points: 1,
            },
            {
              prompt: 'เหตุผลหลักของการส่ง log ไปเก็บที่ collector กลางคือข้อใด',
              choices: [
                'ทำให้อุปกรณ์ทำงานเร็วขึ้น',
                'ค้นข้ามอุปกรณ์ได้ที่เดียว เก็บได้นาน และ log รอดแม้ต้นทางถูกบุกรุก',
                'ลดการใช้แบนด์วิดท์',
                'แทนที่ NTP ได้',
              ],
              answer: [1],
              explanation: 'centralized logging รวม log ไว้ที่เดียว ค้นง่าย เก็บนาน และปลอดภัยกว่าการเก็บในเครื่องที่อาจถูกลบ',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 5 — QoS ───────────────────────────────────────────────────
    {
      title: 'โมดูล 5 — QoS: จัดลำดับความสำคัญทราฟฟิก',
      description: 'classification, marking (DSCP), queuing และความต่างของ policing กับ shaping พร้อมลงมือทำ traffic-policy บน VyOS',
      order: 4,
      objectives: [
        'อธิบายขั้นตอนของ QoS: classification → marking → queuing',
        'แยกความต่างระหว่าง policing กับ shaping',
        'สร้างและผูก traffic-policy (shaper) บน interface ของ VyOS',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Classification, Marking, Queuing และ Policing/Shaping',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'ทำไมต้องมี QoS',
              body: [
                'แบนด์วิดท์มีจำกัด เมื่อลิงก์เริ่มแน่น (congestion) ทราฟฟิกทุกชนิดแย่งกัน — เสียงพูด (VoIP) และวิดีโอคอลที่ "รอไม่ได้" จะกระตุกทันทีถ้าไปแย่งคิวกับการดาวน์โหลดไฟล์ใหญ่',
                '',
                '**QoS (Quality of Service)** คือการจัดลำดับความสำคัญ ให้ทราฟฟิกสำคัญ (เสียง/วิดีโอ/ระบบธุรกิจ) ได้คิวก่อนและการันตีแบนด์วิดท์ ส่วนทราฟฟิกที่รอได้ (อัปเดต, backup) ยอมให้ช้าลงเมื่อจำเป็น',
              ].join('\n'),
            },
            {
              heading: 'สามขั้นของ QoS',
              body: [
                '1. **Classification (จำแนก)** — ระบุว่าแพ็กเก็ตเป็นทราฟฟิกชนิดใด (จาก port, protocol, source/dest หรือค่า marking เดิม)',
                '2. **Marking (ติดป้าย)** — เขียนค่าความสำคัญลงบน header เพื่อให้อุปกรณ์ถัดไปไม่ต้องจำแนกซ้ำ ค่าที่ใช้บ่อยคือ **DSCP** (6 บิตใน IP header เช่น EF สำหรับเสียง, AF สำหรับวิดีโอ/ข้อมูล)',
                '3. **Queuing & Scheduling (จัดคิว)** — แยกทราฟฟิกลงหลายคิวตาม marking แล้วเลือกส่งตามนโยบาย (เช่น priority queue ให้เสียงไปก่อนเสมอ)',
                '',
                '> หลักการ: จำแนกและ mark ให้ใกล้ต้นทางที่สุด (ที่ขอบเครือข่าย) แล้วอุปกรณ์ที่เหลือแค่ "เชื่อ marking" และจัดคิวตาม',
              ].join('\n'),
            },
            {
              heading: 'Policing เทียบ Shaping และ traffic-policy บน VyOS',
              body: [
                'สองวิธีคุมอัตราเมื่อทราฟฟิกเกินที่กำหนด:',
                '',
                '- **Policing** — เกินแล้ว **ทิ้ง** (หรือ re-mark) ทันที ไม่หน่วง เหมาะกับการบังคับเพดานแข็ง ๆ แต่ทำให้เกิด drop',
                '- **Shaping** — เกินแล้ว **หน่วงไว้ในบัฟเฟอร์** แล้วทยอยปล่อยให้เรียบ ลด drop แต่เพิ่ม delay เหมาะกับขาออกสู่ WAN',
                '',
                'บน VyOS ใช้ **traffic-policy** แล้วผูกเข้า interface:',
                '',
                '```',
                'set qos policy shaper WAN-OUT bandwidth 10mbit',
                'set qos policy shaper WAN-OUT default bandwidth 50%',
                'set qos policy shaper WAN-OUT class 10 match VOICE ip dscp EF',
                'set qos policy shaper WAN-OUT class 10 bandwidth 30%',
                'set qos policy shaper WAN-OUT class 10 priority',
                'set qos interface eth1 egress WAN-OUT',
                '```',
                '',
                '> traffic-policy มีผลกับทิศ **out** ของ interface — แล็บถัดไปจะสร้าง shaper และผูกเข้า eth1',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — Traffic Shaping ด้วย traffic-policy',
          order: 1,
          estMinutes: 30,
          description: 'สร้าง traffic-policy แบบ shaper ที่จองแบนด์วิดท์ให้คลาสเสียง (VoIP/DSCP EF) แล้วผูกเข้ากับ interface ขาออก WAN ของ R1 โดยการส่งต่อทราฟฟิกยังต้องทำงานปกติ',
          scenario: {
            from: 'คุณเจน ผู้จัดการสาขาใหม่',
            priority: 'high',
            body: 'ทุกครั้งที่มีคนในออฟฟิศดาวน์โหลดไฟล์ใหญ่ สายโทรศัพท์ผ่านเน็ต (VoIP) จะกระตุกจนคุยกับลูกค้าไม่รู้เรื่องเลยค่ะ ลิงก์ออก WAN เรามีจำกัด ฝากตั้งระบบจัดลำดับความสำคัญให้เสียงได้แบนด์วิดท์การันตีก่อนใคร ส่วนการดาวน์โหลดยอมให้ช้าลงได้ตอนสายแน่น ขอด่วนเลยนะคะ ลูกค้าเริ่มบ่น',
          },
          objectives: [
            'สร้าง traffic-policy shaper ที่กำหนดแบนด์วิดท์รวมและคลาสสำหรับทราฟฟิกเสียง (DSCP EF)',
            'ผูก traffic-policy เข้ากับ interface ขาออก (out) ของ R1',
            'ยืนยันว่าการส่งต่อทราฟฟิกยังทำงานปกติหลังผูก policy',
          ],
          hints: [
            'โครงสร้าง: R1(eth1=10.0.12.1/24) — R2(eth1=10.0.12.2/24) โดย eth1 ของ R1 คือขาออก WAN',
            'สร้าง shaper: `set qos policy shaper WAN-OUT bandwidth 10mbit` · `set qos policy shaper WAN-OUT default bandwidth 50%`',
            'คลาสเสียง: `set qos policy shaper WAN-OUT class 10 match VOICE ip dscp EF` · `set qos policy shaper WAN-OUT class 10 bandwidth 30%` · `set qos policy shaper WAN-OUT class 10 priority`',
            'ผูกเข้า interface: `set qos interface eth1 egress WAN-OUT` แล้ว commit · ทดสอบ `ping 10.0.12.2` ต้องยังผ่าน (QoS ไม่ควรตัดการส่งต่อปกติ)',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 สร้าง qos policy แบบ shaper', node: 'R1', command: 'show configuration commands | match "qos policy shaper"', expect: 'shaper', points: 3,
              failHint: 'ยังไม่มี shaper — `set qos policy shaper WAN-OUT bandwidth 10mbit` พร้อม default bandwidth และคลาสสำหรับเสียง (match ... ip dscp EF)' },
            { description: 'R1 ผูก qos policy เข้ากับ interface ขาออก', node: 'R1', command: 'show configuration commands | match "qos interface"', expect: 'qos interface', points: 4,
              failHint: 'policy ลอยอยู่เฉย ๆ — ต้องผูกเข้า interface ทิศ egress: `set qos interface eth1 egress WAN-OUT` กฎถึงจะมีผลกับทราฟฟิกขาออกจริง' },
            { description: 'R1 ยังส่งต่อทราฟฟิกได้ (ping ผ่าน policy)', node: 'R1', command: 'ping 10.0.12.2 count 3', expect: 'bytes from 10\\.0\\.12\\.2', points: 3,
              failHint: 'ping ไม่ผ่านหลังผูก policy — shaper ที่ตั้งผิด (เช่น default bandwidth เป็น 0 หรือไม่มี default class) อาจหน่วง/ทิ้งทราฟฟิกหมด ตรวจว่ามี default bandwidth และ commit สำเร็จไม่มี error' },
          ],
        },
      ],
    },
  ],
};
