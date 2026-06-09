// CCNP Enterprise: Advanced Routing (v9) — ระดับผู้เชี่ยวชาญ
// ทฤษฎี + แบบทดสอบ + แล็บลงมือทำบน VyOS (โอเพนซอร์ส แทนภาพ Cisco IOS ที่ติดลิขสิทธิ์)
// คำสั่งตัวอย่างอ้างอิงไวยากรณ์ VyOS 1.4+/1.5 — การให้คะแนนเน้นผลลัพธ์เชิงฟังก์ชัน
// (ping/เส้นทาง/translation) จึงไม่ผูกกับเวอร์ชันไวยากรณ์ที่ต่างกัน

import { vyos, pc, sw } from './_vyos.js';

export default {
  title: 'CCNP Enterprise: Advanced Routing (v9)',
  description: 'การ routing ขั้นสูงสำหรับองค์กร: EIGRP, OSPF หลายพื้นที่ และพื้นฐาน BGP ระหว่างองค์กร',
  level: 'expert',
  track: 'CCNP Enterprise',
  estimatedHours: 60,
  prerequisites: ['ผ่าน CCNP Enterprise: Core Networking หรือเทียบเท่า', 'เข้าใจ routing พื้นฐานและ subnetting อย่างลึกซึ้ง'],
  published: true,
  modules: [
    {
      title: 'โมดูล 1 — EIGRP',
      description: 'หลักการของ EIGRP, metric และ DUAL',
      order: 0,
      objectives: [
        'อธิบายการสร้าง neighbor และตาราง EIGRP (neighbor, topology, routing)',
        'อธิบายการคำนวณ metric และแนวคิด feasible successor',
        'เข้าใจบทบาทของอัลกอริทึม DUAL',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'EIGRP: Neighbor, Metric และ DUAL',
          order: 0,
          estMinutes: 16,
          sections: [
            {
              heading: 'สามตารางของ EIGRP',
              body: [
                'EIGRP เป็น advanced distance-vector protocol ของ Cisco ใช้สามตาราง:',
                '',
                '- **Neighbor table** — เพื่อนบ้านที่ค้นพบผ่าน Hello',
                '- **Topology table** — เส้นทางที่เป็นไปได้ทั้งหมดไปยังแต่ละปลายทาง',
                '- **Routing table** — เส้นทางที่ดีที่สุด (successor) ที่ถูกติดตั้งใช้งานจริง',
              ].join('\n'),
            },
            {
              heading: 'Successor และ Feasible Successor',
              body: [
                '- **Successor** — เส้นทางที่ดีที่สุด (metric ต่ำสุด) ที่ติดตั้งใน routing table',
                '- **Feasible Successor (FS)** — เส้นทางสำรองที่ผ่าน **feasibility condition** (reported distance ของเพื่อนบ้าน < feasible distance ของเรา) ทำให้สลับได้ทันทีโดยไม่ต้องคำนวณใหม่',
                '',
                'การมี FS ทำให้ EIGRP converge เร็วมากเมื่อเส้นทางหลักล่ม',
              ].join('\n'),
            },
            {
              heading: 'Metric และ DUAL',
              body: [
                'EIGRP metric (แบบ classic) คำนวณจาก **bandwidth** และ **delay** เป็นหลัก (K1, K3 = 1 โดยปริยาย)',
                '',
                'อัลกอริทึม **DUAL (Diffusing Update Algorithm)** เป็นหัวใจที่รับประกันเส้นทางปลอด loop และเลือก successor/FS อย่างถูกต้อง เมื่อไม่มี FS จะเข้าสู่สถานะ **active** เพื่อสอบถามเพื่อนบ้าน',
                '',
                '> 🧪 แล็บกำหนดค่า EIGRP บนอุปกรณ์ Cisco ต้องใช้ GNS3 template ของ IOS ซึ่งกำลังจัดเตรียม',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — EIGRP',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'EIGRP classic metric คำนวณจากค่าใดเป็นหลักโดยปริยาย',
              choices: ['Hop count', 'Bandwidth และ Delay', 'MTU และ Load', 'Reliability เท่านั้น'],
              answer: [1],
              explanation: 'โดยปริยาย K1=K3=1 ทำให้ metric ขึ้นกับ bandwidth และ delay',
              points: 1,
            },
            {
              prompt: 'feasible successor คือ',
              choices: [
                'เส้นทางที่ดีที่สุดที่ใช้งานอยู่',
                'เส้นทางสำรองที่ผ่าน feasibility condition พร้อมใช้ทันที',
                'เพื่อนบ้านที่ตาย',
                'เส้นทางที่มี loop',
              ],
              answer: [1],
              explanation: 'FS เป็นเส้นทางสำรองที่ปลอด loop (RD < FD) ใช้สลับได้ทันทีเมื่อ successor ล่ม',
              points: 1,
            },
            {
              prompt: 'เมื่อ EIGRP ไม่มี feasible successor และเส้นทางหลักล่ม route จะเข้าสู่สถานะใด',
              choices: ['Passive', 'Active', 'Stuck', 'Down'],
              answer: [1],
              explanation: 'เมื่อไม่มี FS route จะเข้าสู่สถานะ active เพื่อ query เพื่อนบ้านหาเส้นทางใหม่',
              points: 1,
            },
          ],
        },
      ],
    },
    {
      title: 'โมดูล 2 — OSPF หลายพื้นที่ (Multi-Area)',
      description: 'การออกแบบ OSPF แบบหลาย area และประเภท LSA',
      order: 1,
      objectives: [
        'อธิบายเหตุผลของการแบ่ง OSPF เป็นหลาย area',
        'ระบุบทบาท ABR และ ASBR',
        'เข้าใจประเภท LSA หลักและขั้นตอนการเป็น neighbor',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'OSPF Areas, ABR/ASBR และ LSA',
          order: 0,
          estMinutes: 15,
          sections: [
            {
              heading: 'ทำไมต้องแบ่ง Area',
              body: [
                'OSPF เป็น link-state protocol ที่ทุก router ในพื้นที่เดียวกันต้องมี **link-state database (LSDB)** เหมือนกัน เมื่อเครือข่ายใหญ่ขึ้น การคำนวณ SPF และขนาด LSDB จะหนัก',
                '',
                'การแบ่งเป็นหลาย **area** (โดยมี **area 0** เป็น backbone) ช่วย:',
                '- จำกัดขอบเขตการ flood LSA',
                '- ลดขนาด LSDB และภาระ SPF',
                '- สรุปเส้นทาง (summarization) ที่ขอบ area ได้',
              ].join('\n'),
            },
            {
              heading: 'ABR และ ASBR',
              body: [
                '- **ABR (Area Border Router)** — เชื่อมระหว่าง area กับ backbone (area 0) ทำ summarization และสร้าง inter-area routes',
                '- **ASBR (Autonomous System Boundary Router)** — นำเส้นทางจากภายนอก OSPF (เช่น redistribute จาก BGP/EIGRP) เข้ามา',
                '',
                'ทุก area ที่ไม่ใช่ backbone ต้องเชื่อมกับ area 0 (ผ่าน ABR หรือ virtual link)',
              ].join('\n'),
            },
            {
              heading: 'ประเภท LSA และการเป็น Neighbor',
              body: [
                'LSA ที่พบบ่อย: **Type 1 (Router)**, **Type 2 (Network)** ภายใน area, **Type 3 (Summary)** ข้าม area โดย ABR, **Type 5 (External)** จาก ASBR',
                '',
                'การจับคู่ neighbor ไล่ผ่านสถานะ: `Down → Init → 2-Way → ExStart → Exchange → Loading → Full` — สอง router จะ adjacency เต็มเมื่อถึง **Full**',
                '',
                '> ค่าที่ต้องตรงกันจึงจะเป็น neighbor: area, hello/dead timer, subnet, authentication',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — OSPF Multi-Area',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'area ใดทำหน้าที่เป็น backbone ของ OSPF',
              choices: ['area 1', 'area 0', 'area 255', 'area ใดก็ได้'],
              answer: [1],
              explanation: 'area 0 คือ backbone ทุก area อื่นต้องเชื่อมกับ area 0',
              points: 1,
            },
            {
              prompt: 'router ที่นำเส้นทางจากภายนอก OSPF (redistribute) เข้ามาเรียกว่าอะไร',
              choices: ['ABR', 'ASBR', 'DR', 'BDR'],
              answer: [1],
              explanation: 'ASBR นำ external routes เข้าสู่ OSPF ส่วน ABR เชื่อมระหว่าง area',
              points: 1,
            },
            {
              prompt: 'สอง OSPF router จะถือว่า adjacency เต็มสมบูรณ์เมื่ออยู่ในสถานะใด',
              choices: ['2-Way', 'ExStart', 'Loading', 'Full'],
              answer: [3],
              explanation: 'สถานะ Full หมายถึง LSDB ตรงกันและ adjacency สมบูรณ์',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 3 — แล็บ DHCP และ NAT (VyOS) ──────────────────────────────
    {
      title: 'โมดูล 3 — แล็บลงมือทำ: DHCP และ NAT (VyOS)',
      description: 'แจก IP อัตโนมัติด้วย DHCP/DHCP Relay และแปลงที่อยู่ด้วย Static NAT, Dynamic NAT และ PAT บน VyOS',
      order: 2,
      objectives: [
        'ตั้งค่า DHCP server และ DHCP relay agent ข้าม subnet',
        'แยกความต่างของ Static NAT, Dynamic NAT และ PAT (overload)',
        'ตรวจสอบ NAT translation table หลังมีทราฟฟิกจริง',
      ],
      lessons: [
        // 11) DHCP
        {
          type: 'lab',
          title: 'แล็บ — DHCP Configuration',
          order: 0,
          estMinutes: 25,
          description: 'ตั้งค่า VyOS ให้เป็น DHCP server แจก IP, subnet mask และ default gateway ให้ host อัตโนมัติ แล้วให้ VPCS ขอ lease',
          objectives: [
            'สร้าง DHCP pool 192.168.10.100–192.168.10.200 พร้อม default-router 192.168.10.1',
            'ให้ host ขอที่อยู่อัตโนมัติด้วยคำสั่ง dhcp',
            'ยืนยันว่า host ได้รับ IP ในช่วงที่กำหนด',
          ],
          hints: [
            'R1 eth1 = 192.168.10.1/24',
            'VyOS: `set service dhcp-server shared-network-name LAN subnet 192.168.10.0/24 range R1 start 192.168.10.100 stop 192.168.10.200`',
            '`set service dhcp-server shared-network-name LAN subnet 192.168.10.0/24 option default-router 192.168.10.1`',
            'บน PC1 (VPCS) สั่ง `dhcp` เพื่อขอที่อยู่ แล้ว `show ip` ดูผล',
          ],
          topology: {
            nodes: [ pc('PC1', -220, 0), vyos('R1', 140, 0) ],
            links: [ { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งค่า DHCP server', node: 'R1', command: 'show configuration commands | match "dhcp-server"', expect: 'dhcp-server', points: 3 },
            { description: 'PC1 ได้รับ IP จาก DHCP ในช่วง .100–.200', node: 'PC1', command: 'dhcp', expect: '192\\.168\\.10\\.[12]\\d\\d', points: 4 },
            { description: 'PC1 ได้ default gateway 192.168.10.1', node: 'PC1', command: 'show ip', expect: '192\\.168\\.10\\.1', points: 2 },
          ],
        },
        // 12) DHCP Relay
        {
          type: 'lab',
          title: 'แล็บ — DHCP Relay Agent',
          order: 1,
          estMinutes: 30,
          description: 'host อยู่คนละ subnet กับ DHCP server — ตั้งค่า VyOS ตัวกลางให้เป็น relay agent ส่งต่อ DHCP broadcast ข้าม subnet ไปยัง server',
          objectives: [
            'เข้าใจว่าทำไม DHCP broadcast ข้าม router ไม่ได้และต้องมี relay',
            'ตั้งค่า R1 เป็น relay agent ส่งต่อไปยัง DHCP server (R2)',
            'ยืนยันว่า host ในซับเน็ตของ R1 ได้รับ IP จาก pool บน R2',
          ],
          hints: [
            'โครงสร้าง: PC1 — R1(eth1=192.168.50.1/24) — R1(eth2=10.0.12.1/30) — R2(eth1=10.0.12.2/30)',
            'R1 (relay): `set service dhcp-relay server 10.0.12.2` · `set service dhcp-relay interface eth1` · `set service dhcp-relay interface eth2`',
            'R2 (server): สร้าง pool ของ 192.168.50.0/24 (range .100–.200, default-router 192.168.50.1) และเพิ่มเส้นทางกลับ `set protocols static route 192.168.50.0/24 next-hop 10.0.12.1`',
            'PC1 สั่ง `dhcp` — ควรได้ที่อยู่ 192.168.50.x จาก pool ฝั่ง R2',
          ],
          topology: {
            nodes: [ pc('PC1', -320, 0), vyos('R1', -60, 0), vyos('R2', 220, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งค่า DHCP relay ไปยัง 10.0.12.2', node: 'R1', command: 'show configuration commands | match "dhcp-relay"', expect: '10\\.0\\.12\\.2', points: 4 },
            { description: 'PC1 ได้ IP จาก pool ข้าม subnet (192.168.50.x)', node: 'PC1', command: 'dhcp', expect: '192\\.168\\.50\\.', points: 5 },
          ],
        },
        // 13) Static NAT
        {
          type: 'lab',
          title: 'แล็บ — Static NAT Configuration',
          order: 2,
          estMinutes: 30,
          description: 'แม็พที่อยู่ภายในหนึ่งตัวกับที่อยู่สาธารณะหนึ่งตัวแบบตายตัว (one-to-one) แล้วพิสูจน์ด้วยทราฟฟิกจริงและตาราง NAT translation',
          objectives: [
            'แม็พ 192.168.1.10 (inside) ↔ 203.0.113.10 (global) แบบ static',
            'พิสูจน์ว่า host ภายในออกไปยังเครือข่ายภายนอกได้',
            'ตรวจ NAT translation table ว่าใช้ที่อยู่ที่แม็พไว้',
          ],
          hints: [
            'โครงสร้าง: PC1(192.168.1.10) — R1(eth1=192.168.1.1/24, eth2=10.0.12.1/30) — R2(eth1=10.0.12.2/30)',
            'R1: `set nat source rule 10 source address 192.168.1.10` · `set nat source rule 10 outbound-interface name eth2` · `set nat source rule 10 translation address 203.0.113.10`',
            'R2 ต้องมีเส้นทางกลับของช่วง public: `set protocols static route 203.0.113.0/24 next-hop 10.0.12.1`',
            'PC1: `ip 192.168.1.10 255.255.255.0 192.168.1.1` แล้ว `ping 10.0.12.2` — จากนั้นบน R1 ดู `show nat source translations`',
          ],
          topology: {
            nodes: [ pc('PC1', -300, 0), vyos('R1', -40, 0), vyos('R2', 240, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'PC1 ออกสู่ภายนอก (ping 10.0.12.2) ผ่าน NAT ได้', node: 'PC1', command: 'ping 10.0.12.2', expect: 'bytes from 10\\.0\\.12\\.2', points: 4 },
            { description: 'NAT table ของ R1 ใช้ที่อยู่ static 203.0.113.10', node: 'R1', command: 'show nat source translations', expect: '203\\.0\\.113\\.10', points: 3 },
            { description: 'R1 มีกฎ static NAT translation', node: 'R1', command: 'show configuration commands | match "translation address 203"', expect: '203\\.0\\.113\\.10', points: 2 },
          ],
        },
        // 14) Dynamic NAT
        {
          type: 'lab',
          title: 'แล็บ — Dynamic NAT Configuration',
          order: 3,
          estMinutes: 30,
          description: 'แปลงที่อยู่ภายในหลายตัวด้วย pool ของที่อยู่สาธารณะแบบ one-to-one ตามที่ว่าง (ไม่แชร์พอร์ต) แล้วพิสูจน์ว่าแต่ละ host ได้คนละที่อยู่จาก pool',
          objectives: [
            'สร้าง NAT pool 203.0.113.10–203.0.113.20 สำหรับ source 192.168.1.0/24',
            'พิสูจน์ว่า host หลายตัวออกภายนอกได้',
            'ตรวจ translation table ว่าได้ที่อยู่จาก pool',
          ],
          hints: [
            'R1: `set nat source rule 20 source address 192.168.1.0/24` · `set nat source rule 20 outbound-interface name eth2` · `set nat source rule 20 translation address 203.0.113.10-203.0.113.20`',
            'R2: เส้นทางกลับ `set protocols static route 203.0.113.0/24 next-hop 10.0.12.1`',
            'PC1 = 192.168.1.10, PC2 = 192.168.1.20 (gateway 192.168.1.1) — ให้ทั้งคู่ `ping 10.0.12.2`',
            'บน R1 ดู `show nat source translations` จะเห็นที่อยู่ในช่วง 203.0.113.1x',
          ],
          topology: {
            nodes: [ pc('PC1', -340, -80), pc('PC2', -340, 80), sw('SW1', -120, 0), vyos('R1', 100, 0), vyos('R2', 340, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
              { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
              { node1: 'SW1', port1: 2, node2: 'R1', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'PC1 ออกสู่ภายนอกผ่าน NAT ได้', node: 'PC1', command: 'ping 10.0.12.2', expect: 'bytes from 10\\.0\\.12\\.2', points: 3 },
            { description: 'PC2 ออกสู่ภายนอกผ่าน NAT ได้', node: 'PC2', command: 'ping 10.0.12.2', expect: 'bytes from 10\\.0\\.12\\.2', points: 3 },
            { description: 'NAT table ใช้ที่อยู่จาก pool 203.0.113.1x', node: 'R1', command: 'show nat source translations', expect: '203\\.0\\.113\\.1[0-9]', points: 3 },
          ],
        },
        // 15) PAT
        {
          type: 'lab',
          title: 'แล็บ — PAT Configuration (NAT Overload)',
          order: 4,
          estMinutes: 25,
          description: 'แชร์ที่อยู่สาธารณะตัวเดียวให้ host ภายในหลายตัวด้วยการแปลงพอร์ต (PAT/overload) — บน VyOS คือ translation address masquerade',
          objectives: [
            'ตั้งค่า PAT ให้ทั้ง subnet 192.168.1.0/24 ใช้ที่อยู่ขาออกของ eth2 ร่วมกัน',
            'พิสูจน์ว่า host หลายตัวออกภายนอกพร้อมกันได้ผ่านที่อยู่เดียว',
            'เข้าใจว่า PAT ใช้หมายเลขพอร์ตแยกแยะแต่ละ session',
          ],
          hints: [
            'R1: `set nat source rule 100 source address 192.168.1.0/24` · `set nat source rule 100 outbound-interface name eth2` · `set nat source rule 100 translation address masquerade`',
            'masquerade ใช้ IP ของ eth2 (10.0.12.1) เป็นที่อยู่ขาออก จึงไม่ต้องเพิ่มเส้นทางกลับบน R2',
            'PC1 = 192.168.1.10, PC2 = 192.168.1.20 — ให้ทั้งคู่ `ping 10.0.12.2`',
            'บน R1 `show nat source translations` จะเห็นทั้งสอง host ถูกแปลงเป็น 10.0.12.1 คนละพอร์ต',
          ],
          topology: {
            nodes: [ pc('PC1', -340, -80), pc('PC2', -340, 80), sw('SW1', -120, 0), vyos('R1', 100, 0), vyos('R2', 340, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
              { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
              { node1: 'SW1', port1: 2, node2: 'R1', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'PC1 ออกภายนอกผ่าน PAT ได้', node: 'PC1', command: 'ping 10.0.12.2', expect: 'bytes from 10\\.0\\.12\\.2', points: 3 },
            { description: 'PC2 ออกภายนอกผ่าน PAT ได้ (ที่อยู่เดียวกัน)', node: 'PC2', command: 'ping 10.0.12.2', expect: 'bytes from 10\\.0\\.12\\.2', points: 3 },
            { description: 'R1 ตั้งค่า masquerade (overload)', node: 'R1', command: 'show configuration commands | match "translation address masquerade"', expect: 'masquerade', points: 3 },
          ],
        },
      ],
    },

    // ── โมดูล 4 — แล็บ BGP, ACL และ Tunnel (VyOS) ───────────────────────
    {
      title: 'โมดูล 4 — แล็บลงมือทำ: BGP, ACL และ Tunnel (VyOS)',
      description: 'ลงมือทำ eBGP, BGP Route Reflector, Route Map, Extended ACL และ GRE Tunnel บน VyOS',
      order: 3,
      objectives: [
        'สร้าง eBGP peering และควบคุมเส้นทางด้วย Route Reflector และ Route Map',
        'กรองทราฟฟิกแบบละเอียดด้วย Extended ACL (firewall)',
        'สร้างอุโมงค์ GRE เชื่อมเครือข่ายส่วนตัวข้าม WAN',
      ],
      lessons: [
        // 16) eBGP
        {
          type: 'lab',
          title: 'แล็บ — eBGP Configuration',
          order: 0,
          estMinutes: 30,
          description: 'สร้าง eBGP peering ระหว่างสอง AS แล้วโฆษณาและเรียนรู้เส้นทางข้ามองค์กร พิสูจน์ด้วย routing table และการ ping',
          objectives: [
            'สร้าง eBGP ระหว่าง R1 (AS 65001) และ R2 (AS 65002)',
            'โฆษณา network ของแต่ละฝั่งเข้า BGP',
            'พิสูจน์ว่าแต่ละฝั่งเรียนรู้ network ของอีกฝั่งและ ping ถึง loopback ปลายทางได้',
          ],
          hints: [
            'ลิงก์ peering: R1 eth1 = 10.0.12.1/24, R2 eth1 = 10.0.12.2/24',
            'สร้าง loopback ที่จะโฆษณา: R1 `set interfaces dummy dum0 address 192.168.1.1/24` (R2 ใช้ 192.168.2.1/24)',
            'R1: `set protocols bgp system-as 65001` · `set protocols bgp neighbor 10.0.12.2 remote-as 65002` · `set protocols bgp address-family ipv4-unicast network 192.168.1.0/24`',
            'ตรวจ: `show ip bgp summary` (สถานะ Established) และ `show ip route bgp`',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 เรียนรู้ network ของ R2 ผ่าน BGP (192.168.2.0)', node: 'R1', command: 'show ip route bgp | match 192.168.2', expect: '192\\.168\\.2\\.0', points: 4 },
            { description: 'R1 ping loopback ของ R2 (192.168.2.1) ได้', node: 'R1', command: 'ping 192.168.2.1 count 3', expect: 'bytes from 192\\.168\\.2\\.1', points: 3 },
            { description: 'R1 ตั้งค่า eBGP neighbor (remote-as 65002)', node: 'R1', command: 'show configuration commands | match "remote-as"', expect: '65002', points: 2 },
          ],
        },
        // 17) BGP RR
        {
          type: 'lab',
          title: 'แล็บ — BGP Route Reflector',
          order: 1,
          estMinutes: 35,
          description: 'ลด full-mesh ของ iBGP ด้วย Route Reflector — client สอง peer คุยกับ RR เท่านั้น แล้ว RR สะท้อนเส้นทางให้กันและกัน',
          objectives: [
            'สร้าง iBGP ใน AS 65010: RR กับ client สองตัว (C1, C2) ที่ peer เฉพาะกับ RR',
            'กำหนด route-reflector-client บน RR สำหรับ C1 และ C2',
            'พิสูจน์ว่า C1 เรียนรู้เส้นทางของ C2 ผ่านการสะท้อนของ RR',
          ],
          hints: [
            'ทุกตัวอยู่ subnet เดียวกัน: RR=10.0.0.1/24, C1=10.0.0.2/24, C2=10.0.0.3/24 (ผ่าน SW1)',
            'RR: `set protocols bgp system-as 65010` · `set protocols bgp neighbor 10.0.0.2 remote-as 65010` · `set protocols bgp neighbor 10.0.0.2 address-family ipv4-unicast route-reflector-client` (ทำซ้ำกับ 10.0.0.3)',
            'C1: peer แค่ `neighbor 10.0.0.1 remote-as 65010` และโฆษณา dum0 192.168.1.0/24 — C2 โฆษณา 192.168.2.0/24',
            'C1 และ C2 ไม่ต้อง peer กันเอง — ตรวจที่ C1 ด้วย `show ip route bgp` ว่ามี 192.168.2.0',
          ],
          topology: {
            nodes: [ vyos('RR', 0, -130), vyos('C1', -200, 90), vyos('C2', 200, 90), sw('SW1', 0, 0) ],
            links: [
              { node1: 'RR', port1: 1, node2: 'SW1', port2: 0 },
              { node1: 'C1', port1: 1, node2: 'SW1', port2: 1 },
              { node1: 'C2', port1: 1, node2: 'SW1', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'RR กำหนด route-reflector-client', node: 'RR', command: 'show configuration commands | match "route-reflector-client"', expect: 'route-reflector-client', points: 4 },
            { description: 'C1 เรียนรู้เส้นทางของ C2 ผ่าน RR (192.168.2.0)', node: 'C1', command: 'show ip route bgp | match 192.168.2', expect: '192\\.168\\.2\\.0', points: 4 },
            { description: 'C1 ping loopback ของ C2 (192.168.2.1) ได้', node: 'C1', command: 'ping 192.168.2.1 count 3', expect: 'bytes from 192\\.168\\.2\\.1', points: 3 },
          ],
        },
        // 18) BGP Route Map
        {
          type: 'lab',
          title: 'แล็บ — BGP Route Map',
          order: 2,
          estMinutes: 35,
          description: 'ควบคุมเส้นทางที่รับเข้ามาจาก BGP peer ด้วย route-map + prefix-list — อนุญาตเฉพาะ prefix ที่ต้องการ และกรองที่เหลือออก',
          objectives: [
            'สร้าง route-map ที่ยอมรับเฉพาะ 192.168.2.0/24 จาก peer และกรอง 192.168.20.0/24 ทิ้ง',
            'ผูก route-map เข้ากับ BGP neighbor ในทิศ import (in)',
            'พิสูจน์ว่า prefix ที่อนุญาตถูกเรียนรู้ (และตรวจด้วยตนเองว่า prefix ที่กรองหายไป)',
          ],
          hints: [
            'R1 (65001) ↔ R2 (65002) บนลิงก์ 10.0.12.0/24 — R2 โฆษณาทั้ง 192.168.2.0/24 และ 192.168.20.0/24',
            'R1: `set policy prefix-list ALLOW rule 10 action permit prefix 192.168.2.0/24`',
            'R1: `set policy route-map FROM-R2 rule 10 action permit` · `set policy route-map FROM-R2 rule 10 match ip address prefix-list ALLOW`',
            'ผูกเข้า neighbor: `set protocols bgp neighbor 10.0.12.2 address-family ipv4-unicast route-map import FROM-R2` แล้วตรวจ `show ip route bgp` — ควรมี 192.168.2.0 แต่ไม่มี 192.168.20.0',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 มี route-map ผูกกับ BGP neighbor', node: 'R1', command: 'show configuration commands | match "route-map import"', expect: 'route-map import', points: 4 },
            { description: 'R1 เรียนรู้ prefix ที่อนุญาต (192.168.2.0)', node: 'R1', command: 'show ip route bgp | match 192.168.2.0', expect: '192\\.168\\.2\\.0', points: 4 },
          ],
        },
        // 19) Extended ACL
        {
          type: 'lab',
          title: 'แล็บ — Extended ACL (Firewall by Protocol/Port)',
          order: 3,
          estMinutes: 30,
          description: 'Extended ACL กรองทราฟฟิกตาม protocol/พอร์ต/ต้นทาง/ปลายทาง — บน VyOS ใช้ firewall ruleset แบบ stateful ที่ระบุ protocol และพอร์ตได้',
          objectives: [
            'สร้าง ruleset ที่อนุญาต ICMP และปฏิเสธ Telnet (TCP/23) จาก LAN ฝั่งหนึ่งไปอีกฝั่ง',
            'ผูก ruleset เข้ากับ interface ในทิศที่ถูกต้อง',
            'พิสูจน์ว่า ICMP ที่อนุญาตผ่านได้ (ping ข้าม subnet สำเร็จ)',
          ],
          hints: [
            'R1 route ระหว่าง LAN A (192.168.1.0/24, eth1) และ LAN B (192.168.2.0/24, eth2)',
            'VyOS (1.4+): `set firewall ipv4 name AtoB rule 10 action accept` · `set firewall ipv4 name AtoB rule 10 protocol icmp`',
            'ปฏิเสธ Telnet: `set firewall ipv4 name AtoB rule 20 action drop` · `... rule 20 protocol tcp` · `... rule 20 destination port 23` แล้วตั้ง `default-action accept`',
            'PC1=192.168.1.10 (gw .1), PC2=192.168.2.10 (gw .1) — ทดสอบ `ping 192.168.2.10` จาก PC1',
          ],
          topology: {
            nodes: [ pc('PC1', -300, 0), vyos('R1', 0, 0), pc('PC2', 300, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'PC2', port1: 0, node2: 'R1', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'R1 มี firewall rule ระบุ protocol', node: 'R1', command: 'show configuration commands | match "name AtoB"', expect: 'protocol', points: 3 },
            { description: 'R1 ผูก firewall เข้ากับ interface', node: 'R1', command: 'show configuration commands | match "AtoB"', expect: 'AtoB', points: 2 },
            { description: 'PC1 ping PC2 ด้วย ICMP ที่อนุญาตได้', node: 'PC1', command: 'ping 192.168.2.10', expect: 'bytes from 192\\.168\\.2\\.10', points: 4 },
          ],
        },
        // 20) GRE Tunnel
        {
          type: 'lab',
          title: 'แล็บ — GRE Tunnel Configuration',
          order: 4,
          estMinutes: 30,
          description: 'สร้างอุโมงค์ GRE ระหว่างสอง router เพื่อเชื่อมเครือข่ายส่วนตัวข้าม WAN พิสูจน์ว่าอุโมงค์ขึ้นและ ping ผ่าน overlay ได้',
          objectives: [
            'สร้าง tunnel interface tun0 แบบ GRE ระหว่าง R1 และ R2',
            'กำหนด overlay 172.16.0.0/30 บนอุโมงค์',
            'พิสูจน์ว่าอุโมงค์ขึ้นสถานะ up และ ping ปลายอุโมงค์ได้',
          ],
          hints: [
            'underlay (WAN): R1 eth1 = 10.0.12.1/24, R2 eth1 = 10.0.12.2/24',
            'R1: `set interfaces tunnel tun0 encapsulation gre` · `set interfaces tunnel tun0 address 172.16.0.1/30` · `set interfaces tunnel tun0 source-address 10.0.12.1` · `set interfaces tunnel tun0 remote 10.0.12.2`',
            'R2: ทำเหมือนกันแต่ address 172.16.0.2/30, source-address 10.0.12.2, remote 10.0.12.1',
            'ตรวจ: `show interfaces` (tun0 = u/u) และ `ping 172.16.0.2 count 3`',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งค่า tunnel แบบ GRE', node: 'R1', command: 'show configuration commands | match "encapsulation gre"', expect: 'gre', points: 3 },
            { description: 'tun0 ขึ้นสถานะ up บน R1', node: 'R1', command: 'show interfaces | match tun0', expect: 'tun0.*u/u', points: 3 },
            { description: 'R1 ping ปลายอุโมงค์ (172.16.0.2) ได้', node: 'R1', command: 'ping 172.16.0.2 count 3', expect: 'bytes from 172\\.16\\.0\\.2', points: 3 },
          ],
        },
      ],
    },
  ],
};
