// Network Security Fundamentals — ความปลอดภัยเครือข่ายเบื้องต้น
//
// ปิด gap ที่ใหญ่ที่สุดของหลักสูตร: Security Fundamentals = 15% ของ CCNA 200-301
// และ 20% ของ CCNP ENCOR 350-401 — ทั้งสองคอร์สเดิมแตะแค่ ACL/SSH ผิว ๆ
// คอร์สนี้ลงลึก firewall แบบ stateful/zone, IPsec + WireGuard VPN, Layer 2
// security และ management-plane hardening
//
// ทุกแล็บรันบน VyOS Universal Router (โอเพนซอร์ส แทน Cisco IOS ที่ติดลิขสิทธิ์)
// คำสั่งตัวอย่างอ้างอิงไวยากรณ์ VyOS 1.4+/1.5 — การให้คะแนนเน้น "ผลลัพธ์เชิง
// ฟังก์ชัน" (ping ผ่าน tunnel ได้, SA ขึ้น up, ทราฟฟิกที่อนุญาตวิ่งได้) จึงไม่
// ผูกกับไวยากรณ์ที่ต่างกันระหว่างเวอร์ชัน

import { vyos, pc } from './_vyos.js';

export default {
  slug: 'network-security',
  title: 'Network Security Fundamentals',
  description: 'ความปลอดภัยเครือข่ายตั้งแต่หลักการจนถึงลงมือทำจริง: CIA Triad, stateful/zone-based firewall, IPsec และ WireGuard site-to-site VPN, Layer 2 security (DHCP snooping/DAI) และการทำ hardening ระนาบจัดการ ครอบคลุมหัวข้อ Security Fundamentals ที่เป็น 15% ของ CCNA และ 20% ของ CCNP — เป็นทักษะที่ตลาดแรงงานไทยขาดแคลนมากที่สุด',
  level: 'intermediate',
  track: 'Security',
  estimatedHours: 12,
  prerequisites: ['ผ่าน Introduction to Networks (ccna-intro) หรือเทียบเท่า', 'ใช้ VyOS CLI พื้นฐานได้ (set/commit/show) และเข้าใจ routing/subnetting'],
  published: true,
  modules: [
    // ── โมดูล 1 — หลักการความปลอดภัย ────────────────────────────────────
    {
      title: 'โมดูล 1 — หลักการความปลอดภัยเครือข่าย',
      description: 'รากฐานความคิดด้านความปลอดภัย: CIA Triad, defense-in-depth และภูมิทัศน์ภัยคุกคาม',
      order: 0,
      objectives: [
        'อธิบายเสาหลักสามต้นของความปลอดภัย (Confidentiality, Integrity, Availability)',
        'อธิบายแนวคิด defense-in-depth และ least privilege',
        'จำแนกภัยคุกคามที่พบบ่อยและมาตรการรับมือเชิงชั้น',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'CIA Triad, Defense-in-Depth และภัยคุกคาม',
          order: 0,
          estMinutes: 14,
          sections: [
            {
              heading: 'เสาหลักสามต้น: CIA Triad',
              body: [
                'ทุกการตัดสินใจด้านความปลอดภัยวัดได้ด้วยสามเสาหลักนี้:',
                '',
                '- **Confidentiality (ความลับ)** — ข้อมูลถูกเปิดเผยเฉพาะผู้มีสิทธิ์ เครื่องมือ: การเข้ารหัส (VPN/TLS), การควบคุมการเข้าถึง',
                '- **Integrity (ความถูกต้อง)** — ข้อมูลไม่ถูกแก้ไขโดยไม่ได้รับอนุญาต เครื่องมือ: hash, digital signature, checksum',
                '- **Availability (ความพร้อมใช้งาน)** — ระบบใช้งานได้เมื่อต้องการ เครื่องมือ: redundancy, การป้องกัน DoS, การสำรองข้อมูล',
                '',
                '> การโจมตีหนึ่งครั้งมักกระทบมากกว่าหนึ่งเสา เช่น ransomware ทำลายทั้ง availability (เข้าระบบไม่ได้) และ confidentiality (ข้อมูลรั่ว)',
              ].join('\n'),
            },
            {
              heading: 'Defense-in-Depth และ Least Privilege',
              body: [
                '**Defense-in-depth** คือการวางการป้องกันหลายชั้นซ้อนกัน เพื่อให้การเจาะชั้นหนึ่งไม่ทำให้ทั้งระบบล่ม:',
                '',
                '- ขอบเครือข่าย — firewall, IPS',
                '- ภายใน — การแบ่ง segment/VLAN, zone-based firewall',
                '- อุปกรณ์ปลายทาง — antivirus, patching',
                '- ข้อมูล — การเข้ารหัสขณะส่ง (VPN) และขณะพัก',
                '',
                '**Least privilege (สิทธิ์น้อยที่สุด)** — ให้สิทธิ์เท่าที่จำเป็นต่อหน้าที่เท่านั้น เป็นหลักคิดเบื้องหลัง ACL, firewall ruleset และ AAA ทั้งหมด — "default deny แล้วค่อยเปิดเฉพาะที่ต้อง" เสมอปลอดภัยกว่า "default allow แล้วค่อยปิดทีละอย่าง"',
              ].join('\n'),
            },
            {
              heading: 'ภูมิทัศน์ภัยคุกคามที่ต้องรู้จัก',
              body: [
                '| ภัยคุกคาม | เสาที่กระทบ | มาตรการรับมือในคอร์สนี้ |',
                '|---|---|---|',
                '| ดักจับทราฟฟิก (sniffing) | Confidentiality | เข้ารหัสด้วย IPsec / WireGuard VPN |',
                '| Man-in-the-Middle | Confidentiality/Integrity | VPN + การยืนยันตัวตน |',
                '| การเข้าถึงโดยไม่ได้รับอนุญาต | ทุกเสา | firewall, ACL, AAA, SSH hardening |',
                '| ARP poisoning / DHCP spoofing | Integrity | DHCP snooping + DAI (โมดูล 5) |',
                '| DoS / DDoS | Availability | rate-limit, การกรองขอบ |',
                '',
                'คอร์สนี้จะลงมือสร้างมาตรการเหล่านี้บน VyOS จริงในโมดูลถัด ๆ ไป',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — หลักการความปลอดภัย',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'การเข้ารหัสทราฟฟิกด้วย VPN ปกป้องเสาหลักใดของ CIA Triad เป็นหลัก',
              choices: ['Availability', 'Confidentiality', 'Integrity', 'Authentication'],
              answer: [1],
              explanation: 'การเข้ารหัสทำให้ผู้ดักจับอ่านข้อมูลไม่ได้ จึงปกป้อง Confidentiality (ความลับ) เป็นหลัก',
              points: 1,
            },
            {
              prompt: 'หลักการ "default deny แล้วค่อยเปิดเฉพาะที่จำเป็น" สะท้อนแนวคิดใด',
              choices: ['High availability', 'Least privilege', 'Redundancy', 'Load balancing'],
              answer: [1],
              explanation: 'การให้สิทธิ์เท่าที่จำเป็นคือ least privilege — เป็นหลักคิดเบื้องหลัง firewall และ ACL ทั้งหมด',
              points: 1,
            },
            {
              prompt: 'การวางการป้องกันหลายชั้นซ้อนกัน (ขอบ → ภายใน → ปลายทาง → ข้อมูล) เรียกว่าอะไร',
              choices: ['Single point of defense', 'Defense-in-depth', 'Flat network', 'Trust-all model'],
              answer: [1],
              explanation: 'Defense-in-depth ทำให้การเจาะชั้นเดียวไม่ล้มทั้งระบบ',
              points: 1,
            },
            {
              prompt: 'ransomware ที่ล็อกไฟล์จนเข้าระบบไม่ได้ กระทบเสาหลักใดมากที่สุด',
              choices: ['Confidentiality เท่านั้น', 'Availability', 'Integrity เท่านั้น', 'ไม่กระทบ CIA'],
              answer: [1],
              explanation: 'เมื่อใช้งานระบบไม่ได้ คือการกระทบ Availability (มักกระทบ Confidentiality ด้วยถ้ามีการขโมยข้อมูล)',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 2 — Firewall: Stateful Inspection & Zones ─────────────────
    {
      title: 'โมดูล 2 — Firewall: Stateful Inspection และ Zone-Based',
      description: 'ความต่างของ stateless กับ stateful และการแบ่งโซนความน่าเชื่อถือด้วย zone-based firewall บน VyOS',
      order: 1,
      objectives: [
        'อธิบายความต่างระหว่าง stateless กับ stateful firewall',
        'อธิบายแนวคิด security zone และทิศทางของทราฟฟิก',
        'ตั้งค่า zone-based firewall บน VyOS ให้ LAN เริ่มต้นออก WAN ได้ และทราฟฟิกขากลับผ่านด้วยสถานะ',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Stateful Inspection และ Security Zones',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'Stateless เทียบกับ Stateful',
              body: [
                '- **Stateless firewall** — ตัดสินทีละแพ็กเก็ตจาก header (src/dst IP, port, protocol) โดยไม่จำว่าก่อนหน้าเกิดอะไร เร็วแต่หยาบ ต้องเขียนกฎทั้ง "ขาไป" และ "ขากลับ" เอง',
                '- **Stateful firewall** — จดจำ session ที่กำลังเปิดอยู่ใน **state table** เมื่ออนุญาตขาออกแล้ว ทราฟฟิกขากลับของ session เดิมจะถูกปล่อยอัตโนมัติ (state = established/related)',
                '',
                'บน VyOS การปล่อยทราฟฟิกขากลับทำด้วยกฎ `state established` และ `state related` — นี่คือหัวใจที่ทำให้ "เปิดทางออกอย่างเดียว แต่ตอบกลับได้" โดยไม่ต้องเปิดทางเข้าทั้งหมด',
              ].join('\n'),
            },
            {
              heading: 'Security Zones คืออะไร',
              body: [
                'แทนที่จะเขียนกฎต่อ interface ทีละตัว เราจัดกลุ่ม interface ที่มีความน่าเชื่อถือใกล้กันเป็น **zone** แล้วเขียนนโยบาย "จากโซนหนึ่งไปอีกโซนหนึ่ง":',
                '',
                '- **LAN zone** — เครือข่ายภายใน เชื่อถือสูง',
                '- **WAN zone** — อินเทอร์เน็ต เชื่อถือต่ำสุด',
                '- **DMZ zone** — เซิร์ฟเวอร์ที่เปิดสู่ภายนอก เชื่อถือปานกลาง',
                '',
                'นโยบายทั่วไป: LAN → WAN เปิด, WAN → LAN ปิด (ยกเว้น state ขากลับ), WAN → DMZ เปิดเฉพาะพอร์ตบริการ',
                '',
                '> แนวคิด zone ทำให้กฎอ่านง่ายและขยายได้ — เพิ่ม interface เข้าโซนเดิมก็ได้นโยบายเดิมทันที',
              ].join('\n'),
            },
            {
              heading: 'โครงสร้างคำสั่ง Zone บน VyOS (1.4+)',
              body: [
                'ขั้นตอนคิดเป็นสามส่วน: (1) สร้าง ruleset, (2) ประกาศ zone + ผูก interface, (3) ผูก ruleset เข้ากับคู่ทิศทางของโซน',
                '',
                '```',
                '# 1) ruleset ที่อนุญาตให้ "เริ่ม session ใหม่ + ทราฟฟิกที่ตอบกลับ" ผ่าน',
                'set firewall ipv4 name LAN-WAN default-action drop',
                'set firewall ipv4 name LAN-WAN rule 10 action accept',
                'set firewall ipv4 name LAN-WAN rule 10 state new enable',
                '# ruleset ขากลับ: ปล่อยเฉพาะ session ที่เปิดไว้แล้ว',
                'set firewall ipv4 name WAN-LAN default-action drop',
                'set firewall ipv4 name WAN-LAN rule 10 action accept',
                'set firewall ipv4 name WAN-LAN rule 10 state established enable',
                'set firewall ipv4 name WAN-LAN rule 10 state related enable',
                '',
                '# 2) ประกาศโซนและผูก interface',
                'set firewall zone LAN interface eth1',
                'set firewall zone WAN interface eth2',
                'set firewall zone LAN default-action drop',
                'set firewall zone WAN default-action drop',
                '',
                '# 3) ผูก ruleset เข้ากับทิศทาง (โซนปลายทาง from โซนต้นทาง)',
                'set firewall zone WAN from LAN firewall name LAN-WAN',
                'set firewall zone LAN from WAN firewall name WAN-LAN',
                '```',
                '',
                '> ไวยากรณ์ firewall ของ VyOS เปลี่ยนข้ามเวอร์ชันพอควร — แล็บให้คะแนนที่ "ผลลัพธ์" (ทราฟฟิกที่อนุญาตวิ่งได้จริง) ไม่ผูกกับสตริงคำสั่งเป๊ะ ๆ',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — Zone-Based Firewall (Stateful)',
          order: 1,
          estMinutes: 35,
          description: 'แบ่งเครือข่ายเป็นโซน LAN และ WAN บน VyOS ให้ฝั่ง LAN เริ่ม session ออกไป WAN ได้ และทราฟฟิกขากลับผ่านได้ด้วยสถานะ (stateful) โดยไม่ต้องเปิดทางเข้าทั้งหมด',
          scenario: {
            from: 'พี่ปอนด์ Security Officer',
            priority: 'high',
            body: 'router ตัวนี้คั่นระหว่างวงออฟฟิศกับลิงก์ขาออก ตอนนี้มันเปิดโล่งทั้งสองทาง ใครจากนอกก็ยิงเข้ามาวงในได้ตรง ๆ — ออดิทจับได้แล้ว นโยบายคือ "วงในออกไปข้างนอกได้ตามปกติ แต่ข้างนอกห้ามเริ่มต่อเข้าวงในเอง" ฝากทำเป็น zone-based firewall แบบ stateful ให้ที ของที่เราขอออกไปต้องตอบกลับเข้ามาได้ แต่คนนอกเปิดวงเข้ามาเองไม่ได้',
          },
          objectives: [
            'ประกาศโซน LAN (eth1) และ WAN (eth2) บน R1',
            'อนุญาตให้ LAN เริ่ม session ออก WAN และให้ทราฟฟิกขากลับผ่านด้วย state established/related',
            'พิสูจน์ว่า PC1 (LAN) ping PC2 (WAN) ได้ผ่านนโยบาย stateful',
          ],
          hints: [
            'โครงสร้าง: PC1(192.168.1.10, gw .1) — R1(eth1=192.168.1.1/24, eth2=203.0.113.1/24) — PC2(203.0.113.10, gw .1)',
            'สร้าง ruleset ขาออก: `set firewall ipv4 name LAN-WAN default-action drop` · `... rule 10 action accept` · `... rule 10 state new enable`',
            'สร้าง ruleset ขากลับ (stateful): `set firewall ipv4 name WAN-LAN rule 10 action accept` · `... rule 10 state established enable` · `... rule 10 state related enable` · `... default-action drop`',
            'ประกาศโซนและผูก: `set firewall zone LAN interface eth1` · `set firewall zone WAN interface eth2` · `set firewall zone WAN from LAN firewall name LAN-WAN` · `set firewall zone LAN from WAN firewall name WAN-LAN`',
            'อย่าลืม commit แล้วทดสอบจาก PC1: `ping 203.0.113.10` — ถ้า ping ไม่ผ่าน มักลืมกฎ established ฝั่งขากลับ (echo reply โดน drop)',
          ],
          topology: {
            nodes: [ pc('PC1', -300, 0), vyos('R1', 0, 0), pc('PC2', 300, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'PC2', port1: 0, node2: 'R1', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'R1 ประกาศ security zone', node: 'R1', command: 'show configuration commands | match "firewall zone"', expect: 'zone', points: 3,
              failHint: 'ยังไม่มีโซน — เริ่มจาก `set firewall zone LAN interface eth1` และ `set firewall zone WAN interface eth2` (เมื่อ interface เข้าโซนแล้ว ทุกอย่างที่ไม่มีกฎอนุญาตจะถูก drop โดยปริยาย)' },
            { description: 'R1 มีกฎ stateful (state established) ฝั่งขากลับ', node: 'R1', command: 'show configuration commands | match "state established"', expect: 'established', points: 3,
              failHint: 'นี่คือหัวใจ stateful: ruleset ทิศ WAN→LAN ต้องมี `rule 10 state established enable` (และ related) ไม่งั้นของที่ขอออกไปจะตอบกลับเข้ามาไม่ได้' },
            { description: 'PC1 (LAN) ping PC2 (WAN) ได้ผ่านนโยบาย stateful', node: 'PC1', command: 'ping 203.0.113.10', expect: 'bytes from 203\\.0\\.113\\.10', points: 4,
              failHint: 'ping ไม่ผ่าน — ไล่: (1) PC ทั้งคู่ตั้ง IP/gateway ครบหรือยัง (2) ruleset LAN→WAN ต้องมี rule action accept (state new) (3) ruleset WAN→LAN ต้องปล่อย established/related ไม่งั้น echo reply หาย (4) commit แล้วหรือยัง' },
          ],
        },
      ],
    },

    // ── โมดูล 3 — IPsec Site-to-Site VPN ────────────────────────────────
    {
      title: 'โมดูล 3 — IPsec Site-to-Site VPN',
      description: 'เชื่อมสองสาขาข้ามอินเทอร์เน็ตแบบเข้ารหัสด้วย IPsec — IKE, ESP, pre-shared key และ tunnel แบบ policy-based',
      order: 2,
      objectives: [
        'อธิบายบทบาทของ IKE phase 1/2 และ ESP',
        'แยกความต่างของ tunnel mode กับ transport mode',
        'สร้าง IPsec site-to-site VPN บน VyOS ให้สองสาขา ping ถึงกันแบบเข้ารหัส',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'IKE, ESP และ Pre-Shared Key',
          order: 0,
          estMinutes: 15,
          sections: [
            {
              heading: 'IPsec คือกล่องเครื่องมือ ไม่ใช่โปรโตคอลเดียว',
              body: [
                'IPsec เป็นชุดโปรโตคอลที่ให้ทั้งความลับ (encryption), ความถูกต้อง (integrity) และการยืนยันตัวตน (authentication) แก่ทราฟฟิก IP ประกอบด้วยสองส่วนหลัก:',
                '',
                '- **IKE (Internet Key Exchange)** — เจรจาและแลกกุญแจอย่างปลอดภัย แบ่งเป็นสองเฟส',
                '- **ESP (Encapsulating Security Payload)** — ห่อและเข้ารหัสข้อมูลจริงที่วิ่งใน tunnel',
                '',
                'อีกตัวคือ AH (Authentication Header) ให้แค่ integrity ไม่เข้ารหัส — ปัจจุบันแทบไม่ใช้แล้วเพราะ ESP ทำได้ครบกว่า',
              ].join('\n'),
            },
            {
              heading: 'IKE Phase 1 และ Phase 2',
              body: [
                '- **Phase 1 (IKE SA)** — สร้างช่องทางปลอดภัยสำหรับการเจรจา: ยืนยันตัวตน (pre-shared key หรือ certificate), ตกลง encryption/hash/DH group ผลลัพธ์คือ IKE SA หนึ่งคู่',
                '- **Phase 2 (IPsec SA)** — ภายใต้ช่องของ Phase 1 ตกลงพารามิเตอร์ของ ESP ที่จะใช้ห่อข้อมูลจริง ผลลัพธ์คือ IPsec SA สำหรับทราฟฟิกที่ตรง "interesting traffic" (local/remote prefix)',
                '',
                'ค่าที่ "ต้องตรงกันสองฝั่ง" จึงจะขึ้น: PSK, encryption, hash, DH group และ prefix ที่จับคู่กัน — ผิดข้อเดียว SA ก็ไม่ขึ้น',
              ].join('\n'),
            },
            {
              heading: 'Tunnel Mode เทียบ Transport Mode',
              body: [
                '- **Tunnel mode** — ห่อทั้งแพ็กเก็ต IP เดิม (header เดิมถูกซ่อน) แล้วใส่ header ใหม่ของคู่ VPN ใช้กับ **site-to-site** เพราะซ่อนวง LAN จริงไว้ข้างใน',
                '- **Transport mode** — เข้ารหัสเฉพาะ payload เก็บ header เดิมไว้ ใช้กับการสื่อสาร host-to-host',
                '',
                'แล็บนี้เป็น site-to-site policy-based: เรากำหนด "interesting traffic" เป็นวง LAN ของแต่ละฝั่ง (192.168.1.0/24 ↔ 192.168.2.0/24) ทราฟฟิกที่ตรงเงื่อนไขจะถูกดันเข้า tunnel โดยอัตโนมัติ — สังเกตว่าเราจะ **ไม่** ใส่ static route ของวงปลายทาง ดังนั้นถ้า VPN ไม่ขึ้น ping ก็จะไม่ผ่านเลย เป็นการพิสูจน์ในตัวว่า tunnel ทำงานจริง',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — IPsec Site-to-Site VPN',
          order: 1,
          estMinutes: 40,
          description: 'สร้าง IPsec VPN เข้ารหัสระหว่างสองสาขาข้ามลิงก์ WAN ด้วย pre-shared key ปกป้องทราฟฟิกระหว่างวง LAN สองฝั่ง แล้วพิสูจน์ว่า host สองสาขา ping ถึงกันได้เฉพาะเมื่อ tunnel ขึ้น',
          scenario: {
            from: 'พี่เบียร์ หัวหน้าฝ่าย IT',
            priority: 'high',
            body: 'สำนักงานกรุงเทพกับเชียงใหม่ต้องเชื่อมระบบ HR เข้าหากัน แต่ลิงก์ที่เรามีคือเน็ตของ ISP ผ่านอินเทอร์เน็ตสาธารณะ — ข้อมูลพนักงานวิ่งโล่ง ๆ ข้ามเน็ตคนอื่นไม่ได้เด็ดขาด ฝ่ายกฎหมายสั่งมาว่าต้องเข้ารหัส ฝากตั้ง IPsec VPN เชื่อมสองวง LAN ให้คุยกันแบบเข้ารหัส ใช้ pre-shared key ไปก่อน เฟสหน้าค่อยย้ายไป certificate',
          },
          objectives: [
            'ตั้ง ike-group/esp-group และ pre-shared key ที่ตรงกันทั้งสองฝั่ง',
            'สร้าง site-to-site peer ที่จับคู่ interesting traffic 192.168.1.0/24 ↔ 192.168.2.0/24',
            'พิสูจน์ว่า IPsec SA ขึ้นสถานะ up และ PC1 ping PC2 ข้ามสาขาได้',
          ],
          hints: [
            'โครงสร้าง: PC1(192.168.1.10) — R1(eth1=192.168.1.1/24, eth2=10.0.12.1/24) — R2(eth1=10.0.12.2/24, eth2=192.168.2.1/24) — PC2(192.168.2.10) — อย่าใส่ static route ของวง LAN ปลายทาง ให้ IPsec จัดการเอง',
            'IKE/ESP (ตั้งให้เหมือนกันสองฝั่ง): `set vpn ipsec ike-group IKE proposal 1 encryption aes256` · `... hash sha256` · `... dh-group 14` และ `set vpn ipsec esp-group ESP proposal 1 encryption aes256` · `... hash sha256`',
            'เปิด IPsec บน interface WAN: `set vpn ipsec interface eth2`',
            'PSK (id = IP ของอีกฝั่ง): R1 → `set vpn ipsec authentication psk PR1 id 10.0.12.1` · `... psk PR1 id 10.0.12.2` · `... psk PR1 secret MYSECRET123`',
            'peer R1: `set vpn ipsec site-to-site peer 10.0.12.2 authentication mode pre-shared-secret` · `... local-address 10.0.12.1` · `... ike-group IKE` · `... default-esp-group ESP` · `... tunnel 1 local prefix 192.168.1.0/24` · `... tunnel 1 remote prefix 192.168.2.0/24`',
            'R2 ทำกลับด้าน (local-address 10.0.12.2, tunnel local 192.168.2.0/24, remote 192.168.1.0/24, PSK secret เดียวกัน) แล้วตรวจ `show vpn ipsec sa` ต้องเห็น up',
          ],
          topology: {
            nodes: [ pc('PC1', -360, 0), vyos('R1', -120, 0), vyos('R2', 120, 0), pc('PC2', 360, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 1 },
              { node1: 'R2', port1: 2, node2: 'PC2', port2: 0 },
            ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งค่า site-to-site peer แบบ pre-shared-secret', node: 'R1', command: 'show configuration commands | match "pre-shared-secret"', expect: 'pre-shared-secret', points: 2,
              failHint: 'ยังไม่มี peer — `set vpn ipsec site-to-site peer 10.0.12.2 authentication mode pre-shared-secret` พร้อม local-address, ike-group, default-esp-group และ tunnel 1 local/remote prefix ให้ครบ' },
            { description: 'IPsec SA บน R1 ขึ้นสถานะ up', node: 'R1', command: 'show vpn ipsec sa', expect: '\\bup\\b', points: 4,
              failHint: 'SA ยังไม่ขึ้น — ค่าที่ต้องตรงกันเป๊ะสองฝั่ง: PSK secret, encryption/hash/dh-group ใน ike-group/esp-group และ local-address ต้องเป็น IP "ของตัวเอง" (R1=10.0.12.1) ลอง `ping 10.0.12.2` ก่อนว่า underlay ถึงกันไหม' },
            { description: 'PC1 ping PC2 ข้ามสาขาผ่าน tunnel ได้', node: 'PC1', command: 'ping 192.168.2.10', expect: 'bytes from 192\\.168\\.2\\.10', points: 4,
              failHint: 'เพราะไม่มี static route ของวงปลายทาง ping จะผ่านได้ก็ต่อเมื่อ IPsec จับทราฟฟิกเข้า tunnel เท่านั้น — เช็คว่า tunnel 1 local/remote prefix ตรงกับวง LAN จริง (R1 local 192.168.1.0/24 = R2 remote 192.168.1.0/24) และ PC ทั้งคู่มี gateway' },
          ],
        },
      ],
    },

    // ── โมดูล 4 — WireGuard VPN ─────────────────────────────────────────
    {
      title: 'โมดูล 4 — WireGuard VPN',
      description: 'VPN ยุคใหม่ที่เบาและเร็ว: key pair, allowed-ips และการเทียบกับ IPsec',
      order: 3,
      objectives: [
        'อธิบายโมเดล key pair (public/private) ของ WireGuard',
        'อธิบายบทบาทของ allowed-ips ในการเลือกเส้นทางเข้า tunnel',
        'สร้าง WireGuard tunnel บน VyOS ให้สอง router ping ผ่าน overlay ได้',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'WireGuard: Key Pair, Allowed-IPs และเทียบกับ IPsec',
          order: 0,
          estMinutes: 12,
          sections: [
            {
              heading: 'ทำไม WireGuard ถึงต่าง',
              body: [
                'WireGuard เป็น VPN สมัยใหม่ที่ออกแบบให้เรียบง่ายมาก: โค้ดน้อยกว่า IPsec หลายเท่า, ใช้ชุด cryptography ที่ทันสมัยตายตัว (ไม่ต้องเจรจา cipher), และทำงานเร็วกว่าในหลายสถานการณ์',
                '',
                'แทนที่จะมี IKE phase 1/2 และตารางพารามิเตอร์ให้ตกลง WireGuard ใช้แค่ **คู่กุญแจ (key pair)** และ **รายการ allowed-ips** เท่านั้น',
              ].join('\n'),
            },
            {
              heading: 'Key Pair และ Allowed-IPs',
              body: [
                'แต่ละ peer มี **private key** (เก็บลับไว้กับตัว) และ **public key** (แจกให้คู่สนทนา) — การตั้งค่าคือ "เอา public key ของอีกฝั่งมาใส่ใน peer ของเรา" สลับกัน',
                '',
                '**allowed-ips** ทำสองหน้าที่พร้อมกัน:',
                '- ขาออก — บอกว่า "ทราฟฟิกถึงปลายทางใดให้ส่งเข้า tunnel หา peer นี้" (เหมือน route)',
                '- ขาเข้า — เป็นตัวกรองว่ายอมรับแพ็กเก็ตจาก peer นี้ได้เฉพาะ source ใด (เหมือน ACL)',
                '',
                '> จุดพลาดที่พบบ่อยคือ allowed-ips แคบเกินจนทราฟฟิกที่ต้องการไม่เข้า tunnel — ในแล็บนี้เราใช้วง overlay /30 เพื่อให้เห็นภาพชัด',
              ].join('\n'),
            },
            {
              heading: 'WireGuard เทียบ IPsec',
              body: [
                '| ประเด็น | IPsec | WireGuard |',
                '|---|---|---|',
                '| การเจรจา cipher | มี (IKE phase 1/2) | ไม่มี — fix ชุดเดียว |',
                '| การยืนยันตัวตน | PSK หรือ certificate | public/private key |',
                '| ความซับซ้อนของ config | สูง | ต่ำ |',
                '| มาตรฐาน/ความเข้ากันได้ | กว้าง (ข้าม vendor) | ใหม่กว่า แต่แพร่หลายเร็ว |',
                '',
                'บน VyOS การตั้งค่าเริ่มจาก `run generate pki wireguard key-pair` เพื่อสร้างคู่กุญแจ แล้วนำ public key ของอีกฝั่งมาใส่ในบล็อก peer',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — WireGuard Tunnel',
          order: 1,
          estMinutes: 35,
          description: 'สร้าง WireGuard overlay ระหว่างสอง router ข้ามลิงก์ WAN ด้วยการแลก public key แล้วพิสูจน์ว่า ping ผ่านวง overlay (172.16.0.0/30) ได้',
          scenario: {
            from: 'พี่เบียร์ หัวหน้าฝ่าย IT',
            priority: 'medium',
            body: 'ทีม dev อยากได้ tunnel เชื่อมเซิร์ฟเวอร์สองที่แบบตั้งง่าย ๆ ไม่ต้องยุ่งกับ IKE/ESP ให้ปวดหัวเหมือน IPsec คราวก่อน ได้ยินว่า WireGuard เซ็ตไว้แล้วเสถียรและเบาเครื่อง ลองขึ้น tunnel ระหว่าง R1–R2 ให้หน่อย ขอแค่ ping ทะลุถึงกันผ่านวงภายในของ tunnel เป็น proof of concept ก่อน',
          },
          objectives: [
            'สร้างคู่กุญแจ WireGuard บนแต่ละ router แล้วแลก public key กัน',
            'ตั้ง interface wg0 พร้อม overlay 172.16.0.0/30 และ allowed-ips/endpoint ของ peer',
            'พิสูจน์ว่า R1 ping ปลาย tunnel (172.16.0.2) ผ่าน WireGuard ได้',
          ],
          hints: [
            'underlay (WAN): R1 eth1 = 10.0.12.1/24, R2 eth1 = 10.0.12.2/24 — ทดสอบ `ping 10.0.12.2` ให้ผ่านก่อนเสมอ',
            'สร้างกุญแจ: `run generate pki wireguard key-pair` (คัดลอก private key มาใส่ของตัวเอง และเก็บ public key ไว้ให้อีกฝั่ง)',
            'R1: `set interfaces wireguard wg0 address 172.16.0.1/30` · `set interfaces wireguard wg0 private-key <R1-PRIV>` · `set interfaces wireguard wg0 port 51820`',
            'R1 peer: `set interfaces wireguard wg0 peer R2 public-key <R2-PUB>` · `... peer R2 address 10.0.12.2` · `... peer R2 port 51820` · `... peer R2 allowed-ips 172.16.0.0/30`',
            'R2 ทำกลับด้าน: address 172.16.0.2/30, private-key ของ R2, peer R1 public-key = <R1-PUB>, address 10.0.12.1, allowed-ips 172.16.0.0/30',
            'ตรวจ `show interfaces wireguard wg0` (มี peer + latest handshake) แล้ว `ping 172.16.0.2` — handshake ไม่ขึ้นมักเพราะใส่ public key ของอีกฝั่งสลับกัน',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งค่า interface wireguard wg0', node: 'R1', command: 'show configuration commands | match "interfaces wireguard wg0"', expect: 'wireguard', points: 3,
              failHint: 'ยังไม่มี wg0 — เริ่มจาก `set interfaces wireguard wg0 address 172.16.0.1/30` และใส่ private-key ของตัวเอง (ได้จาก `run generate pki wireguard key-pair`)' },
            { description: 'R1 กำหนด peer พร้อม allowed-ips', node: 'R1', command: 'show configuration commands | match "wg0 peer"', expect: 'allowed-ips', points: 3,
              failHint: 'peer ยังไม่ครบ — ต้องมี public-key ของ R2, address (endpoint) 10.0.12.2, port และ allowed-ips 172.16.0.0/30 ครบทั้งสี่ค่า' },
            { description: 'R1 ping ปลาย tunnel 172.16.0.2 ผ่าน WireGuard ได้', node: 'R1', command: 'ping 172.16.0.2 count 3', expect: 'bytes from 172\\.16\\.0\\.2', points: 4,
              failHint: 'ping overlay ไม่ผ่าน — เช็ค: (1) underlay `ping 10.0.12.2` ผ่านไหม (2) public key ที่ใส่ใน peer ต้องเป็นของ "อีกฝั่ง" ไม่ใช่ของตัวเอง (สลับกันบ่อยที่สุด) (3) allowed-ips ต้องครอบ 172.16.0.0/30 ทั้งสองฝั่ง' },
          ],
        },
      ],
    },

    // ── โมดูล 5 — Layer 2 Security: DHCP Snooping & DAI ─────────────────
    {
      title: 'โมดูล 5 — Layer 2 Security: DHCP Snooping และ DAI',
      description: 'ภัยคุกคามระดับ Layer 2 ที่ firewall มองไม่เห็น และมาตรการรับมือบนสวิตช์',
      order: 4,
      objectives: [
        'อธิบายการโจมตี DHCP starvation และ rogue DHCP server',
        'อธิบายหลักการ DHCP snooping (trusted/untrusted port) และ binding table',
        'อธิบายว่า Dynamic ARP Inspection ใช้ binding table ป้องกัน ARP poisoning ได้อย่างไร',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'การโจมตี Layer 2 และมาตรการรับมือ',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'ทำไม Layer 2 ถึงอันตราย',
              body: [
                'firewall และ ACL ทำงานที่ Layer 3/4 — มันมองไม่เห็นการโจมตีที่เกิด "ภายในวงเดียวกัน" ที่ Layer 2 ผู้โจมตีที่เสียบเข้าสวิตช์ในออฟฟิศได้ สามารถหลอกทั้งวงโดยไม่ต้องผ่าน router เลย',
                '',
                'สองการโจมตีคลาสสิกที่ทุกคนต้องรู้จัก: **DHCP-based attacks** และ **ARP poisoning**',
              ].join('\n'),
            },
            {
              heading: 'DHCP Starvation และ Rogue DHCP Server',
              body: [
                '- **DHCP starvation** — ผู้โจมตียิงคำขอ DHCP ปลอมจำนวนมหาศาลด้วย MAC ปลอม จน pool ของ server หมด ผู้ใช้จริงขอ IP ไม่ได้ (โจมตี Availability)',
                '- **Rogue DHCP server** — ผู้โจมตีตั้ง DHCP server ปลอมขึ้นในวง แล้วตอบกลับเร็วกว่า server จริง แจก default gateway เป็นเครื่องของตัวเอง → ทราฟฟิกของเหยื่อวิ่งผ่านผู้โจมตี (Man-in-the-Middle)',
                '',
                '**DHCP snooping** แก้ปัญหานี้โดยแบ่งพอร์ตสวิตช์เป็น:',
                '- **Trusted** — พอร์ตที่ต่อไป DHCP server จริง (ยอมให้ส่ง DHCP offer/ack ได้)',
                '- **Untrusted** — พอร์ตฝั่งผู้ใช้ (ยอมเฉพาะ DHCP request; ถ้ามี offer/ack วิ่งออกมา = rogue server → ตัดทิ้ง)',
                '',
                'ผลพลอยได้คือสวิตช์สร้าง **DHCP snooping binding table** ที่จับคู่ MAC ↔ IP ↔ port ไว้ ซึ่งกลายเป็นวัตถุดิบของ DAI',
              ].join('\n'),
            },
            {
              heading: 'ARP Poisoning และ Dynamic ARP Inspection',
              body: [
                'ARP ไม่มีการยืนยันตัวตนเลย — ใครก็ตอบ "IP นี้คือ MAC ฉัน" ได้ ผู้โจมตีจึงปลอม ARP reply ให้เหยื่อเชื่อว่า gateway คือเครื่องของตน (**ARP poisoning / spoofing**) แล้วดักทราฟฟิกทั้งหมด',
                '',
                '**Dynamic ARP Inspection (DAI)** ตรวจ ARP ทุกแพ็กเก็ตบนพอร์ต untrusted เทียบกับ **DHCP snooping binding table** — ถ้า MAC↔IP ไม่ตรงกับที่จดไว้ตอนแจก DHCP → ทิ้งทันที จึงต้องเปิด DHCP snooping ก่อน DAI ถึงจะมีฐานข้อมูลให้ตรวจ',
                '',
                '> ทั้งสองฟีเจอร์นี้เป็นของ **สวิตช์ระดับองค์กร** (Cisco/Aruba ฯลฯ) — VyOS และสวิตช์จำลองใน GNS3 ไม่รองรับ โมดูลนี้จึงเป็นทฤษฎี + แบบทดสอบ แต่เป็นหัวข้อที่ออกสอบ CCNA แน่นอน',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — Layer 2 Security',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'การตั้ง DHCP server ปลอมในวงเพื่อแจก default gateway เป็นเครื่องตัวเอง เป็นการโจมตีแบบใด',
              choices: ['DHCP starvation', 'Rogue DHCP server (MITM)', 'ARP timeout', 'Port flapping'],
              answer: [1],
              explanation: 'Rogue DHCP server หลอกเหยื่อให้ส่งทราฟฟิกผ่านผู้โจมตี กลายเป็น Man-in-the-Middle',
              points: 1,
            },
            {
              prompt: 'ใน DHCP snooping พอร์ตที่ต่อไปยัง DHCP server จริงควรตั้งเป็นแบบใด',
              choices: ['Untrusted', 'Trusted', 'Shutdown', 'Access เท่านั้น'],
              answer: [1],
              explanation: 'พอร์ตที่ต่อ server จริงตั้งเป็น trusted จึงยอมให้ DHCP offer/ack ผ่าน ส่วนพอร์ตผู้ใช้เป็น untrusted',
              points: 1,
            },
            {
              prompt: 'Dynamic ARP Inspection อาศัยฐานข้อมูลใดในการตรวจสอบ ARP',
              choices: ['Routing table', 'DHCP snooping binding table', 'MAC address table เพียงอย่างเดียว', 'ARP cache ของผู้โจมตี'],
              answer: [1],
              explanation: 'DAI เทียบ ARP กับ DHCP snooping binding table จึงต้องเปิด DHCP snooping ก่อน',
              points: 1,
            },
            {
              prompt: 'เหตุใด firewall ระดับ Layer 3/4 จึงมักมองไม่เห็นการโจมตี ARP poisoning',
              choices: [
                'เพราะ ARP ถูกเข้ารหัส',
                'เพราะการโจมตีเกิดภายในวง Layer 2 เดียวกัน ไม่วิ่งผ่าน router',
                'เพราะ firewall ปิด ARP เสมอ',
                'เพราะ ARP ใช้ TCP',
              ],
              answer: [1],
              explanation: 'ARP poisoning เกิดใน broadcast domain เดียวกันที่ Layer 2 จึงไม่ผ่าน router/firewall — ต้องป้องกันที่สวิตช์',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 6 — AAA และ Management Plane Security ─────────────────────
    {
      title: 'โมดูล 6 — AAA และ Management Plane Security',
      description: 'ปกป้อง "ทางเข้าหลังบ้าน" ของอุปกรณ์: AAA, SSH hardening และ login banner',
      order: 5,
      objectives: [
        'อธิบายสามฟังก์ชันของ AAA และบทบาทของ RADIUS/TACACS+',
        'อธิบายเหตุผลของการทำ hardening ระนาบจัดการ (management plane)',
        'ทำ hardening การเข้าถึงด้วย SSH และตั้ง login banner บน VyOS',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'AAA และการ Hardening ระนาบจัดการ',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'AAA: Authentication, Authorization, Accounting',
              body: [
                'AAA คือกรอบการควบคุม "ใครเข้าได้ ทำอะไรได้ และทำอะไรไปบ้าง":',
                '',
                '- **Authentication** — ยืนยันว่าคุณเป็นใคร (username/password, key, OTP)',
                '- **Authorization** — เมื่อเข้ามาแล้ว ทำอะไรได้บ้าง (สิทธิ์/บทบาท)',
                '- **Accounting** — บันทึกว่าใครทำอะไรเมื่อไหร่ (audit log)',
                '',
                'ในองค์กรเรามักรวมศูนย์ AAA ไว้ที่เซิร์ฟเวอร์กลางแทนที่จะเก็บ user ในอุปกรณ์ทุกตัว:',
                '- **RADIUS** — มาตรฐานเปิด เข้ารหัสเฉพาะรหัสผ่าน รวม authentication+authorization เข้าด้วยกัน นิยมกับการพิสูจน์ตัวตนผู้ใช้/802.1X',
                '- **TACACS+** — ของ Cisco เข้ารหัสทั้ง payload และแยก AAA สามส่วนได้ละเอียด นิยมกับการจัดการสิทธิ์ผู้ดูแลอุปกรณ์',
              ].join('\n'),
            },
            {
              heading: 'Management Plane คืออะไร และทำไมต้อง Harden',
              body: [
                'อุปกรณ์เครือข่ายแบ่งการทำงานเป็นสามระนาบ: **data plane** (ส่งต่อแพ็กเก็ตผู้ใช้), **control plane** (โปรโตคอล routing), และ **management plane** (ช่องที่ผู้ดูแลเข้าไปตั้งค่า — SSH, API, console)',
                '',
                'management plane คือ "ทางเข้าหลังบ้าน" — ถ้าโดนยึด ผู้โจมตีคุมทั้งอุปกรณ์ได้ทันที การ harden ที่สำคัญ:',
                '',
                '- ปิด Telnet ใช้ **SSH** เท่านั้น (Telnet ส่งรหัสแบบ plaintext)',
                '- จำกัดที่อยู่/วงที่เข้ามาจัดการได้ (management ACL)',
                '- ปิด password login หันไปใช้ **public key** ถ้าทำได้',
                '- ตั้ง **login banner** เตือนทางกฎหมายก่อนเข้าระบบ',
                '- บังคับรหัสผ่านที่แข็งแรงและ lockout เมื่อเดารหัสผิดซ้ำ ๆ',
              ].join('\n'),
            },
            {
              heading: 'SSH Hardening และ Banner บน VyOS',
              body: [
                'คำสั่งหลักที่จะใช้ในแล็บ:',
                '',
                '```',
                'set service ssh port 22',
                'set service ssh disable-password-authentication   # บังคับใช้ public key',
                'set service ssh listen-address 192.168.1.1        # รับเฉพาะ interface จัดการ',
                'set system login banner pre-login "WARNING: Authorized access only."',
                '```',
                '',
                '> หลัก least privilege ใช้ได้กับระนาบจัดการเช่นกัน: เปิดเฉพาะวิธีและที่อยู่ที่จำเป็นต้องใช้จริง อย่างอื่นปิดให้หมด',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — SSH Hardening และ Login Banner',
          order: 1,
          estMinutes: 25,
          description: 'เปิดบริการ SSH สำหรับการจัดการ R1 พร้อมจำกัดให้รับเฉพาะ interface ฝั่ง LAN ตั้ง login banner เตือน และยังคงให้ host ในวงจัดการ ping ถึง R1 ได้',
          scenario: {
            from: 'พี่ปอนด์ Security Officer',
            priority: 'medium',
            body: 'router สาขาตัวนี้ยังเปิด Telnet อยู่ และใครก็ remote เข้ามาจากฝั่งไหนก็ได้ — ออดิทขีดเส้นแดงไว้แล้ว ขอสามอย่าง: (1) จัดการผ่าน SSH เท่านั้น (2) รับการจัดการได้เฉพาะจากวง LAN ภายใน ไม่ใช่จากทุกทิศ (3) ขึ้น banner เตือนก่อน login ว่าเป็นระบบที่อนุญาตเฉพาะผู้มีสิทธิ์ ฝากจัดด่วนก่อนออดิทรอบหน้า',
          },
          objectives: [
            'เปิด SSH และจำกัด listen-address ไว้ที่ interface ฝั่ง LAN (192.168.1.1)',
            'ตั้ง login banner เตือนก่อนเข้าระบบ',
            'ยืนยันว่า host ในวงจัดการยังเข้าถึง R1 ได้ (ping ผ่าน)',
          ],
          hints: [
            'โครงสร้าง: PC1(192.168.1.10, gw .1) — R1(eth1=192.168.1.1/24) — ตั้ง eth1 ก่อนเสมอ',
            'เปิด SSH เฉพาะฝั่งจัดการ: `set service ssh port 22` · `set service ssh listen-address 192.168.1.1`',
            'บังคับใช้ public key (ปิด password login): `set service ssh disable-password-authentication`',
            'banner: `set system login banner pre-login "WARNING: Authorized access only."`',
            'commit แล้วทดสอบจาก PC1: `ping 192.168.1.1` ต้องผ่าน (การ harden การจัดการต้องไม่ตัดการเข้าถึงที่ถูกต้อง)',
          ],
          topology: {
            nodes: [ pc('PC1', -260, 0), vyos('R1', 60, 0) ],
            links: [ { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 เปิด SSH และจำกัด listen-address ฝั่ง LAN', node: 'R1', command: 'show configuration commands | match "service ssh"', expect: 'listen-address 192\\.168\\.1\\.1', points: 4,
              failHint: 'ยังไม่จำกัดที่อยู่จัดการ — `set service ssh listen-address 192.168.1.1` ทำให้ R1 รับ SSH เฉพาะจากฝั่ง LAN (อย่าลืม `set service ssh port 22` ด้วย)' },
            { description: 'R1 ตั้ง login banner เตือนก่อนเข้าระบบ', node: 'R1', command: 'show configuration commands | match "login banner"', expect: 'banner', points: 3,
              failHint: 'ยังไม่มี banner — `set system login banner pre-login "WARNING: Authorized access only."` (ข้อความใส่ในเครื่องหมายคำพูด)' },
            { description: 'PC1 ในวงจัดการยังเข้าถึง R1 ได้ (ping ผ่าน)', node: 'PC1', command: 'ping 192.168.1.1', expect: 'bytes from 192\\.168\\.1\\.1', points: 3,
              failHint: 'ping ไม่ถึง R1 — เช็คว่า eth1 = 192.168.1.1/24 และ PC1 ตั้ง `ip 192.168.1.10 255.255.255.0 192.168.1.1` ครบ การ harden ต้องไม่ตัดการเข้าถึงที่ถูกต้องของผู้ดูแล' },
          ],
        },
      ],
    },
  ],
};
