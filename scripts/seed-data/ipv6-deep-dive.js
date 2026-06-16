// IPv6 Deep Dive — เจาะลึก IPv6 พร้อมลงมือทำจริงบน VyOS
//
// CCNA 200-301 ให้น้ำหนัก IPv6 ทั้งใน Network Fundamentals และ IP Connectivity
// แต่หลักสูตรเดิมแตะ IPv6 แค่เชิงแนวคิด คอร์สนี้ลงลึกการกำหนดที่อยู่, static
// routing, OSPFv3 และ DHCPv6/transition — โดย VyOS รองรับ IPv6 เต็มรูปแบบ
//
// คำสั่งอ้างอิงไวยากรณ์ VyOS 1.4+/1.5 — การให้คะแนนเน้นผลลัพธ์เชิงฟังก์ชัน
// (ping6 ถึงปลายทาง, เส้นทาง IPv6 ที่เรียนรู้) จึงทนต่อความต่างของไวยากรณ์

import { vyos } from './_vyos.js';

export default {
  slug: 'ipv6-deep-dive',
  title: 'IPv6 Deep Dive',
  description: 'เจาะลึก IPv6 ตั้งแต่โครงสร้างที่อยู่ 128 บิต, ชนิดที่อยู่ (global/link-local/ULA), SLAAC/EUI-64 จนถึงลงมือทำ static routing, OSPFv3 และเข้าใจ DHCPv6 กับเทคนิค transition (dual-stack/NAT64) — ทุกแล็บรันบน VyOS จริงพร้อม auto-grade ด้วย ping6',
  level: 'intermediate',
  track: 'Networking',
  estimatedHours: 8,
  prerequisites: ['ผ่าน IP Subnetting หรือเทียบเท่า', 'ใช้ VyOS CLI ได้ (set/commit/show) และเข้าใจ routing พื้นฐาน'],
  published: true,
  modules: [
    // ── โมดูล 1 — IPv6 Addressing & SLAAC ───────────────────────────────
    {
      title: 'โมดูล 1 — IPv6 Addressing และ SLAAC',
      description: 'โครงสร้างที่อยู่ 128 บิต, ชนิดที่อยู่, EUI-64 และการ autoconfig ด้วย SLAAC',
      order: 0,
      objectives: [
        'อ่าน/ย่อที่อยู่ IPv6 และระบุชนิด (global unicast, link-local, ULA, multicast)',
        'อธิบาย EUI-64 และการทำ autoconfig ด้วย SLAAC ผ่าน Router Advertisement',
        'กำหนดที่อยู่ IPv6 บน VyOS และพิสูจน์การเชื่อมต่อด้วย ping6',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'โครงสร้างที่อยู่ IPv6, ชนิดที่อยู่ และ SLAAC',
          order: 0,
          estMinutes: 15,
          sections: [
            {
              heading: 'ทำไมต้อง IPv6 และรูปแบบที่อยู่',
              body: [
                'IPv4 มีที่อยู่ ~4.3 พันล้าน ซึ่งหมดไปแล้ว IPv6 ใช้ **128 บิต** ให้ที่อยู่มหาศาล (~3.4×10³⁸) พอสำหรับทุกอุปกรณ์บนโลกหลายเท่า',
                '',
                'เขียนเป็นเลขฐานสิบหก 8 กลุ่ม คั่นด้วย `:` เช่น `2001:0db8:0000:0000:0000:0000:0000:0001` ย่อได้ด้วยกฎสองข้อ:',
                '- ตัดเลข 0 นำหน้าในแต่ละกลุ่ม: `2001:db8:0:0:0:0:0:1`',
                '- ยุบกลุ่ม 0 ที่ติดกันด้วย `::` **ได้ครั้งเดียว**: `2001:db8::1`',
                '',
                'แบ่งครึ่ง: 64 บิตแรก = **network prefix**, 64 บิตหลัง = **interface ID** (ปกติ subnet เป็น `/64`)',
              ].join('\n'),
            },
            {
              heading: 'ชนิดที่อยู่ที่ต้องรู้จัก',
              body: [
                '| ชนิด | ช่วง | ใช้ทำอะไร |',
                '|---|---|---|',
                '| **Global Unicast** | `2000::/3` | ที่อยู่สาธารณะ routable บนอินเทอร์เน็ต |',
                '| **Link-Local** | `fe80::/10` | ใช้บนลิงก์เดียวเท่านั้น (ทุก interface มีเสมอ) |',
                '| **Unique Local (ULA)** | `fc00::/7` | ที่อยู่ภายในองค์กร (เทียบ private IPv4) |',
                '| **Multicast** | `ff00::/8` | ส่งหลายผู้รับ |',
                '| **Loopback** | `::1` | เทียบ 127.0.0.1 |',
                '',
                '> IPv6 **ไม่มี broadcast** — แทนที่ด้วย multicast เช่น `ff02::1` (all-nodes), `ff02::2` (all-routers) และใช้ **NDP (Neighbor Discovery)** แทน ARP',
                '',
                'link-local (`fe80::`) สำคัญมาก: โปรโตคอล routing อย่าง OSPFv3 คุยกันผ่าน link-local เป็น next-hop',
              ].join('\n'),
            },
            {
              heading: 'EUI-64 และ SLAAC',
              body: [
                '**EUI-64** สร้าง interface ID 64 บิตจาก MAC 48 บิต โดยแทรก `fffe` ตรงกลางและพลิกบิต U/L — ทำให้ที่อยู่อิงกับ MAC อัตโนมัติ',
                '',
                '**SLAAC (Stateless Address Autoconfiguration)** ให้ host ตั้งที่อยู่เองโดยไม่ต้องมี DHCP:',
                '1. host ส่ง **Router Solicitation (RS)** ถามว่า "prefix อะไร"',
                '2. router ตอบ **Router Advertisement (RA)** บอก prefix /64',
                '3. host เอา prefix + interface ID (EUI-64 หรือสุ่ม) ประกอบเป็นที่อยู่เต็ม',
                '',
                'บน VyOS เปิด RA ให้ฝั่ง LAN ทำ SLAAC ด้วย `set service router-advert interface ethN prefix <prefix>` — แล็บนี้เราจะกำหนดที่อยู่แบบ manual ก่อนเพื่อให้เห็นโครงสร้างชัด แล้วพิสูจน์ด้วย `ping6`',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — กำหนดที่อยู่ IPv6 และ ping6',
          order: 1,
          estMinutes: 25,
          description: 'กำหนดที่อยู่ IPv6 global unicast บนลิงก์ระหว่างสองเราเตอร์ และที่อยู่บน LAN จำลอง แล้วพิสูจน์การเชื่อมต่อด้วย ping6 ทั้ง global และ link-local',
          scenario: {
            from: 'พี่ต้น Network Architect',
            priority: 'medium',
            body: 'องค์กรเราต้องเริ่ม migrate ไป IPv6 แล้ว ISP จัดสรร prefix 2001:db8::/32 มาให้ อยากเริ่มจากต้นแบบสองเราเตอร์ก่อน ตั้งที่อยู่ IPv6 บนลิงก์เชื่อมและวง LAN ของแต่ละฝั่ง แล้วยืนยันว่า ping6 ถึงกันได้ ก่อนจะวางแผนทั้งระบบ',
          },
          objectives: [
            'กำหนดที่อยู่ IPv6 บนลิงก์ R1–R2 (2001:db8:12::/64)',
            'กำหนดที่อยู่ IPv6 บน LAN จำลอง (dummy) ของแต่ละเราเตอร์',
            'พิสูจน์ว่า R1 ping6 ถึงลิงก์และ LAN ของ R2 ได้',
          ],
          hints: [
            'โครงสร้าง: R1(eth1=2001:db8:12::1/64, dum0=2001:db8:1::1/64) — R2(eth1=2001:db8:12::2/64, dum0=2001:db8:2::1/64)',
            'ตั้งที่อยู่: `set interfaces ethernet eth1 address 2001:db8:12::1/64` และ `set interfaces dummy dum0 address 2001:db8:1::1/64`',
            'ตั้งเส้นทางให้ R1 รู้จักวง LAN ของ R2: `set protocols static route6 2001:db8:2::/64 next-hop 2001:db8:12::2` (และทำกลับด้านบน R2)',
            'ทดสอบ: `ping 2001:db8:12::2` (ลิงก์) และ `ping 2001:db8:2::1` (LAN ปลายทาง) — VyOS ใช้คำสั่ง ping เดียวกับ IPv6',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งที่อยู่ IPv6 บนลิงก์ eth1', node: 'R1', command: 'show configuration commands | match "eth1 address 2001"', expect: '2001:db8:12::1', points: 3,
              failHint: 'ยังไม่มีที่อยู่ IPv6 บน eth1 — `set interfaces ethernet eth1 address 2001:db8:12::1/64` (interface เดียวถือได้ทั้ง IPv4 และ IPv6 พร้อมกัน)' },
            { description: 'R1 ping6 ถึงลิงก์ของ R2 (2001:db8:12::2)', node: 'R1', command: 'ping 2001:db8:12::2 count 3', expect: 'bytes from 2001:db8:12::2', points: 3,
              failHint: 'ping6 ลิงก์ไม่ผ่าน — เช็คว่าทั้งสองฝั่งอยู่ /64 เดียวกัน (R1 ::1, R2 ::2) และ commit แล้ว ลองดู `show interfaces ethernet eth1` ว่ามี inet6 address ขึ้น' },
            { description: 'R1 ping6 ถึงวง LAN ของ R2 (2001:db8:2::1)', node: 'R1', command: 'ping 2001:db8:2::1 count 3', expect: 'bytes from 2001:db8:2::1', points: 4,
              failHint: 'ลิงก์ถึงแต่ LAN ปลายทางไม่ถึง — ต้องมี static route6 ไปยัง 2001:db8:2::/64 ผ่าน next-hop 2001:db8:12::2 และ R2 ต้องมี dum0 ถือ 2001:db8:2::1/64 จริง' },
          ],
        },
      ],
    },

    // ── โมดูล 2 — IPv6 Static Routing ───────────────────────────────────
    {
      title: 'โมดูล 2 — IPv6 Static Routing',
      description: 'เส้นทาง IPv6 แบบ static ข้ามหลายฮอป, NDP แทน ARP และ default route IPv6',
      order: 1,
      objectives: [
        'อธิบายว่า IPv6 ใช้ NDP แทน ARP อย่างไร',
        'ตั้ง static route6 เชื่อมเครือข่าย IPv6 ข้ามหลายเราเตอร์',
        'พิสูจน์การเชื่อมต่อ end-to-end ด้วย ping6',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'NDP, Static Route6 และ Default Route',
          order: 0,
          estMinutes: 11,
          sections: [
            {
              heading: 'NDP: ตัวแทน ARP ของ IPv6',
              body: [
                'IPv6 ไม่มี ARP แต่ใช้ **NDP (Neighbor Discovery Protocol)** ซึ่งทำงานบน ICMPv6 และทำได้มากกว่า ARP:',
                '',
                '- **Neighbor Solicitation/Advertisement (NS/NA)** — หา MAC จาก IPv6 (เทียบ ARP request/reply)',
                '- **Router Solicitation/Advertisement (RS/RA)** — หา router และรับ prefix (พื้นฐานของ SLAAC)',
                '- **Duplicate Address Detection (DAD)** — เช็คว่าที่อยู่ที่จะใช้ซ้ำกับใครไหมก่อนใช้จริง',
                '',
                'ดูตาราง neighbor (เทียบ ARP table) ด้วย `show ipv6 neighbors`',
              ].join('\n'),
            },
            {
              heading: 'Static Route6 และ Default Route',
              body: [
                'การตั้ง static route ของ IPv6 บน VyOS ใช้คำสั่ง **route6** (แยกจาก route ของ IPv4):',
                '',
                '```',
                'set protocols static route6 2001:db8:3::/64 next-hop 2001:db8:23::3',
                'set protocols static route6 ::/0 next-hop 2001:db8:12::2     # default route',
                '```',
                '',
                '`::/0` คือ default route ของ IPv6 (เทียบ 0.0.0.0/0) next-hop มักเป็นที่อยู่ของเราเตอร์ฮอปถัดไป (จะใช้ global หรือ link-local ก็ได้ — ถ้าใช้ link-local ต้องระบุ interface ด้วย)',
                '',
                'ตรวจตาราง routing IPv6 ด้วย `show ipv6 route`',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — Static Route6 ข้ามสามเราเตอร์',
          order: 1,
          estMinutes: 30,
          description: 'เชื่อมสามเราเตอร์เป็นแนวเส้นตรงด้วย IPv6 แล้วตั้ง static route6 ให้ปลายทั้งสองข้าง (LAN ของ R1 และ R3) ping6 ถึงกันได้ผ่าน R2 ตรงกลาง',
          scenario: {
            from: 'พี่เบียร์ หัวหน้าฝ่าย IT',
            priority: 'medium',
            body: 'ต้นแบบ IPv6 สองตัวเวิร์กแล้ว รอบนี้ขยายเป็นสามสาขาเรียงต่อกัน สาขาต้นกับสาขาปลายต้องคุยกันผ่านสาขากลาง ยังไม่ต้องลง dynamic routing ขอใช้ static route6 ไปก่อนให้เห็นว่าเส้นทาง IPv6 ข้ามหลายฮอปทำงานได้ แล้วพิสูจน์ด้วย ping6 จากปลายถึงปลาย',
          },
          objectives: [
            'ตั้งที่อยู่ IPv6 บนสองลิงก์ (R1–R2 และ R2–R3) และ LAN ปลายทั้งสอง',
            'ตั้ง static route6 บนทุกเราเตอร์ให้เส้นทางครบทั้งไปและกลับ',
            'พิสูจน์ว่า R1 ping6 ถึงวง LAN ของ R3 (2001:db8:3::1) ได้',
          ],
          hints: [
            'โครงสร้าง: R1(dum0=2001:db8:1::1/64, eth1=2001:db8:12::1/64) — R2(eth1=2001:db8:12::2/64, eth2=2001:db8:23::2/64) — R3(eth1=2001:db8:23::3/64, dum0=2001:db8:3::1/64)',
            'R1: `set protocols static route6 2001:db8:3::/64 next-hop 2001:db8:12::2` (และ route6 2001:db8:23::/64 ผ่าน ::2 ถ้าต้องการ)',
            'R2 เป็นตัวกลาง — รู้จักทั้งสองลิงก์อยู่แล้ว (connected) แต่ต้องมี route6 ไป 2001:db8:1::/64 (ผ่าน ::1) และ 2001:db8:3::/64 (ผ่าน ::3)',
            'R3: route6 กลับไป 2001:db8:1::/64 ผ่าน next-hop 2001:db8:23::2 — แล้วทดสอบ `ping 2001:db8:3::1` จาก R1',
          ],
          topology: {
            nodes: [ vyos('R1', -300, 0), vyos('R2', 0, 0), vyos('R3', 300, 0) ],
            links: [
              { node1: 'R1', port1: 1, node2: 'R2', port2: 1 },
              { node1: 'R2', port1: 2, node2: 'R3', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'R1 มี static route6 ไปยังวง LAN ของ R3', node: 'R1', command: 'show configuration commands | match "route6 2001:db8:3"', expect: '2001:db8:3::/64', points: 3,
              failHint: 'R1 ยังไม่มีเส้นทางไป 2001:db8:3::/64 — `set protocols static route6 2001:db8:3::/64 next-hop 2001:db8:12::2` (next-hop คือ R2 ฮอปถัดไป)' },
            { description: 'R3 ในเส้นทาง routing IPv6 รู้จักวง LAN ของ R1', node: 'R3', command: 'show ipv6 route | match 2001:db8:1', expect: '2001:db8:1::', points: 3,
              failHint: 'R3 ยังไม่รู้ทางกลับไป 2001:db8:1::/64 — ถ้าไม่มี route กลับ echo reply จะหาย: `set protocols static route6 2001:db8:1::/64 next-hop 2001:db8:23::2`' },
            { description: 'R1 ping6 ถึงวง LAN ของ R3 (2001:db8:3::1) end-to-end', node: 'R1', command: 'ping 2001:db8:3::1 count 3', expect: 'bytes from 2001:db8:3::1', points: 4,
              failHint: 'ping6 ปลายทางไม่ถึง — ต้องครบทั้งไปและกลับ: R1→R3 มี route ไป 2001:db8:3::/64 และ R3→R1 มี route กลับ 2001:db8:1::/64 ส่วน R2 ตรงกลางต้องรู้จักทั้งสองวง LAN' },
          ],
        },
      ],
    },

    // ── โมดูล 3 — OSPFv3 ────────────────────────────────────────────────
    {
      title: 'โมดูล 3 — OSPFv3 (OSPF สำหรับ IPv6)',
      description: 'dynamic routing ของ IPv6 ด้วย OSPFv3 และความต่างจาก OSPFv2',
      order: 2,
      objectives: [
        'อธิบายความต่างของ OSPFv3 จาก OSPFv2 (ทำงานต่อลิงก์, ใช้ link-local, router-id ยัง 32 บิต)',
        'ตั้ง OSPFv3 บน VyOS ให้สองเราเตอร์แลกเส้นทาง IPv6',
        'พิสูจน์ว่าเรียนรู้เส้นทาง IPv6 ผ่าน OSPFv3 และ ping6 ถึงได้',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'OSPFv3: อะไรเหมือน อะไรต่างจาก OSPFv2',
          order: 0,
          estMinutes: 10,
          sections: [
            {
              heading: 'แนวคิดเดิม กลไกเดิม',
              body: [
                'OSPFv3 คือ OSPF เวอร์ชันสำหรับ IPv6 หัวใจเหมือน OSPFv2 ทุกอย่าง: link-state, area, LSDB, อัลกอริทึม SPF, การเป็น neighbor ไล่ผ่าน `Down → … → Full` และยังใช้ **cost** เป็น metric',
                '',
                'ถ้าเข้าใจ OSPFv2 (จากคอร์ส OSPF Hands-On) มาแล้ว แนวคิดเหล่านี้ยกมาใช้ได้เลย',
              ].join('\n'),
            },
            {
              heading: 'ความต่างที่ต้องจำ',
              body: [
                '- **ทำงานต่อ "ลิงก์" ไม่ใช่ต่อ "subnet"** — เปิด OSPFv3 ที่ interface โดยตรง (ใน OSPFv2 เราประกาศ network prefix)',
                '- **คุยกันด้วย link-local** — เพื่อนบ้านและ next-hop ใช้ที่อยู่ `fe80::` ของ interface',
                '- **router-id ยังเป็น 32 บิต** (รูปแบบเหมือน IPv4 เช่น 1.1.1.1) ต้องตั้งเองเสมอเพราะอาจไม่มีที่อยู่ IPv4 ให้หยิบ',
                '- **ความปลอดภัย** ใช้ IPsec ของ IPv6 แทน authentication ในตัว',
                '',
                'บน VyOS เปิด OSPFv3 ที่ interface ภายใต้ area:',
                '',
                '```',
                'set protocols ospfv3 parameters router-id 1.1.1.1',
                'set protocols ospfv3 interface eth1 area 0',
                'set protocols ospfv3 interface dum0 area 0',
                '```',
                '',
                '> บางรุ่นใช้รูปแบบ `set protocols ospfv3 interface eth1 area 0` — ถ้ารูปแบบหนึ่ง commit ไม่ผ่าน ให้ลองอีกแบบ การให้คะแนนวัดที่ผลลัพธ์ (เรียนรู้เส้นทาง + ping6) ไม่ผูกกับสตริงคำสั่ง',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — OSPFv3 แลกเส้นทาง IPv6',
          order: 1,
          estMinutes: 30,
          description: 'ตั้ง OSPFv3 ระหว่างสองเราเตอร์ให้เรียนรู้วง LAN IPv6 ของกันและกันอัตโนมัติ แทนการตั้ง static route แล้วพิสูจน์ด้วย ping6',
          scenario: {
            from: 'พี่ต้น Network Architect',
            priority: 'high',
            body: 'static route6 เริ่มไม่ไหวแล้ว ทุกครั้งที่เพิ่มวง IPv6 ต้องไล่แก้ทุกเราเตอร์ เหมือนตอน IPv4 เป๊ะ เปลี่ยนมาใช้ dynamic routing สำหรับ IPv6 เถอะ ตั้ง OSPFv3 ให้สองเราเตอร์เรียนรู้วง LAN ของกันเองอัตโนมัติ ถ้าเวิร์กจะขยายทั้งโดเมน IPv6',
          },
          objectives: [
            'ตั้ง OSPFv3 area 0 บน R1 และ R2 ครอบลิงก์เชื่อมและ LAN ของแต่ละฝั่ง',
            'ให้ R1 เรียนรู้วง LAN IPv6 ของ R2 ผ่าน OSPFv3 (ไม่ใช้ static)',
            'พิสูจน์ว่า R1 ping6 ถึงวง LAN ของ R2 ได้',
          ],
          hints: [
            'โครงสร้าง: R1(eth1=2001:db8:12::1/64, dum0=2001:db8:1::1/64) — R2(eth1=2001:db8:12::2/64, dum0=2001:db8:2::1/64) — ตั้งที่อยู่ IPv6 ให้ครบก่อน',
            'R1: `set protocols ospfv3 parameters router-id 1.1.1.1` · `set protocols ospfv3 interface eth1 area 0` · `set protocols ospfv3 interface dum0 area 0`',
            'R2 ทำเหมือนกัน (router-id 2.2.2.2) — เปิด OSPFv3 ที่ interface ที่ต้องการให้เรียนรู้/โฆษณา',
            'ห้ามตั้ง static route6 ของวง LAN ปลายทาง — ปล่อยให้ OSPFv3 เรียนรู้เอง แล้วตรวจ `show ipv6 route` ว่ามี 2001:db8:2::/64 และ `ping 2001:db8:2::1`',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          gradingChecks: [
            { description: 'R1 ตั้งค่า OSPFv3', node: 'R1', command: 'show configuration commands | match ospfv3', expect: 'ospfv3', points: 3,
              failHint: 'ยังไม่มี OSPFv3 — เปิดที่ interface: `set protocols ospfv3 interface eth1 area 0` และตั้ง router-id ด้วย (OSPFv3 ต้องมี router-id เสมอ)' },
            { description: 'R1 เรียนรู้วง LAN ของ R2 ผ่าน OSPFv3 (2001:db8:2::/64)', node: 'R1', command: 'show ipv6 route | match 2001:db8:2', expect: '2001:db8:2::', points: 4,
              failHint: 'R1 ยังไม่เรียนรู้เส้นทาง — เช็คว่าทั้งสองฝั่งเปิด OSPFv3 บนลิงก์ eth1 ใน area เดียวกัน, ตั้ง router-id แล้ว และ R2 เปิด OSPFv3 บน dum0 เพื่อโฆษณาวง LAN ของตัวเอง' },
            { description: 'R1 ping6 ถึงวง LAN ของ R2 (2001:db8:2::1)', node: 'R1', command: 'ping 2001:db8:2::1 count 3', expect: 'bytes from 2001:db8:2::1', points: 3,
              failHint: 'เส้นทางมาแล้วแต่ ping6 ไม่ถึง — เช็คว่า R2 มี dum0 ถือ 2001:db8:2::1/64 จริง และ R2 เรียนรู้เส้นทางกลับไป 2001:db8:1::/64 ผ่าน OSPFv3 เช่นกัน' },
          ],
        },
      ],
    },

    // ── โมดูล 4 — DHCPv6 และ Transition ─────────────────────────────────
    {
      title: 'โมดูล 4 — DHCPv6 และเทคนิค Transition',
      description: 'DHCPv6 แบบ stateful/stateless, dual-stack และการเปลี่ยนผ่าน IPv4→IPv6',
      order: 3,
      objectives: [
        'แยกความต่างของ SLAAC, stateless DHCPv6 และ stateful DHCPv6',
        'อธิบายแนวทาง dual-stack เป็นกลยุทธ์ transition หลัก',
        'อธิบายแนวคิด NAT64/DNS64 และ tunneling สำหรับการเปลี่ยนผ่าน',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'DHCPv6, Dual-Stack และ NAT64',
          order: 0,
          estMinutes: 12,
          sections: [
            {
              heading: 'สามวิธีที่ host ได้ที่อยู่ IPv6',
              body: [
                '- **SLAAC** — host ตั้งที่อยู่เองจาก prefix ใน RA ไม่ต้องมี server (ดูโมดูล 1) แต่ไม่ได้แจกข้อมูลเสริมเช่น DNS โดยตรง',
                '- **Stateless DHCPv6** — ใช้ SLAAC ตั้งที่อยู่ แต่ขอ "ข้อมูลเสริม" (DNS server, domain) จาก DHCPv6 server (ธง O ใน RA)',
                '- **Stateful DHCPv6** — server แจกทั้งที่อยู่และข้อมูลเสริม และจดจำว่าใครได้อะไร (ธง M ใน RA) เทียบ DHCP ของ IPv4',
                '',
                'RA มีธงสองตัวบอก host ว่าให้ทำแบบไหน: **M (Managed)** = ใช้ stateful, **O (Other)** = ใช้ stateless เอาแค่ข้อมูลเสริม',
                '',
                'บน VyOS: stateful ใช้ `set service dhcpv6-server ...`',
              ].join('\n'),
            },
            {
              heading: 'Dual-Stack: กลยุทธ์หลักของการเปลี่ยนผ่าน',
              body: [
                'เราไม่ได้ปิด IPv4 แล้วเปิด IPv6 ในวันเดียว แต่ให้ทั้งสองทำงานคู่กันไปก่อน — เรียก **dual-stack**: ทุก interface ถือทั้งที่อยู่ IPv4 และ IPv6 พร้อมกัน แอปไหนรองรับ IPv6 ก็วิ่ง IPv6 ที่เหลือยังใช้ IPv4 ได้',
                '',
                'เป็นวิธีที่ "ปลอดภัยและนิยมที่สุด" เพราะไม่ต้องแปลง protocol และค่อย ๆ เลิกใช้ IPv4 เมื่อพร้อม — ในแล็บก่อนหน้าเราก็ทำ dual-stack อยู่แล้ว (interface เดียวมีทั้ง IPv4 และ IPv6)',
              ].join('\n'),
            },
            {
              heading: 'เมื่อ Dual-Stack ไม่พอ: NAT64 และ Tunneling',
              body: [
                'บางกรณีฝั่งหนึ่งมีแค่ IPv6 อีกฝั่งมีแค่ IPv4 ต้องมีตัวกลางแปลง:',
                '',
                '- **NAT64 + DNS64** — แปลงทราฟฟิก IPv6 ↔ IPv4 ให้ client ที่มีแต่ IPv6 เข้าถึงเซิร์ฟเวอร์ IPv4 ได้ (DNS64 สังเคราะห์ AAAA record ปลอมชี้เข้า NAT64)',
                '- **Tunneling (6to4, 6in4, GRE)** — ห่อแพ็กเก็ต IPv6 ไว้ในแพ็กเก็ต IPv4 เพื่อข้ามเครือข่ายที่ยังเป็น IPv4 ล้วน',
                '',
                '> ลำดับความนิยม: dual-stack มาก่อนเสมอ ใช้ NAT64/tunneling เฉพาะเมื่อ dual-stack ทำไม่ได้',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — DHCPv6 และ Transition',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'วิธีที่ host ตั้งที่อยู่ IPv6 เองจาก prefix ใน Router Advertisement โดยไม่ต้องมี server เรียกว่าอะไร',
              choices: ['Stateful DHCPv6', 'SLAAC', 'NAT64', 'DNS64'],
              answer: [1],
              explanation: 'SLAAC ให้ host ประกอบที่อยู่เองจาก prefix ใน RA + interface ID โดยไม่ต้องมี DHCP server',
              points: 1,
            },
            {
              prompt: 'กลยุทธ์การเปลี่ยนผ่าน IPv4→IPv6 ที่นิยมและปลอดภัยที่สุดคือข้อใด',
              choices: ['ปิด IPv4 ทันที', 'Dual-stack (ใช้ทั้งสองคู่กัน)', 'NAT64 เท่านั้น', '6to4 tunnel เท่านั้น'],
              answer: [1],
              explanation: 'Dual-stack ให้ทั้ง IPv4 และ IPv6 ทำงานพร้อมกัน เปลี่ยนผ่านได้ราบรื่นโดยไม่ต้องแปลง protocol',
              points: 1,
            },
            {
              prompt: 'ใน Router Advertisement ธง M (Managed) ที่ตั้งค่าไว้บอก host ให้ทำอะไร',
              choices: [
                'ใช้ SLAAC ตั้งที่อยู่เอง',
                'ใช้ stateful DHCPv6 ขอทั้งที่อยู่และข้อมูลจาก server',
                'ปิด IPv6',
                'ใช้ link-local เท่านั้น',
              ],
              answer: [1],
              explanation: 'ธง M = Managed บอกให้ host ใช้ stateful DHCPv6 (ขอที่อยู่จาก server) ส่วนธง O = ขอแค่ข้อมูลเสริม',
              points: 1,
            },
            {
              prompt: 'เทคโนโลยีใดช่วยให้ client ที่มีแต่ IPv6 เข้าถึงเซิร์ฟเวอร์ที่มีแต่ IPv4 ได้',
              choices: ['SLAAC', 'NAT64 + DNS64', 'EUI-64', 'NDP'],
              answer: [1],
              explanation: 'NAT64 แปลงทราฟฟิก IPv6↔IPv4 ทำงานคู่กับ DNS64 ที่สังเคราะห์ AAAA record ชี้เข้า NAT64',
              points: 1,
            },
          ],
        },
      ],
    },
  ],
};
