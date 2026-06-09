// IP Addressing & Subnetting — ระดับกลาง
// ทฤษฎี subnetting แบบเจาะลึก + แล็บ VPCS จริง (/26, default gateway)

export default {
  title: 'IP Addressing & Subnetting',
  description: 'เจาะลึก subnet mask, prefix, VLSM และ default gateway พร้อมลงมือคำนวณและตั้งค่าจริงบน VPCS',
  level: 'intermediate',
  track: 'Networking',
  estimatedHours: 8,
  prerequisites: ['ผ่านคอร์ส Networking Basics หรือเข้าใจ IP/ping เบื้องต้น', 'คำนวณเลขฐานสองเบื้องต้นได้จะช่วยมาก'],
  published: true,
  modules: [
    {
      title: 'โมดูล 1 — Subnet Mask และ Prefix',
      description: 'เข้าใจว่า subnet mask กำหนดขอบเขต network อย่างไร และคำนวณจำนวน host ได้',
      order: 0,
      objectives: [
        'แปลง subnet mask ระหว่างรูปแบบ dotted-decimal กับ prefix (/n)',
        'คำนวณ network address, broadcast address และจำนวน usable host',
        'ออกแบบการวาง host ใน subnet ขนาดต่าง ๆ',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'อ่าน Subnet Mask ให้ขาด',
          order: 0,
          estMinutes: 14,
          sections: [
            {
              heading: 'Prefix คือจำนวนบิตของ network',
              body: [
                'Prefix `/n` บอกว่าบิตซ้ายสุด `n` บิตเป็นส่วน **network** ที่เหลือเป็น **host**',
                '',
                '```',
                '/24 → 11111111.11111111.11111111.00000000 = 255.255.255.0',
                '/26 → 11111111.11111111.11111111.11000000 = 255.255.255.192',
                '```',
                '',
                'ยิ่ง prefix มาก → network ยิ่งเล็ก → host ยิ่งน้อย',
              ].join('\n'),
            },
            {
              heading: 'สูตรคำนวณจำนวน host',
              body: [
                'ถ้าเหลือ host bits จำนวน `h` บิต จำนวน host ที่ **ใช้งานได้จริง** คือ',
                '',
                '```',
                'usable hosts = 2^h − 2',
                '```',
                '',
                'ที่ต้องลบ 2 เพราะ:',
                '- ที่อยู่ตัวแรกของ subnet = **network address** (ใช้เป็น host ไม่ได้)',
                '- ที่อยู่ตัวสุดท้าย = **broadcast address**',
                '',
                'ตัวอย่าง `/26` → host bits = 6 → `2^6 − 2 = 62` host',
              ].join('\n'),
            },
            {
              heading: 'หา Network และ Broadcast',
              body: [
                'subnet `/26` มี **block size = 64** (256 − 192) ดังนั้น network จะขึ้นทีละ 64:',
                '',
                '| Network | ช่วง host ใช้งานได้ | Broadcast |',
                '|---------|---------------------|-----------|',
                '| 192.168.10.0/26 | .1 – .62 | .63 |',
                '| 192.168.10.64/26 | .65 – .126 | .127 |',
                '| 192.168.10.128/26 | .129 – .190 | .191 |',
                '',
                '> เทคนิค: block size = 256 − ค่า octet ของ mask ในตำแหน่งที่ตัดบิต',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — Hosts in a /26 Subnet',
          order: 1,
          estMinutes: 25,
          description: 'ออกแบบและตั้งค่า host หลายตัวให้อยู่ใน subnet /26 (255.255.255.192) เดียวกัน แล้วยืนยัน connectivity แบบเต็ม',
          objectives: [
            'subnet 192.168.10.0/26 มี usable host ตั้งแต่ .1 ถึง .62',
            'ตั้งค่า PC1 = 192.168.10.11/26, PC2 = 192.168.10.22/26, PC3 = 192.168.10.33/26',
            'ทุกเครื่อง ping หากันได้ครบ เพราะอยู่ใน subnet เดียวกัน',
            'เข้าใจว่า subnet mask เป็นตัวกำหนดขอบเขต network ไม่ใช่ class ของ IP',
          ],
          hints: [
            '/26 คือ mask 255.255.255.192 — ใช้คำสั่ง `ip 192.168.10.11 255.255.255.192`',
            'ตรวจค่าที่ตั้งด้วย `show ip` จะเห็นบรรทัด IP/MASK เป็น 192.168.10.11/26',
            'ทั้ง 3 เครื่องต้องใช้ mask เดียวกัน มิฉะนั้นจะมองกันคนละ network',
          ],
          topology: {
            nodes: [
              { name: 'PC1', nodeType: 'vpcs', x: -200, y: -100 },
              { name: 'PC2', nodeType: 'vpcs', x: 200, y: -100 },
              { name: 'PC3', nodeType: 'vpcs', x: 0, y: 150 },
              { name: 'SW1', nodeType: 'ethernet_switch', x: 0, y: 0 },
            ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
              { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
              { node1: 'PC3', port1: 0, node2: 'SW1', port2: 2 },
            ],
          },
          gradingChecks: [
            { description: 'PC1 ตั้งค่า 192.168.10.11/26', node: 'PC1', command: 'show ip', expect: '192\\.168\\.10\\.11/26', points: 2 },
            { description: 'PC2 ตั้งค่า 192.168.10.22/26', node: 'PC2', command: 'show ip', expect: '192\\.168\\.10\\.22/26', points: 2 },
            { description: 'PC3 ตั้งค่า 192.168.10.33/26', node: 'PC3', command: 'show ip', expect: '192\\.168\\.10\\.33/26', points: 2 },
            { description: 'PC1 ping PC2 ได้', node: 'PC1', command: 'ping 192.168.10.22', expect: 'bytes from 192\\.168\\.10\\.22', points: 2 },
            { description: 'PC1 ping PC3 ได้', node: 'PC1', command: 'ping 192.168.10.33', expect: 'bytes from 192\\.168\\.10\\.33', points: 2 },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — คำนวณ Subnet',
          order: 2,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'subnet /27 มี usable host กี่ตัว',
              choices: ['14', '30', '62', '126'],
              answer: [1],
              explanation: '/27 เหลือ host bits 5 บิต → 2^5 − 2 = 30',
              points: 1,
            },
            {
              prompt: 'network address ของ 192.168.10.50/26 คือข้อใด',
              choices: ['192.168.10.0', '192.168.10.32', '192.168.10.48', '192.168.10.64'],
              answer: [0],
              explanation: '/26 block size = 64 → subnet แรกคือ 192.168.10.0 (ครอบ .0–.63) ดังนั้น .50 อยู่ใน network 192.168.10.0',
              points: 2,
            },
            {
              prompt: 'subnet mask 255.255.255.192 ตรงกับ prefix ใด',
              choices: ['/24', '/25', '/26', '/27'],
              answer: [2],
              explanation: '192 = 11000000 เพิ่มมา 2 บิตจาก /24 จึงเป็น /26',
              points: 1,
            },
          ],
        },
      ],
    },
    {
      title: 'โมดูล 2 — Default Gateway',
      description: 'บทบาทของ gateway และการตั้งค่าให้ host พร้อมส่ง traffic ออกนอก subnet',
      order: 1,
      objectives: [
        'อธิบายบทบาทของ default gateway',
        'ตั้งค่า gateway บน host ได้',
        'ตรวจสอบการตั้งค่า gateway',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Default Gateway ทำหน้าที่อะไร',
          order: 0,
          estMinutes: 8,
          sections: [
            {
              heading: 'ทางออกของ subnet',
              body: [
                'เมื่อ host ต้องการส่งข้อมูลไปยังปลายทางที่อยู่**นอก subnet** ของตัวเอง มันจะส่ง packet ไปที่ **default gateway** ซึ่งโดยทั่วไปคือ IP ของ interface router ที่ต่อกับ subnet นั้น',
                '',
                'host เปรียบเทียบ IP ปลายทางกับ subnet mask ของตัวเองเพื่อตัดสินใจ:',
                '- ปลายทางอยู่ใน subnet เดียวกัน → ส่งตรงผ่าน switch',
                '- ปลายทางอยู่นอก subnet → ส่งให้ gateway',
                '',
                'ถ้า host **ไม่ได้ตั้ง gateway** มันจะส่งออกนอก subnet ไม่ได้เลย แม้สายและ router จะพร้อมก็ตาม',
              ].join('\n'),
            },
            {
              heading: 'ตั้งค่าบน VPCS',
              body: [
                'VPCS ตั้ง IP และ gateway ในคำสั่งเดียว โดยใส่ gateway เป็นพารามิเตอร์ที่สาม:',
                '',
                '```',
                'ip 192.168.20.10 255.255.255.0 192.168.20.1',
                '```',
                '',
                'ตรวจด้วย `show ip` จะเห็นบรรทัด `GATEWAY` แสดง `192.168.20.1`',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'แล็บ — Default Gateway',
          order: 1,
          estMinutes: 20,
          description: 'ตั้งค่า default gateway ให้ host เพื่อเตรียมส่ง traffic ออกนอก subnet และยืนยันค่าใน routing ของ host',
          objectives: [
            'เข้าใจบทบาทของ default gateway: ปลายทางที่ host ส่ง packet ไปเมื่อปลายทางอยู่นอก subnet',
            'ตั้งค่า PC1 = 192.168.20.10/24 gateway 192.168.20.1',
            'ตั้งค่า PC2 = 192.168.20.20/24 gateway 192.168.20.1',
            'ตรวจสอบว่า host บันทึก gateway ไว้ถูกต้อง และยังคง ping ภายใน subnet ได้',
          ],
          hints: [
            'VPCS ตั้ง gateway ในคำสั่งเดียว: `ip 192.168.20.10 255.255.255.0 192.168.20.1`',
            '`show ip` จะมีบรรทัด GATEWAY แสดง 192.168.20.1',
            'gateway มักเป็น IP ของ interface router ที่ต่อกับ subnet นี้',
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
            { description: 'PC1 มี IP 192.168.20.10/24', node: 'PC1', command: 'show ip', expect: '192\\.168\\.20\\.10/24', points: 2 },
            { description: 'PC1 ตั้ง gateway 192.168.20.1', node: 'PC1', command: 'show ip', expect: 'GATEWAY\\s*:\\s*192\\.168\\.20\\.1', points: 3 },
            { description: 'PC2 มี IP 192.168.20.20/24', node: 'PC2', command: 'show ip', expect: '192\\.168\\.20\\.20/24', points: 2 },
            { description: 'PC2 ตั้ง gateway 192.168.20.1', node: 'PC2', command: 'show ip', expect: 'GATEWAY\\s*:\\s*192\\.168\\.20\\.1', points: 3 },
            { description: 'PC1 ping PC2 ภายใน subnet ได้', node: 'PC1', command: 'ping 192.168.20.20', expect: 'bytes from 192\\.168\\.20\\.20', points: 2 },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบท้ายโมดูล 2',
          order: 2,
          estMinutes: 4,
          passThreshold: 60,
          questions: [
            {
              prompt: 'host จะใช้ default gateway เมื่อใด',
              choices: [
                'ทุกครั้งที่ส่งข้อมูล',
                'เมื่อปลายทางอยู่ใน subnet เดียวกัน',
                'เมื่อปลายทางอยู่นอก subnet ของตัวเอง',
                'เมื่อ ping ตัวเอง',
              ],
              answer: [2],
              explanation: 'host ส่งผ่าน gateway เฉพาะเมื่อปลายทางอยู่นอก subnet ส่วนภายใน subnet เดียวกันจะส่งตรง',
              points: 1,
            },
            {
              prompt: 'ถ้า host ไม่ได้ตั้ง default gateway จะเกิดอะไรขึ้น',
              choices: [
                'ping ในเครือข่ายเดียวกันไม่ได้',
                'ส่งข้อมูลออกนอก subnet ไม่ได้',
                'IP จะหายไป',
                'switch จะดับ',
              ],
              answer: [1],
              explanation: 'ไม่มี gateway = ไม่มีทางออก จึงส่งออกนอก subnet ไม่ได้ แต่ยัง ping ภายใน subnet เดียวกันได้ปกติ',
              points: 1,
            },
          ],
        },
      ],
    },
  ],
};
