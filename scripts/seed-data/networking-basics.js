// Networking Basics — ระดับเริ่มต้น
// คอร์สแม่แบบที่สมบูรณ์: บทเรียนทฤษฎี + แบบทดสอบ + แล็บ VPCS จริงครบทุกโมดูล

export default {
  title: 'Networking Basics — พื้นฐานเครือข่าย',
  description: 'เริ่มต้นจากศูนย์: เครือข่ายคืออะไร อุปกรณ์มีอะไรบ้าง IP address ทำงานอย่างไร พร้อมลงมือตั้งค่าและ ping บน Topology จริง',
  level: 'beginner',
  track: 'Networking',
  estimatedHours: 6,
  prerequisites: ['ใช้งานคอมพิวเตอร์เบื้องต้นได้', 'ไม่จำเป็นต้องมีพื้นฐานเครือข่ายมาก่อน'],
  published: true,
  modules: [
    // ── Module 1 ───────────────────────────────────────────────
    {
      title: 'โมดูล 1 — เครือข่ายและการสื่อสาร',
      description: 'ทำความเข้าใจว่าเครือข่ายคืออะไร และอุปกรณ์ต่าง ๆ ทำงานร่วมกันอย่างไร',
      order: 0,
      objectives: [
        'อธิบายได้ว่าเครือข่ายคอมพิวเตอร์คืออะไรและมีประโยชน์อย่างไร',
        'ระบุอุปกรณ์หลักในเครือข่าย (host, switch, router) และหน้าที่ของแต่ละชนิด',
        'เข้าใจแนวคิดของ protocol และการสื่อสารแบบ end-to-end',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'เครือข่ายคอมพิวเตอร์คืออะไร',
          order: 0,
          estMinutes: 8,
          sections: [
            {
              heading: 'นิยามและประโยชน์',
              body: [
                'เครือข่ายคอมพิวเตอร์ (computer network) คือกลุ่มของอุปกรณ์ตั้งแต่สองตัวขึ้นไปที่เชื่อมต่อกันเพื่อ **แลกเปลี่ยนข้อมูล** และ **ใช้ทรัพยากรร่วมกัน** เช่น ไฟล์ เครื่องพิมพ์ หรืออินเทอร์เน็ต',
                '',
                'ประโยชน์หลักของเครือข่าย:',
                '- **แชร์ข้อมูล** — ส่งไฟล์และข้อความถึงกันได้ทันที',
                '- **แชร์ทรัพยากร** — ใช้เครื่องพิมพ์หรือพื้นที่จัดเก็บร่วมกัน',
                '- **สื่อสาร** — อีเมล วิดีโอคอล แชต',
                '- **เข้าถึงบริการ** — เว็บไซต์ คลาวด์ และแอปต่าง ๆ',
              ].join('\n'),
            },
            {
              heading: 'ขนาดของเครือข่าย',
              body: [
                'เราแบ่งเครือข่ายตามขอบเขตทางภูมิศาสตร์ได้คร่าว ๆ ดังนี้',
                '',
                '| ประเภท | ขอบเขต | ตัวอย่าง |',
                '|--------|--------|----------|',
                '| LAN | พื้นที่เล็ก เช่น บ้าน/ออฟฟิศ | เครือข่ายในบ้านของคุณ |',
                '| WAN | ข้ามเมือง/ประเทศ | อินเทอร์เน็ต |',
                '',
                '> ในคอร์สนี้เราจะโฟกัสที่ **LAN** เป็นหลัก เพราะเป็นพื้นฐานของทุกเครือข่าย',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'reading',
          title: 'อุปกรณ์ในเครือข่ายและหน้าที่',
          order: 1,
          estMinutes: 10,
          sections: [
            {
              heading: 'Host, Switch และ Router',
              body: [
                'อุปกรณ์ในเครือข่ายมีบทบาทต่างกัน เปรียบได้กับระบบไปรษณีย์:',
                '',
                '- **Host (เครื่องปลายทาง)** — คอมพิวเตอร์ โทรศัพท์ เซิร์ฟเวอร์ ที่เป็น *ผู้ส่ง* หรือ *ผู้รับ* ข้อมูล แต่ละ host มีที่อยู่ (IP address) ของตัวเอง',
                '- **Switch (สวิตช์)** — กระจายข้อมูลภายในเครือข่ายเดียวกัน (LAN) ทำหน้าที่ส่ง frame ไปยังเครื่องปลายทางที่ถูกต้องภายใน broadcast domain เดียวกัน',
                '- **Router (เราเตอร์)** — เชื่อมต่อ *คนละเครือข่าย* เข้าด้วยกัน และเลือกเส้นทาง (route) ที่ดีที่สุดให้ข้อมูลเดินทางข้ามเครือข่าย',
                '',
                'สรุปง่าย ๆ: **switch เชื่อมเครื่องในบ้านเดียวกัน, router เชื่อมบ้านคนละหลัง**',
              ].join('\n'),
            },
            {
              heading: 'สื่อกลางและ Protocol',
              body: [
                'ข้อมูลต้องเดินทางผ่าน **สื่อกลาง (media)** เช่น สายทองแดง สายไฟเบอร์ หรือคลื่นวิทยุ (Wi-Fi)',
                '',
                'และเพื่อให้อุปกรณ์ต่างยี่ห้อคุยกันรู้เรื่อง ทุกฝ่ายต้องใช้ **protocol** ชุดเดียวกัน — protocol คือ "กฎ" ที่กำหนดรูปแบบและลำดับของการสื่อสาร เช่น `IP`, `TCP`, `HTTP`',
                '',
                'เปรียบเหมือนคนสองคนจะคุยกันได้ ต้องพูดภาษาเดียวกัน 🗣️',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบท้ายโมดูล 1',
          order: 2,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'อุปกรณ์ใดทำหน้าที่เชื่อมต่อ **คนละเครือข่าย** เข้าด้วยกันและเลือกเส้นทางให้ข้อมูล',
              choices: ['Switch', 'Router', 'Host', 'สายไฟเบอร์'],
              answer: [1],
              explanation: 'Router เชื่อมต่อระหว่างเครือข่ายที่ต่างกันและทำการ route ข้อมูล ส่วน switch ใช้ภายใน LAN เดียวกัน',
              points: 1,
            },
            {
              prompt: '"Protocol" ในเครือข่ายหมายถึงอะไร',
              choices: [
                'ยี่ห้อของอุปกรณ์เครือข่าย',
                'ชุดกฎที่กำหนดรูปแบบและลำดับการสื่อสาร',
                'ความเร็วของสายแลน',
                'ชื่อของผู้ดูแลระบบ',
              ],
              answer: [1],
              explanation: 'Protocol คือกฎที่ทำให้อุปกรณ์ต่างผู้ผลิตสื่อสารกันได้ เช่น IP, TCP, HTTP',
              points: 1,
            },
            {
              prompt: 'ข้อใดเป็นตัวอย่างของ host (เลือกได้มากกว่า 1 ข้อ)',
              choices: ['แล็ปท็อป', 'สวิตช์ 24 พอร์ต', 'เซิร์ฟเวอร์เว็บ', 'สมาร์ตโฟน'],
              answer: [0, 2, 3],
              explanation: 'host คือเครื่องปลายทางที่ส่ง/รับข้อมูล ได้แก่ แล็ปท็อป เซิร์ฟเวอร์ และสมาร์ตโฟน ส่วนสวิตช์เป็นอุปกรณ์ตัวกลาง',
              points: 2,
            },
          ],
        },
      ],
    },

    // ── Module 2 ───────────────────────────────────────────────
    {
      title: 'โมดูล 2 — IP Address และการ Ping',
      description: 'รู้จัก IP address, subnet mask และพิสูจน์การเชื่อมต่อด้วย ping บนแล็บจริง',
      order: 1,
      objectives: [
        'อธิบายโครงสร้างของ IPv4 address และ subnet mask',
        'ตั้งค่า IP บนเครื่อง host ได้',
        'ใช้คำสั่ง ping เพื่อตรวจสอบการเชื่อมต่อ',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'IPv4 Address และ Subnet Mask',
          order: 0,
          estMinutes: 12,
          sections: [
            {
              heading: 'โครงสร้างของ IPv4',
              body: [
                'IPv4 address คือตัวเลข 32 บิต เขียนเป็น 4 ชุด (octet) คั่นด้วยจุด แต่ละชุดมีค่า 0–255 เช่น',
                '',
                '```',
                '192.168.1.10',
                '```',
                '',
                'IP address แบ่งออกเป็นสองส่วน:',
                '- **Network part** — ระบุว่าเครื่องอยู่ในเครือข่ายใด',
                '- **Host part** — ระบุตัวเครื่องภายในเครือข่ายนั้น',
                '',
                'ตัวที่บอกว่าส่วนไหนคือ network ส่วนไหนคือ host ก็คือ **subnet mask**',
              ].join('\n'),
            },
            {
              heading: 'Subnet Mask และ Prefix',
              body: [
                'Subnet mask เช่น `255.255.255.0` บอกว่า 3 octet แรกเป็น network และ octet สุดท้ายเป็น host',
                '',
                'เรามักเขียนแบบย่อด้วย **prefix** เป็นจำนวนบิตของ network เช่น `/24`',
                '',
                '| Subnet mask | Prefix | จำนวน host ใช้งานได้ |',
                '|-------------|--------|----------------------|',
                '| 255.255.255.0 | /24 | 254 |',
                '| 255.255.255.192 | /26 | 62 |',
                '',
                'กฎสำคัญ: **เครื่องสองตัวจะคุยกันตรง ๆ ได้ ต้องอยู่ใน network เดียวกัน** (network part ตรงกันและ mask เดียวกัน)',
              ].join('\n'),
            },
            {
              heading: 'คำสั่งบน VPCS',
              body: [
                'ในแล็บเราใช้ VPCS (Virtual PC Simulator) ตั้งค่า IP ด้วยคำสั่งเดียว:',
                '',
                '```',
                'ip 192.168.1.1 255.255.255.0',
                '```',
                '',
                'แล้วตรวจค่าที่ตั้งด้วย `show ip` และทดสอบการเชื่อมต่อด้วย `ping`',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'reading',
          title: 'การ Ping ทำงานอย่างไร',
          order: 1,
          estMinutes: 6,
          sections: [
            {
              heading: 'ICMP Echo',
              body: [
                '`ping` ส่งข้อความ **ICMP Echo Request** ไปยังปลายทาง ถ้าปลายทางได้รับก็จะตอบกลับด้วย **Echo Reply**',
                '',
                'ถ้าเห็นข้อความทำนอง `bytes from 192.168.1.2` แสดงว่าเชื่อมต่อสำเร็จ ✅',
                '',
                'ถ้า ping ไม่ผ่าน ให้ตรวจสอบตามลำดับ:',
                '1. IP/mask ของทั้งสองเครื่องอยู่ใน network เดียวกันหรือไม่ (`show ip`)',
                '2. สายเชื่อมต่อครบหรือไม่',
                '3. host part ซ้ำกันหรือไม่',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — Basic IP & Ping',
          order: 2,
          estMinutes: 25,
          description: 'ตั้งค่า IP address บน PC สองตัวที่อยู่ใน subnet เดียวกัน แล้วทดสอบการเชื่อมต่อด้วย ping',
          objectives: [
            'ตั้งค่า IP 192.168.1.1/24 บน PC1',
            'ตั้งค่า IP 192.168.1.2/24 บน PC2',
            'Ping จาก PC1 ไปยัง PC2 ได้สำเร็จ',
            'Ping จาก PC2 ไปยัง PC1 ได้สำเร็จ',
          ],
          hints: [
            'ใช้คำสั่ง `ip 192.168.1.1 255.255.255.0` บน VPCS เพื่อตั้งค่า IP',
            'ใช้คำสั่ง `ping 192.168.1.2` เพื่อทดสอบ connectivity',
            'ถ้า ping ไม่ผ่านให้ตรวจสอบว่า IP อยู่ใน subnet เดียวกัน',
          ],
          topology: {
            nodes: [
              { name: 'PC1', nodeType: 'vpcs', x: -150, y: 0 },
              { name: 'PC2', nodeType: 'vpcs', x: 150, y: 0 },
              { name: 'SW1', nodeType: 'ethernet_switch', x: 0, y: 0 },
            ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
              { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'PC1 มี IP 192.168.1.1/24', node: 'PC1', command: 'show ip', expect: '192\\.168\\.1\\.1', points: 2 },
            { description: 'PC2 มี IP 192.168.1.2/24', node: 'PC2', command: 'show ip', expect: '192\\.168\\.1\\.2', points: 2 },
            { description: 'PC1 ping PC2 ได้สำเร็จ', node: 'PC1', command: 'ping 192.168.1.2', expect: 'bytes from 192\\.168\\.1\\.2', points: 3 },
            { description: 'PC2 ping PC1 ได้สำเร็จ', node: 'PC2', command: 'ping 192.168.1.1', expect: 'bytes from 192\\.168\\.1\\.1', points: 3 },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบท้ายโมดูล 2',
          order: 3,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'IPv4 address มีขนาดกี่บิต',
              choices: ['16 บิต', '32 บิต', '48 บิต', '64 บิต'],
              answer: [1],
              explanation: 'IPv4 มีขนาด 32 บิต แบ่งเป็น 4 octet ละ 8 บิต',
              points: 1,
            },
            {
              prompt: 'เครื่อง A = 192.168.1.10/24 และเครื่อง B = 192.168.2.10/24 จะ ping กันตรง ๆ ได้หรือไม่ (ไม่มี router)',
              choices: ['ได้ เพราะ IP คล้ายกัน', 'ไม่ได้ เพราะอยู่คนละ network', 'ได้เสมอ', 'ขึ้นกับยี่ห้อสวิตช์'],
              answer: [1],
              explanation: 'ด้วย mask /24 network part คือ 3 octet แรก 192.168.1 กับ 192.168.2 ต่างกัน จึงเป็นคนละ network ต้องมี router ถึงจะคุยกันได้',
              points: 2,
            },
            {
              prompt: 'คำสั่ง ping ใช้ protocol ใดในการตรวจสอบการเชื่อมต่อ',
              choices: ['HTTP', 'ICMP', 'FTP', 'DNS'],
              answer: [1],
              explanation: 'ping ใช้ ICMP Echo Request/Reply',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── Module 3 ───────────────────────────────────────────────
    {
      title: 'โมดูล 3 — หลาย Subnet และ Broadcast Domain',
      description: 'เข้าใจว่าทำไมเครื่องคนละ subnet ถึงคุยกันไม่ได้ถ้าไม่มี router',
      order: 2,
      objectives: [
        'อธิบายแนวคิด broadcast domain',
        'เข้าใจว่า switch ไม่สามารถ route ข้าม subnet ได้',
        'ทดลองสังเกตพฤติกรรมการ ping ภายในและข้าม subnet',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Broadcast Domain และข้อจำกัดของ Switch',
          order: 0,
          estMinutes: 9,
          sections: [
            {
              heading: 'Broadcast Domain คืออะไร',
              body: [
                '**Broadcast domain** คือขอบเขตที่ข้อความแบบ broadcast เดินทางไปถึงได้ โดยปกติ switch หนึ่งตัว (หรือหลายตัวที่ต่อกัน) จะเป็น broadcast domain เดียวกัน',
                '',
                'เครื่องใน broadcast domain เดียวกันและ subnet เดียวกัน **คุยกันได้โดยตรง** ผ่าน switch',
                '',
                'แต่ switch ทำงานที่ Layer 2 (MAC address) เท่านั้น มัน**ไม่เข้าใจ IP network** จึงไม่สามารถส่งข้อมูลข้ามไปยัง subnet อื่นได้',
              ].join('\n'),
            },
            {
              heading: 'ทำไมต้องมี Router',
              body: [
                'เมื่อปลายทางอยู่คนละ subnet เครื่องต้นทางจะส่งข้อมูลไปยัง **default gateway** (ปกติคือ router) เพื่อให้ router เลือกเส้นทางต่อไป',
                '',
                'ในแล็บโมดูลนี้ยัง*ไม่มี* router เราจึงจะได้เห็นกับตาว่า เครื่องคนละ subnet **ping ไม่ถึงกัน** — นี่คือเหตุผลว่าทำไมเราต้องเรียนเรื่อง routing ต่อไป',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — Multiple Subnets',
          order: 1,
          estMinutes: 25,
          description: 'PC สองกลุ่มอยู่คนละ subnet เชื่อมกันผ่าน Switch แยก ฝึกเข้าใจ broadcast domain',
          objectives: [
            'ตั้งค่า PC1 (192.168.1.1/24) และ PC2 (192.168.1.2/24) บน SW1',
            'ตั้งค่า PC3 (10.0.0.1/24) และ PC4 (10.0.0.2/24) บน SW2',
            'Ping ภายใน subnet เดียวกันได้',
            'สังเกตว่า ping ข้าม subnet ไม่ได้ (เพราะไม่มี router)',
          ],
          hints: [
            'VPCS ไม่สามารถ route ข้าม subnet ได้โดยตรง — ต้องมี router',
            'ทดลอง `ping 192.168.1.2` จาก PC1 กับ `ping 10.0.0.1` จาก PC1 แล้วสังเกตผลต่าง',
          ],
          topology: {
            nodes: [
              { name: 'PC1', nodeType: 'vpcs', x: -250, y: -80 },
              { name: 'PC2', nodeType: 'vpcs', x: -250, y: 80 },
              { name: 'PC3', nodeType: 'vpcs', x: 250, y: -80 },
              { name: 'PC4', nodeType: 'vpcs', x: 250, y: 80 },
              { name: 'SW1', nodeType: 'ethernet_switch', x: -100, y: 0 },
              { name: 'SW2', nodeType: 'ethernet_switch', x: 100, y: 0 },
            ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
              { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
              { node1: 'PC3', port1: 0, node2: 'SW2', port2: 0 },
              { node1: 'PC4', port1: 0, node2: 'SW2', port2: 1 },
            ],
          },
          gradingChecks: [
            { description: 'PC1 มี IP 192.168.1.1/24', node: 'PC1', command: 'show ip', expect: '192\\.168\\.1\\.1', points: 1 },
            { description: 'PC2 มี IP 192.168.1.2/24', node: 'PC2', command: 'show ip', expect: '192\\.168\\.1\\.2', points: 1 },
            { description: 'PC3 มี IP 10.0.0.1/24', node: 'PC3', command: 'show ip', expect: '10\\.0\\.0\\.1', points: 1 },
            { description: 'PC4 มี IP 10.0.0.2/24', node: 'PC4', command: 'show ip', expect: '10\\.0\\.0\\.2', points: 1 },
            { description: 'PC1 ping PC2 ได้ (subnet เดียวกัน)', node: 'PC1', command: 'ping 192.168.1.2', expect: 'bytes from 192\\.168\\.1\\.2', points: 3 },
            { description: 'PC3 ping PC4 ได้ (subnet เดียวกัน)', node: 'PC3', command: 'ping 10.0.0.2', expect: 'bytes from 10\\.0\\.0\\.2', points: 3 },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบท้ายโมดูล 3',
          order: 2,
          estMinutes: 4,
          passThreshold: 60,
          questions: [
            {
              prompt: 'Switch ทำงานที่ Layer ใดและใช้ที่อยู่ชนิดใดในการส่ง frame',
              choices: ['Layer 3, IP address', 'Layer 2, MAC address', 'Layer 4, port number', 'Layer 1, ไม่มีที่อยู่'],
              answer: [1],
              explanation: 'Switch เป็นอุปกรณ์ Layer 2 ส่ง frame ตาม MAC address จึงไม่เข้าใจ IP network และ route ข้าม subnet ไม่ได้',
              points: 1,
            },
            {
              prompt: 'เมื่อปลายทางอยู่คนละ subnet เครื่องต้นทางจะส่งข้อมูลไปที่ใดก่อน',
              choices: ['ไปที่ปลายทางโดยตรง', 'ไปที่ default gateway', 'ไปที่ switch อีกตัว', 'ทิ้ง packet ทันที'],
              answer: [1],
              explanation: 'เมื่อปลายทางอยู่นอก subnet เครื่องจะส่ง packet ไปยัง default gateway (router) เพื่อให้ route ต่อ',
              points: 1,
            },
          ],
        },
      ],
    },
  ],
};
