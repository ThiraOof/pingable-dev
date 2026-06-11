// CCNP Enterprise: Core Networking (v9) — ระดับสูง
// ทฤษฎี + แบบทดสอบ + แล็บลงมือทำบน VyOS (โอเพนซอร์ส แทนภาพ Cisco IOS ที่ติดลิขสิทธิ์)
// คำสั่งตัวอย่างอ้างอิงไวยากรณ์ VyOS 1.4+/1.5 — การให้คะแนนเน้นผลลัพธ์เชิงฟังก์ชัน
// (ping/เส้นทาง/สถานะ) จึงไม่ผูกกับเวอร์ชันไวยากรณ์ที่ต่างกัน

import { vyos, pc, sw } from './_vyos.js';

export default {
  slug: 'ccnp-core',
  title: 'CCNP Enterprise: Core Networking (v9)',
  description: 'เจาะลึกสถาปัตยกรรมเครือข่ายองค์กร, การ forward ของอุปกรณ์, VLAN/Trunk และ Spanning Tree ระดับมืออาชีพ',
  level: 'advanced',
  track: 'CCNP Enterprise',
  estimatedHours: 60,
  prerequisites: ['ผ่านระดับ CCNA หรือเทียบเท่า', 'เข้าใจ routing/switching และ subnetting อย่างมั่นใจ'],
  published: true,
  modules: [
    {
      title: 'โมดูล 1 — สถาปัตยกรรมและการ Forward ของอุปกรณ์',
      description: 'Control plane vs data plane และการ forward แบบ CEF',
      order: 0,
      objectives: [
        'แยกแยะ control plane, data plane และ management plane',
        'อธิบายการทำงานของ CEF (Cisco Express Forwarding)',
        'เข้าใจบทบาทของ FIB และ adjacency table',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Control Plane, Data Plane และ CEF',
          order: 0,
          estMinutes: 15,
          sections: [
            {
              heading: 'สาม Plane ของอุปกรณ์',
              body: [
                'อุปกรณ์เครือข่ายแบ่งการทำงานเป็นสาม plane:',
                '',
                '- **Control plane** — สร้างและดูแลข้อมูลเส้นทาง เช่น routing protocol (OSPF, BGP), STP มันคือ "สมอง"',
                '- **Data plane (forwarding plane)** — ส่ง packet จริงตามข้อมูลที่ control plane เตรียมไว้ ต้องเร็วมาก',
                '- **Management plane** — การเข้าถึง/จัดการอุปกรณ์ เช่น SSH, SNMP',
                '',
                'การแยก plane ทำให้ออกแบบให้ data plane forward ได้เร็วโดยไม่ต้องคำนวณเส้นทางทุก packet',
              ].join('\n'),
            },
            {
              heading: 'CEF: FIB และ Adjacency',
              body: [
                'แทนที่จะ lookup routing table ทุก packet (ช้า) Cisco ใช้ **CEF** สร้างโครงสร้างที่ค้นได้เร็ว 2 ตาราง:',
                '',
                '- **FIB (Forwarding Information Base)** — สำเนาเส้นทางจาก routing table จัดในรูป mtrie ค้นเร็ว',
                '- **Adjacency table** — เก็บข้อมูล L2 (MAC ปลายทาง/ next-hop) ที่พร้อมแปะกับ frame',
                '',
                'ผลคือ data plane forward ด้วยความเร็วสูงโดยไม่รบกวน control plane',
              ].join('\n'),
            },
            {
              heading: 'แล็บ (กำลังจัดเตรียม)',
              body: [
                '> 🧪 แล็บลงมือทำของโมดูลนี้ต้องใช้อิมเมจ Cisco IOS บนเซิร์ฟเวอร์ GNS3 (`templateId`) ซึ่งกำลังจัดเตรียม',
                '> เมื่อพร้อม แล็บจะปรากฏเป็นบทเรียนชนิด "แล็บ" ให้สร้าง topology และตรวจคำตอบอัตโนมัติเหมือนคอร์สพื้นฐาน',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — Forwarding Architecture',
          order: 1,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'routing protocol อย่าง OSPF ทำงานอยู่ใน plane ใด',
              choices: ['Data plane', 'Control plane', 'Management plane', 'Forwarding plane'],
              answer: [1],
              explanation: 'OSPF/BGP/STP คำนวณและดูแลเส้นทาง จึงอยู่ใน control plane',
              points: 1,
            },
            {
              prompt: 'CEF ใช้ตารางใดในการเก็บข้อมูล L2 ของ next-hop',
              choices: ['FIB', 'Adjacency table', 'Routing table', 'MAC address table'],
              answer: [1],
              explanation: 'Adjacency table เก็บข้อมูล L2 ที่ใช้แปะ frame ส่วน FIB เก็บข้อมูล forwarding L3',
              points: 1,
            },
            {
              prompt: 'ข้อดีของการแยก control plane ออกจาก data plane คือข้อใด',
              choices: [
                'ทำให้อุปกรณ์ราคาถูกลงเสมอ',
                'data plane forward ได้เร็วโดยไม่ต้องคำนวณเส้นทางทุก packet',
                'ไม่ต้องมี routing protocol',
                'ยกเลิกการใช้ IP',
              ],
              answer: [1],
              explanation: 'data plane ใช้ข้อมูลที่ control plane เตรียมไว้ (FIB/adjacency) จึง forward เร็วมาก',
              points: 1,
            },
          ],
        },
      ],
    },
    {
      title: 'โมดูล 2 — VLAN, Trunk และ Spanning Tree',
      description: 'แบ่ง broadcast domain ด้วย VLAN และป้องกัน loop ด้วย STP',
      order: 1,
      objectives: [
        'อธิบายแนวคิด VLAN และ 802.1Q trunk',
        'อธิบายปัญหา Layer 2 loop และวิธีที่ STP ป้องกัน',
        'ระบุบทบาทพอร์ตของ STP (root, designated, blocking)',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'VLAN และ 802.1Q Trunking',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'VLAN แบ่ง broadcast domain',
              body: [
                '**VLAN** ทำให้ switch ตัวเดียวแบ่งออกเป็นหลาย broadcast domain เชิงตรรกะ พอร์ตใน VLAN ต่างกันจะคุยกันตรง ๆ ไม่ได้ ต้องผ่าน router/L3 switch (inter-VLAN routing)',
                '',
                'ประโยชน์: แยกแผนก/ความปลอดภัย, ลดขนาด broadcast domain, จัดการง่าย',
              ].join('\n'),
            },
            {
              heading: 'Trunk และการแท็ก 802.1Q',
              body: [
                'เมื่อหลาย VLAN ต้องวิ่งข้ามลิงก์ระหว่าง switch เราใช้ **trunk** ซึ่งเติมแท็ก **802.1Q** (VLAN ID 12 บิต) ลงใน frame เพื่อระบุว่า frame นี้เป็นของ VLAN ใด',
                '',
                'พอร์ตมี 2 โหมดหลัก: **access** (1 VLAN ต่อ host) และ **trunk** (หลาย VLAN ระหว่าง switch)',
                '',
                '> Native VLAN คือ VLAN ที่ส่งแบบ**ไม่ติดแท็ก**บน trunk ควรตั้งให้ตรงกันทั้งสองฝั่งเพื่อความปลอดภัย',
              ].join('\n'),
            },
            {
              heading: 'Spanning Tree ป้องกัน loop',
              body: [
                'การต่อ switch หลายตัวเป็นวงเพื่อ redundancy อาจเกิด **Layer 2 loop** ทำให้ frame วนไม่รู้จบ (broadcast storm)',
                '',
                '**STP** แก้ปัญหาโดยเลือก **root bridge** แล้วบล็อกพอร์ตที่ทำให้เกิด loop ชั่วคราว เหลือ topology แบบ tree',
                '',
                'บทบาทพอร์ต: **Root port** (ทางไป root ที่ดีที่สุด), **Designated port** (forward ในแต่ละ segment), **Blocking/Alternate** (ปิดเพื่อกัน loop)',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — VLAN & STP',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'การส่งหลาย VLAN ข้ามลิงก์เดียวระหว่าง switch ใช้สิ่งใด',
              choices: ['Access port', '802.1Q trunk', 'Router on a stick เท่านั้น', 'STP'],
              answer: [1],
              explanation: 'trunk ที่แท็กด้วย 802.1Q ทำให้หลาย VLAN วิ่งข้ามลิงก์เดียวได้',
              points: 1,
            },
            {
              prompt: 'STP มีไว้เพื่ออะไร',
              choices: [
                'เพิ่มความเร็วของ trunk',
                'ป้องกัน Layer 2 loop ในเครือข่ายที่มีเส้นทางสำรอง',
                'แจก IP อัตโนมัติ',
                'เข้ารหัสข้อมูล',
              ],
              answer: [1],
              explanation: 'STP เลือก root bridge และบล็อกพอร์ตที่ทำให้เกิด loop เพื่อป้องกัน broadcast storm',
              points: 1,
            },
            {
              prompt: 'พอร์ตที่ให้เส้นทางที่ดีที่สุดไปยัง root bridge เรียกว่าอะไร',
              choices: ['Designated port', 'Root port', 'Blocking port', 'Access port'],
              answer: [1],
              explanation: 'แต่ละ non-root switch มี root port หนึ่งพอร์ตที่เป็นทางที่ดีที่สุดไปยัง root bridge',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 3 — แล็บ Layer 2 & Switching (VyOS) ───────────────────────
    {
      title: 'โมดูล 3 — แล็บลงมือทำ: Layer 2 และ Switching (VyOS)',
      description: 'ลงมือตั้งค่า VLAN, Inter-VLAN, EtherChannel, STP/PortFast, Port Security และ SPAN บนอุปกรณ์โอเพนซอร์ส VyOS',
      order: 2,
      objectives: [
        'แยก broadcast domain ด้วย 802.1Q VLAN และ route ระหว่าง VLAN',
        'รวมลิงก์ด้วย LACP (EtherChannel) และเข้าใจ STP edge port',
        'ใช้ Port Security และ Local SPAN เพื่อความปลอดภัยและการมอนิเตอร์',
      ],
      lessons: [
        // 1) VLAN
        {
          type: 'lab',
          title: 'แล็บ — VLAN Configuration (802.1Q)',
          order: 0,
          estMinutes: 30,
          description: 'ต่อ VyOS สองตัวด้วยลิงก์ trunk เดียว สร้าง sub-interface แบบ 802.1Q สอง VLAN แล้วพิสูจน์ว่าทราฟฟิกแต่ละ VLAN แยกขาดจากกันแต่ยังวิ่งข้าม trunk ได้',
          objectives: [
            'สร้าง VLAN 10 และ VLAN 20 เป็น 802.1Q sub-interface บนลิงก์ trunk เดียว',
            'กำหนด IP คนละ subnet ให้แต่ละ VLAN',
            'พิสูจน์ว่า R1 ping R2 ได้ทั้งใน VLAN 10 และ VLAN 20',
          ],
          hints: [
            'R1: `set interfaces ethernet eth1 vif 10 address 10.0.10.1/24` และ `set interfaces ethernet eth1 vif 20 address 10.0.20.1/24`',
            'R2: ใช้ .2 แทน .1 ในทั้งสอง VLAN แล้ว `commit; save`',
            'ทดสอบจาก operational mode: `ping 10.0.10.2 count 3` และ `ping 10.0.20.2 count 3`',
            'แต่ละ vif คือ VLAN แยกกัน — ทราฟฟิกถูกแท็กด้วย VLAN ID บน trunk เส้นเดียว',
          ],
          topology: {
            nodes: [ vyos('R1', -200, 0), vyos('R2', 200, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 สร้าง VLAN 10 บน eth1', node: 'R1', command: 'show configuration commands | match "vif 10"', expect: 'vif 10', points: 2 },
            { description: 'R1 สร้าง VLAN 20 บน eth1', node: 'R1', command: 'show configuration commands | match "vif 20"', expect: 'vif 20', points: 2 },
            { description: 'R1 ping R2 ใน VLAN 10 ได้', node: 'R1', command: 'ping 10.0.10.2 count 3', expect: 'bytes from 10\\.0\\.10\\.2', points: 3 },
            { description: 'R1 ping R2 ใน VLAN 20 ได้', node: 'R1', command: 'ping 10.0.20.2 count 3', expect: 'bytes from 10\\.0\\.20\\.2', points: 3 },
          ],
        },
        // 2) Inter-VLAN routing
        {
          type: 'lab',
          title: 'แล็บ — Inter-VLAN Routing (Router-on-a-Stick)',
          order: 1,
          estMinutes: 30,
          description: 'วาง PC สองเครื่องไว้คนละ VLAN บนสวิตช์ แล้วให้ VyOS ทำหน้าที่ route ระหว่าง VLAN ผ่าน trunk เส้นเดียว (router-on-a-stick)',
          objectives: [
            'ตั้งพอร์ตสวิตช์: access VLAN 10, access VLAN 20 และ trunk (dot1q) ไป R1',
            'สร้าง gateway ของแต่ละ VLAN เป็น sub-interface บน R1',
            'พิสูจน์ว่า PC1 (VLAN 10) ping PC2 (VLAN 20) ข้าม VLAN ได้ผ่าน R1',
          ],
          hints: [
            'บน SW1 (GNS3): พอร์ตของ PC1 = access VLAN 10, ของ PC2 = access VLAN 20, พอร์ตไป R1 = dot1q trunk',
            'R1: `set interfaces ethernet eth1 vif 10 address 10.0.10.1/24` และ `vif 20 address 10.0.20.1/24`',
            'PC1: `ip 10.0.10.10 255.255.255.0 10.0.10.1` · PC2: `ip 10.0.20.10 255.255.255.0 10.0.20.1`',
            'ถ้า ping ข้าม VLAN ไม่ผ่าน ตรวจ gateway ของ PC และโหมด trunk ของพอร์ตไป R1',
          ],
          topology: {
            nodes: [ pc('PC1', -280, -120), pc('PC2', -280, 120), sw('SW1', -40, 0), vyos('R1', 220, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
              { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
              { node1: 'SW1', port1: 2, node2: 'R1', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'PC1 ถึง gateway VLAN 10 (R1)', node: 'PC1', command: 'ping 10.0.10.1', expect: 'bytes from 10\\.0\\.10\\.1', points: 2 },
            { description: 'PC2 ถึง gateway VLAN 20 (R1)', node: 'PC2', command: 'ping 10.0.20.1', expect: 'bytes from 10\\.0\\.20\\.1', points: 2 },
            { description: 'PC1 ping PC2 ข้าม VLAN ได้ (inter-VLAN routing)', node: 'PC1', command: 'ping 10.0.20.10', expect: 'bytes from 10\\.0\\.20\\.10', points: 4 },
          ],
        },
        // 3) EtherChannel
        {
          type: 'lab',
          title: 'แล็บ — EtherChannel Configuration (LACP Bonding)',
          order: 2,
          estMinutes: 25,
          description: 'รวมสองลิงก์ระหว่าง VyOS สองตัวให้เป็นลิงก์ตรรกะเดียวด้วย LACP (802.3ad) — เทียบเท่า EtherChannel ของ Cisco',
          objectives: [
            'สร้าง bonding interface bond0 โหมด 802.3ad และเพิ่ม eth1, eth2 เป็นสมาชิก',
            'กำหนด IP บน bond0 ทั้งสองฝั่ง',
            'ยืนยันว่า bond0 ขึ้นสถานะ up และ ping ข้ามได้',
          ],
          hints: [
            'R1: `set interfaces bonding bond0 mode 802.3ad` · `set interfaces ethernet eth1 bond-group bond0` · `set interfaces ethernet eth2 bond-group bond0`',
            'R1: `set interfaces bonding bond0 address 10.0.12.1/24` (R2 ใช้ .2)',
            'ตรวจสถานะ: `show interfaces` ควรเห็น bond0 เป็น u/u — และ `ping 10.0.12.2 count 3`',
            'หมายเหตุ: ต้องลบ address ที่เผลอตั้งบน eth1/eth2 ออกก่อนเพิ่มเข้า bond-group',
          ],
          topology: {
            nodes: [ vyos('R1', -200, 0), vyos('R2', 200, 0) ],
            links: [
              { node1: 'R1', port1: 1, node2: 'R2', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'R1 ตั้ง bond0 โหมด 802.3ad', node: 'R1', command: 'show configuration commands | match "bonding bond0 mode"', expect: '802\\.3ad', points: 3 },
            { description: 'bond0 ขึ้นสถานะ up บน R1', node: 'R1', command: 'show interfaces | match bond0', expect: 'bond0.*u/u', points: 3 },
            { description: 'R1 ping R2 ผ่าน bond0 ได้', node: 'R1', command: 'ping 10.0.12.2 count 3', expect: 'bytes from 10\\.0\\.12\\.2', points: 3 },
          ],
        },
        // 4) PortFast / STP edge
        {
          type: 'lab',
          title: 'แล็บ — PortFast / STP Edge (VyOS Bridge)',
          order: 3,
          estMinutes: 25,
          description: 'PortFast เป็นฟีเจอร์ STP เฉพาะของ Cisco — VyOS ใช้ bridge ที่เปิด STP เพื่อสาธิตกลไกเดียวกัน บทแล็บนี้สร้าง bridge เปิด STP และเชื่อม host สองเครื่องใน L2 เดียวกัน',
          objectives: [
            'สร้าง bridge br0 เปิดใช้งาน STP และเพิ่ม eth1, eth2 เป็นสมาชิก',
            'เข้าใจว่า PortFast คือพอร์ต edge ที่ข้ามสถานะ listening/learning ของ STP',
            'พิสูจน์ว่า host สองเครื่องที่ต่อกับ bridge สื่อสารกันได้',
          ],
          hints: [
            'R1: `set interfaces bridge br0 stp true` · `set interfaces bridge br0 member interface eth1` · `... eth2`',
            'PortFast ของ Cisco = พอร์ตที่ต่อ host (edge) ให้ขึ้น forwarding ทันที — บน VyOS ตั้ง bridge member ของพอร์ต host ได้เช่นกัน',
            'PC1: `ip 10.0.0.11 255.255.255.0` · PC2: `ip 10.0.0.12 255.255.255.0` แล้ว `ping 10.0.0.12`',
          ],
          topology: {
            nodes: [ pc('PC1', -240, -100), pc('PC2', -240, 100), vyos('R1', 140, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'PC2', port1: 0, node2: 'R1', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'R1 สร้าง bridge br0 และเปิด STP', node: 'R1', command: 'show configuration commands | match "bridge br0 stp"', expect: 'stp', points: 3 },
            { description: 'R1 เพิ่ม eth1 เป็นสมาชิก bridge', node: 'R1', command: 'show configuration commands | match "br0 member interface eth1"', expect: 'eth1', points: 2 },
            { description: 'PC1 ping PC2 ผ่าน bridge ได้', node: 'PC1', command: 'ping 10.0.0.12', expect: 'bytes from 10\\.0\\.0\\.12', points: 4 },
          ],
        },
        // 5) Port Security
        {
          type: 'lab',
          title: 'แล็บ — Port Security (MAC Filtering)',
          order: 4,
          estMinutes: 25,
          description: 'Port Security แบบ switchport เป็นฟีเจอร์เฉพาะของ Cisco — VyOS ใช้ firewall กรองตาม MAC address ต้นทางเพื่อให้ได้ผลลัพธ์เดียวกัน คืออนุญาตเฉพาะอุปกรณ์ที่ระบุไว้',
          objectives: [
            'สร้าง firewall ruleset ที่อนุญาตเฉพาะ MAC ของ PC1 บน eth1',
            'ผูก ruleset เข้ากับทิศ in ของ eth1',
            'พิสูจน์ว่า PC1 (MAC ที่อนุญาต) ยังสื่อสารกับ R1 ได้',
          ],
          hints: [
            'ดู MAC ของ PC1 ด้วย `show ip` (บรรทัด MAC) บน VPCS',
            'VyOS (1.4+): `set firewall ipv4 name PORTSEC rule 10 action accept` · `set firewall ipv4 name PORTSEC rule 10 source mac-address <MAC-ของ-PC1>`',
            'ผูกเข้า interface: `set firewall ipv4 name PORTSEC default-action drop` แล้วใช้กับ eth1 ทิศ in',
            'R1 eth1 = 10.0.0.1/24 · PC1: `ip 10.0.0.11 255.255.255.0 10.0.0.1`',
          ],
          topology: {
            nodes: [ pc('PC1', -220, 0), vyos('R1', 140, 0) ],
            links: [ { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 มี firewall ruleset กรองตาม MAC', node: 'R1', command: 'show configuration commands | match "mac-address"', expect: 'mac-address', points: 4 },
            { description: 'R1 ผูก firewall เข้ากับ eth1', node: 'R1', command: 'show configuration commands | match "PORTSEC"', expect: 'PORTSEC', points: 2 },
            { description: 'PC1 (MAC ที่อนุญาต) ping R1 ได้', node: 'PC1', command: 'ping 10.0.0.1', expect: 'bytes from 10\\.0\\.0\\.1', points: 3 },
          ],
        },
        // 6) Local SPAN
        {
          type: 'lab',
          title: 'แล็บ — Local SPAN (Port Mirroring)',
          order: 5,
          estMinutes: 20,
          description: 'มอนิเตอร์ทราฟฟิกของพอร์ตหนึ่งโดยทำสำเนาไปอีกพอร์ต (port mirroring) — เทียบเท่า Local SPAN ของ Cisco โดยใช้ฟีเจอร์ mirror ของ VyOS',
          objectives: [
            'มิเรอร์ทราฟฟิกขาเข้าของ eth1 (พอร์ตที่ถูกมอนิเตอร์) ไปยัง eth2 (พอร์ตวิเคราะห์)',
            'เข้าใจแนวคิด source port / destination port ของ SPAN',
            'ยืนยันว่ามีการตั้งค่า mirror ถูกต้อง',
          ],
          hints: [
            'VyOS: `set interfaces ethernet eth2 mirror ingress eth1` (และ `mirror egress eth1` หากต้องการสองทิศ)',
            'eth1 = พอร์ตต้นทาง (source/monitored), eth2 = พอร์ตปลายทาง (destination/analyzer)',
            'ต่อเครื่องดักจับ (PC2/Wireshark) ที่ eth2 เพื่อดูสำเนาแพ็กเก็ตของ eth1',
          ],
          topology: {
            nodes: [ pc('PC1', -240, -90), pc('PC2', -240, 90), vyos('R1', 140, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'PC2', port1: 0, node2: 'R1', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'R1 ตั้ง mirror บน eth2', node: 'R1', command: 'show configuration commands | match "eth2 mirror"', expect: 'mirror', points: 4 },
            { description: 'mirror อ้างอิงพอร์ตต้นทาง eth1', node: 'R1', command: 'show configuration commands | match "eth2 mirror"', expect: 'eth1', points: 3 },
          ],
        },
      ],
    },

    // ── โมดูล 4 — แล็บ First-Hop Redundancy & Management (VyOS) ──────────
    {
      title: 'โมดูล 4 — แล็บลงมือทำ: First-Hop Redundancy และการจัดการอุปกรณ์ (VyOS)',
      description: 'ตั้งค่า VRRP/HSRP (FHRP), SSH และ Syslog บน VyOS เพื่อความพร้อมใช้งานสูงและการบริหารจัดการที่ปลอดภัย',
      order: 3,
      objectives: [
        'ออกแบบ gateway สำรองด้วย VRRP (มาตรฐานเปิดแทน HSRP ของ Cisco)',
        'เปิดการเข้าถึงระยะไกลที่ปลอดภัยด้วย SSH',
        'ส่ง log ออกไปยัง syslog server ส่วนกลาง',
      ],
      lessons: [
        // 7) VRRP
        {
          type: 'lab',
          title: 'แล็บ — VRRP Configuration',
          order: 0,
          estMinutes: 30,
          description: 'สร้าง gateway เสมือน (VIP) ที่แชร์ระหว่าง VyOS สองตัวด้วย VRRP เพื่อให้ host มี default gateway ที่ทนต่อความล้มเหลว',
          objectives: [
            'กำหนด VRRP group (vrid 10) บน eth1 ของทั้งสอง router ด้วย VIP 10.0.0.1',
            'ให้ R1 เป็น Master (priority สูงกว่า) และ R2 เป็น Backup',
            'ยืนยันว่า host ใช้ VIP เป็น gateway และ ping VIP ได้',
          ],
          hints: [
            'R1: `set high-availability vrrp group GW vrid 10` · `... interface eth1` · `... address 10.0.0.1/24` · `... priority 150`',
            'R2: ทำเหมือนกันแต่ `priority 100` — IP จริง R1 eth1=10.0.0.2/24, R2 eth1=10.0.0.3/24',
            'ตรวจสถานะ: `show vrrp` ควรเห็น R1 = MASTER, R2 = BACKUP',
            'PC1: `ip 10.0.0.100 255.255.255.0 10.0.0.1` แล้ว `ping 10.0.0.1`',
          ],
          topology: {
            nodes: [ vyos('R1', -200, -90), vyos('R2', -200, 90), sw('SW1', 30, 0), pc('PC1', 250, 0) ],
            links: [
              { node1: 'R1', port1: 1, node2: 'SW1', port2: 0 },
              { node1: 'R2', port1: 1, node2: 'SW1', port2: 1 },
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'R1 เป็น VRRP Master', node: 'R1', command: 'show vrrp', expect: 'MASTER', points: 4 },
            { description: 'R2 เป็น VRRP Backup', node: 'R2', command: 'show vrrp', expect: 'BACKUP', points: 2 },
            { description: 'PC1 ping VIP (10.0.0.1) ได้', node: 'PC1', command: 'ping 10.0.0.1', expect: 'bytes from 10\\.0\\.0\\.1', points: 3 },
          ],
        },
        // 8) HSRP (→ VRRP active/standby + preempt)
        {
          type: 'lab',
          title: 'แล็บ — HSRP (จำลองด้วย VRRP Active/Standby + Preempt)',
          order: 1,
          estMinutes: 30,
          description: 'HSRP เป็นโปรโตคอลเฉพาะของ Cisco จึงไม่มีบน VyOS — บทแล็บนี้จำลองแนวคิด active/standby และ preemption ของ HSRP ด้วย VRRP ซึ่งเป็นมาตรฐานเปิด',
          objectives: [
            'เข้าใจว่า HSRP (Cisco) กับ VRRP (มาตรฐาน) แก้ปัญหา first-hop redundancy เหมือนกัน',
            'ตั้งค่า priority และ preempt ให้ router ที่ priority สูงกลับมาเป็น Active เมื่อฟื้นตัว',
            'ยืนยันบทบาท Master/Backup และการ ping VIP จาก host',
          ],
          hints: [
            'R1 priority 150, R2 priority 100 บน VRRP group เดียวกัน (vrid 11, VIP 10.0.0.1)',
            'เปิด preempt (ค่าเริ่มต้นของ VRRP คือ preempt = true) — เทียบกับ `standby 11 preempt` ของ Cisco HSRP',
            'ทดสอบ failover: ปิด eth1 ของ R1 → R2 ขึ้นเป็น MASTER, เปิดคืน → R1 แย่งกลับ (preempt)',
            'ตรวจด้วย `show vrrp` ทั้งสองเครื่อง และ `ping 10.0.0.1` จาก PC1',
          ],
          topology: {
            nodes: [ vyos('R1', -200, -90), vyos('R2', -200, 90), sw('SW1', 30, 0), pc('PC1', 250, 0) ],
            links: [
              { node1: 'R1', port1: 1, node2: 'SW1', port2: 0 },
              { node1: 'R2', port1: 1, node2: 'SW1', port2: 1 },
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'R1 (priority สูง) เป็น Master', node: 'R1', command: 'show vrrp', expect: 'MASTER', points: 3 },
            { description: 'R1 ตั้ง priority 150', node: 'R1', command: 'show configuration commands | match "priority"', expect: 'priority 150', points: 3 },
            { description: 'PC1 ping VIP (10.0.0.1) ได้', node: 'PC1', command: 'ping 10.0.0.1', expect: 'bytes from 10\\.0\\.0\\.1', points: 3 },
          ],
        },
        // 9) SSH
        {
          type: 'lab',
          title: 'แล็บ — SSH Configuration',
          order: 2,
          estMinutes: 20,
          description: 'เปิดบริการ SSH บน VyOS เพื่อให้เข้าถึงและบริหารอุปกรณ์จากระยะไกลอย่างปลอดภัย แทน Telnet ที่ส่งข้อมูลแบบ plaintext',
          objectives: [
            'เปิดบริการ SSH บนพอร์ต 22',
            'สร้างบัญชีผู้ใช้สำหรับเข้าระบบ',
            'ยืนยันว่าบริการ SSH ถูกตั้งค่าและทำงาน',
          ],
          hints: [
            'VyOS: `set service ssh port 22`',
            'สร้างผู้ใช้: `set system login user netadmin authentication plaintext-password <รหัส>`',
            'แนะนำให้ปิด password auth และใช้ public key เมื่อใช้งานจริง: `set service ssh disable-password-authentication`',
            'ทดสอบจากเครื่องอื่น: `ssh netadmin@<ip-ของ-R1>`',
          ],
          topology: {
            nodes: [ pc('PC1', -220, 0), vyos('R1', 140, 0) ],
            links: [ { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 เปิดบริการ SSH', node: 'R1', command: 'show configuration commands | match "service ssh"', expect: 'service ssh', points: 4 },
            { description: 'R1 ฟังพอร์ต SSH 22', node: 'R1', command: 'show configuration commands | match "service ssh port"', expect: "port '?22'?", points: 3 },
            { description: 'R1 มีบัญชีผู้ใช้สำหรับ login', node: 'R1', command: 'show configuration commands | match "login user"', expect: 'login user', points: 2 },
          ],
        },
        // 10) Syslog
        {
          type: 'lab',
          title: 'แล็บ — Syslog Configuration',
          order: 3,
          estMinutes: 20,
          description: 'ส่ง log ของ VyOS ออกไปเก็บที่ syslog server ส่วนกลาง เพื่อการตรวจสอบย้อนหลังและเฝ้าระวังเหตุการณ์',
          objectives: [
            'ตั้งค่าให้ส่ง log ไปยัง syslog server ปลายทาง (10.0.0.50)',
            'กำหนด facility และ level ที่ต้องการบันทึก',
            'ยืนยันการตั้งค่า remote syslog',
          ],
          hints: [
            'VyOS: `set system syslog host 10.0.0.50 facility all level info`',
            'R1 eth1 = 10.0.0.1/24 · syslog server (PC1) = 10.0.0.50',
            'ดู log ภายในเครื่องด้วย `show log` เพื่อยืนยันว่ามีเหตุการณ์ถูกบันทึก',
          ],
          topology: {
            nodes: [ pc('PC1', -220, 0), vyos('R1', 140, 0) ],
            links: [ { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 ส่ง syslog ไปยัง 10.0.0.50', node: 'R1', command: 'show configuration commands | match "syslog host"', expect: '10\\.0\\.0\\.50', points: 5 },
            { description: 'R1 กำหนด facility/level ของ syslog', node: 'R1', command: 'show configuration commands | match "syslog host"', expect: '(facility|level)', points: 3 },
          ],
        },
      ],
    },
  ],
};
