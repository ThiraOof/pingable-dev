// Network Automation — พื้นฐานการจัดการเครือข่ายแบบอัตโนมัติ
//
// CCNA 200-301 ให้น้ำหนัก Automation & Programmability 10% และ CCNP ENCOR 15%
// ซึ่งหลักสูตรเดิมไม่มีเลย — คอร์สนี้ปิดช่องว่างนั้น
//
// CCNA เน้น "แนวคิด" ไม่ได้ให้เขียนโปรแกรมจริง คอร์สนี้จึงเป็น reading + แบบทดสอบ
// (lab จริงต้องมี Python runtime/automation environment ซึ่งอยู่นอกขอบเขต
// GNS3+VyOS แต่ VyOS มี HTTPS API ที่ต่อยอดทำ lab ได้ในอนาคต)

export default {
  slug: 'network-automation',
  title: 'Network Automation',
  description: 'พื้นฐานการจัดการเครือข่ายแบบอัตโนมัติสำหรับ CCNA/CCNP: ทำไมต้อง automate, SDN และสถาปัตยกรรมแบบ controller-based, REST API + JSON/YAML, แนวคิด Python สำหรับเครือข่าย และ Ansible — ปิดช่องว่างหัวข้อ Automation & Programmability (10% CCNA / 15% ENCOR) ที่หลักสูตรเดิมไม่มี',
  level: 'advanced',
  track: 'Automation',
  estimatedHours: 8,
  prerequisites: ['ผ่าน Introduction to Networks (ccna-intro) หรือเทียบเท่า', 'คุ้นเคยกับ CLI ของอุปกรณ์เครือข่าย'],
  published: true,
  modules: [
    // ── โมดูล 1 — ทำไมต้อง Automate ─────────────────────────────────────
    {
      title: 'โมดูล 1 — ทำไมต้อง Automate',
      description: 'ปัญหาของการจัดการด้วยมือ, Infrastructure as Code และแนวคิด idempotency',
      order: 0,
      objectives: [
        'อธิบายข้อเสียของการตั้งค่าด้วยมือเมื่อเครือข่ายโตขึ้น',
        'อธิบายแนวคิด Infrastructure as Code (IaC)',
        'อธิบายความหมายและความสำคัญของ idempotency',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Manual เทียบ Automated, IaC และ Idempotency',
          order: 0,
          estMinutes: 12,
          sections: [
            {
              heading: 'ปัญหาของการทำด้วยมือ',
              body: [
                'ตั้งค่าอุปกรณ์ทีละตัวด้วยมือ (CLI) ใช้ได้ตอนมีไม่กี่ตัว แต่พอเครือข่ายโต ปัญหาตามมา:',
                '',
                '- **ช้าและไม่สเกล** — เปลี่ยน VLAN บน 200 สวิตช์ = พิมพ์ซ้ำ 200 ครั้ง',
                '- **ผิดพลาดง่าย** — มนุษย์พิมพ์ผิด/ลืมขั้นตอน แต่ละเครื่องตั้งไม่เหมือนกัน (config drift)',
                '- **ตรวจสอบย้อนยาก** — ไม่รู้ว่าใครเปลี่ยนอะไรเมื่อไหร่',
                '',
                'Automation แก้ทั้งหมด: ทำครั้งเดียวกับร้อยเครื่องพร้อมกัน เหมือนกันทุกตัว เร็ว และมีบันทึก',
              ].join('\n'),
            },
            {
              heading: 'Infrastructure as Code (IaC)',
              body: [
                '**IaC** คือการอธิบายโครงสร้างเครือข่าย/ระบบเป็น "โค้ด/ไฟล์" แทนการคลิกหรือพิมพ์คำสั่งทีละตัว แล้วให้เครื่องมือนำไฟล์นั้นไปสร้างให้ตรงตามที่เขียน',
                '',
                'ข้อดี:',
                '- เก็บใน **version control (Git)** — เห็นประวัติการเปลี่ยน ย้อนกลับได้',
                '- ทำซ้ำได้เป๊ะ ๆ ทุกที่ (dev/test/prod เหมือนกัน)',
                '- ทบทวน (review) ก่อนใช้งานจริงได้เหมือนรีวิวโค้ด',
                '',
                'แนวคิดนี้ทำให้การจัดการเครือข่ายเข้าใกล้วิธีทำงานของนักพัฒนาซอฟต์แวร์ — เรียกรวม ๆ ว่า **NetDevOps**',
              ].join('\n'),
            },
            {
              heading: 'Idempotency: หัวใจของ automation ที่ปลอดภัย',
              body: [
                '**Idempotency** หมายถึง "ทำกี่ครั้งผลก็เหมือนเดิม" — รันสคริปต์/playbook ซ้ำแล้วระบบไม่เปลี่ยนเพิ่มถ้ามันถูกต้องอยู่แล้ว',
                '',
                'ตัวอย่าง: คำสั่งแบบ idempotent คือ "ทำให้ VLAN 10 มีอยู่" (มีแล้วก็ข้าม) ไม่ใช่ "สร้าง VLAN 10" (รันซ้ำอาจ error หรือซ้ำซ้อน)',
                '',
                'ทำไมสำคัญ: เครื่องมือ automation ดี ๆ จะตรวจสถานะปัจจุบันก่อน แล้วเปลี่ยน "เฉพาะส่วนที่ต่างจากที่ต้องการ" (declarative) ทำให้รันซ้ำได้อย่างปลอดภัย ไม่พังของที่ดีอยู่แล้ว — Ansible และ IaC tool ส่วนใหญ่ยึดหลักนี้',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — ทำไมต้อง Automate',
          order: 1,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'ปัญหา "config drift" หมายถึงอะไร',
              choices: [
                'อุปกรณ์ใช้พลังงานมากขึ้น',
                'แต่ละเครื่องถูกตั้งค่าไม่เหมือนกันจนเบี่ยงเบนจากมาตรฐาน',
                'สัญญาณ Wi-Fi อ่อนลง',
                'IP หมด pool',
              ],
              answer: [1],
              explanation: 'config drift คือสภาพที่อุปกรณ์ต่าง ๆ ถูกแก้ทีละตัวจนตั้งค่าไม่ตรงกัน เป็นปัญหาที่ automation ช่วยแก้',
              points: 1,
            },
            {
              prompt: 'Infrastructure as Code (IaC) ได้ประโยชน์จากการเก็บไฟล์ไว้ใน version control อย่างไร',
              choices: [
                'ทำให้อุปกรณ์เร็วขึ้น',
                'เห็นประวัติการเปลี่ยนแปลง ย้อนกลับได้ และรีวิวก่อนใช้จริงได้',
                'ลดการใช้ IP',
                'แทนที่ DNS',
              ],
              answer: [1],
              explanation: 'การเก็บ IaC ใน Git ทำให้ติดตามประวัติ ย้อนกลับ และทบทวนการเปลี่ยนแปลงได้เหมือนรีวิวโค้ด',
              points: 1,
            },
            {
              prompt: 'คุณสมบัติ idempotency ของเครื่องมือ automation หมายถึงอะไร',
              choices: [
                'รันได้เร็วที่สุด',
                'รันซ้ำกี่ครั้งผลลัพธ์ก็เหมือนเดิม ไม่เปลี่ยนเพิ่มถ้าถูกต้องอยู่แล้ว',
                'ใช้ได้กับ Cisco เท่านั้น',
                'ต้องรันด้วยสิทธิ์ root เสมอ',
              ],
              answer: [1],
              explanation: 'idempotency คือการที่รันซ้ำแล้วผลคงเดิม เครื่องมือจะเปลี่ยนเฉพาะส่วนที่ต่างจากที่ต้องการ จึงรันซ้ำได้อย่างปลอดภัย',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 2 — SDN & Controller-Based Architecture ───────────────────
    {
      title: 'โมดูล 2 — SDN และสถาปัตยกรรมแบบ Controller-Based',
      description: 'control plane เทียบ data plane, overlay/underlay และ Northbound/Southbound API',
      order: 1,
      objectives: [
        'อธิบายการแยก control plane ออกจาก data plane ใน SDN',
        'อธิบายบทบาทของ SDN controller และ Northbound/Southbound API',
        'แยกความต่างของ underlay กับ overlay network',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'SDN: Control/Data Plane และ Northbound/Southbound API',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'Control Plane เทียบ Data Plane',
              body: [
                'อุปกรณ์เครือข่ายแบ่งงานเป็นสองระนาบหลัก:',
                '',
                '- **Control plane** — "สมอง" ที่ตัดสินใจว่าจะส่งทราฟฟิกไปทางไหน (รัน routing protocol, สร้างตาราง)',
                '- **Data plane** — "กล้ามเนื้อ" ที่ส่งต่อแพ็กเก็ตจริงตามที่ control plane สั่ง',
                '',
                'ในเครือข่ายดั้งเดิม ทั้งสองระนาบอยู่ในอุปกรณ์ทุกตัว (distributed) — แต่ละตัวคิดเอง',
              ].join('\n'),
            },
            {
              heading: 'SDN: ดึง Control Plane มารวมศูนย์',
              body: [
                '**SDN (Software-Defined Networking)** ดึง control plane ออกจากอุปกรณ์มาไว้ที่ **SDN controller** ส่วนกลาง — อุปกรณ์เหลือแค่ data plane ที่รับคำสั่งจาก controller',
                '',
                'ข้อดี: เห็นภาพทั้งเครือข่ายจากที่เดียว, กำหนดนโยบายรวมศูนย์, และเปิดให้ "โปรแกรม" เครือข่ายผ่าน API',
                '',
                'ตัวอย่าง controller: Cisco **DNA Center** / **Catalyst Center**, **OpenDaylight**, Cisco **APIC** (ACI)',
              ].join('\n'),
            },
            {
              heading: 'Northbound/Southbound API และ Underlay/Overlay',
              body: [
                'controller คุยสองทิศ:',
                '- **Southbound API** — คุย "ลง" ไปยังอุปกรณ์เพื่อสั่งงาน (เช่น NETCONF, OpenFlow)',
                '- **Northbound API** — เปิด "ขึ้น" ให้แอป/สคริปต์สั่งงาน controller (มักเป็น REST API) นี่คือจุดที่ automation/แอปเข้ามาควบคุมเครือข่าย',
                '',
                'แนวคิดคู่กัน:',
                '- **Underlay** — เครือข่ายกายภาพจริง (สาย/IP/routing พื้นฐาน) ที่ส่งแพ็กเก็ตจากจุดหนึ่งไปอีกจุด',
                '- **Overlay** — เครือข่ายเสมือนที่สร้างทับ underlay (เช่น VXLAN tunnel) ที่ผู้ใช้/นโยบายมองเห็น',
                '',
                '> เทียบกับที่เรียนมา: WLC คุม AP, DNA Center คุมทั้ง campus — ล้วนเป็น controller-based ที่รวมศูนย์ control plane',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — SDN',
          order: 1,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'ใน SDN ระนาบใดที่ถูกดึงออกจากอุปกรณ์มารวมไว้ที่ controller ส่วนกลาง',
              choices: ['Data plane', 'Control plane', 'Management plane', 'Physical plane'],
              answer: [1],
              explanation: 'SDN รวม control plane (สมองที่ตัดสินใจเส้นทาง) ไว้ที่ controller ส่วนอุปกรณ์เหลือ data plane',
              points: 1,
            },
            {
              prompt: 'API ที่เปิดให้แอป/สคริปต์ภายนอกสั่งงาน SDN controller (มักเป็น REST) เรียกว่าอะไร',
              choices: ['Southbound API', 'Northbound API', 'Eastbound API', 'Serial API'],
              answer: [1],
              explanation: 'Northbound API เปิด "ขึ้น" ให้แอป/automation สั่งงาน controller ส่วน Southbound คุย "ลง" ไปอุปกรณ์',
              points: 1,
            },
            {
              prompt: 'เครือข่ายเสมือนที่สร้างทับเครือข่ายกายภาพ (เช่น VXLAN tunnel) เรียกว่าอะไร',
              choices: ['Underlay', 'Overlay', 'Backbone', 'Broadcast domain'],
              answer: [1],
              explanation: 'Overlay คือเครือข่ายเสมือนที่สร้างทับ underlay (เครือข่ายกายภาพจริง)',
              points: 1,
            },
            {
              prompt: 'ข้อใดเป็นตัวอย่างของ SDN controller',
              choices: ['Wireshark', 'Cisco DNA Center / OpenDaylight', 'VPCS', 'Notepad'],
              answer: [1],
              explanation: 'Cisco DNA Center และ OpenDaylight เป็น SDN controller ที่รวมศูนย์การควบคุมเครือข่าย',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 3 — REST API & JSON/YAML ──────────────────────────────────
    {
      title: 'โมดูล 3 — REST API และ JSON/YAML',
      description: 'HTTP verbs, status codes, โครงสร้างข้อมูล JSON/YAML และการยืนยันตัวตนของ API',
      order: 2,
      objectives: [
        'อธิบาย HTTP methods (GET/POST/PUT/DELETE) และ status codes',
        'อ่านและเข้าใจโครงสร้างข้อมูล JSON และ YAML',
        'อธิบายแนวทางการยืนยันตัวตนของ REST API (token/key)',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'REST API, HTTP Methods และ JSON/YAML',
          order: 0,
          estMinutes: 14,
          sections: [
            {
              heading: 'REST API คืออะไร',
              body: [
                '**REST API** คือวิธีให้โปรแกรมคุยกับระบบอื่นผ่าน HTTP (เหมือนเบราว์เซอร์เปิดเว็บ แต่แลกข้อมูลแทนหน้าเว็บ) เครือข่ายยุคใหม่ (controller, อุปกรณ์, cloud) เปิด REST API ให้สคริปต์เข้ามาอ่าน/สั่งงานได้',
                '',
                'แต่ละคำขอระบุ "ทำอะไร" ด้วย **HTTP method** และ "กับอะไร" ด้วย **URL (endpoint)** เช่น `GET /api/v1/interfaces`',
              ].join('\n'),
            },
            {
              heading: 'HTTP Methods และ Status Codes',
              body: [
                'Method หลัก (เทียบ CRUD):',
                '| Method | ใช้ทำอะไร |',
                '|---|---|',
                '| **GET** | อ่านข้อมูล (ไม่เปลี่ยนแปลง) |',
                '| **POST** | สร้างใหม่ |',
                '| **PUT/PATCH** | แก้ไข/อัปเดต |',
                '| **DELETE** | ลบ |',
                '',
                'Status code บอกผลลัพธ์ (จำกลุ่มร้อย):',
                '- **2xx** = สำเร็จ (200 OK, 201 Created)',
                '- **3xx** = redirect',
                '- **4xx** = ผิดที่ฝั่งผู้ขอ (400 Bad Request, **401 Unauthorized**, 404 Not Found)',
                '- **5xx** = ผิดที่ฝั่งเซิร์ฟเวอร์ (500 Internal Server Error)',
              ].join('\n'),
            },
            {
              heading: 'JSON, YAML และการยืนยันตัวตน',
              body: [
                'ข้อมูลที่ API แลกกันมักเป็น **JSON** (เครื่องอ่านง่าย) ส่วน **YAML** (คนอ่านง่าย) นิยมในไฟล์ config เช่น Ansible',
                '',
                'JSON ใช้ `{}` (object/คู่ key-value), `[]` (array), เครื่องหมายคำพูดรอบ string:',
                '```json',
                '{ "hostname": "R1", "interfaces": ["eth0", "eth1"], "enabled": true }',
                '```',
                'YAML เนื้อหาเดียวกันแต่ใช้การเยื้อง (indentation) แทนวงเล็บ:',
                '```yaml',
                'hostname: R1',
                'interfaces:',
                '  - eth0',
                '  - eth1',
                'enabled: true',
                '```',
                '',
                'REST API ป้องกันการเข้าถึงด้วย **token/API key** (ส่งใน HTTP header) — เรียก login ครั้งแรกเพื่อรับ token แล้วแนบ token นั้นในทุกคำขอถัดไป (เลี่ยงการส่ง username/password ซ้ำ ๆ) ได้ 401 = token ผิด/หมดอายุ',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — REST API และ JSON',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'HTTP method ใดใช้สำหรับ "อ่านข้อมูล" โดยไม่เปลี่ยนแปลงอะไร',
              choices: ['POST', 'GET', 'DELETE', 'PUT'],
              answer: [1],
              explanation: 'GET ใช้อ่านข้อมูล ส่วน POST สร้าง, PUT/PATCH แก้ไข, DELETE ลบ',
              points: 1,
            },
            {
              prompt: 'HTTP status code กลุ่มใดหมายถึง "ผิดพลาดที่ฝั่งเซิร์ฟเวอร์"',
              choices: ['2xx', '3xx', '4xx', '5xx'],
              answer: [3],
              explanation: '5xx = server error (เช่น 500) ส่วน 4xx = client error, 2xx = สำเร็จ',
              points: 1,
            },
            {
              prompt: 'status code 401 Unauthorized มักเกิดจากอะไรในการเรียก REST API',
              choices: [
                'เซิร์ฟเวอร์ล่ม',
                'token/credential ผิดหรือหมดอายุ',
                'ข้อมูลถูกสร้างสำเร็จ',
                'URL ถูก redirect',
              ],
              answer: [1],
              explanation: '401 Unauthorized หมายถึงการยืนยันตัวตนไม่ผ่าน — token/API key ผิดหรือหมดอายุ',
              points: 1,
            },
            {
              prompt: 'ข้อใดอธิบายความต่างของ JSON กับ YAML ได้ถูกต้อง',
              choices: [
                'JSON ใช้การเยื้อง ส่วน YAML ใช้วงเล็บปีกกา',
                'JSON ใช้ {} / [] เครื่องอ่านง่าย ส่วน YAML ใช้การเยื้อง คนอ่านง่าย',
                'ทั้งสองเป็นภาษาโปรแกรม',
                'YAML ใช้ได้กับ Cisco เท่านั้น',
              ],
              answer: [1],
              explanation: 'JSON ใช้ {}/[] เหมาะกับเครื่อง ส่วน YAML ใช้การเยื้องอ่านง่ายสำหรับคน นิยมในไฟล์ config',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 4 — Python & Ansible Concepts ─────────────────────────────
    {
      title: 'โมดูล 4 — Python และ Ansible สำหรับเครือข่าย',
      description: 'แนวคิด Python สำหรับเครือข่าย และองค์ประกอบของ Ansible (playbook/inventory/module)',
      order: 3,
      objectives: [
        'อธิบายบทบาทของ Python และไลบรารีที่ใช้กับ network automation',
        'อธิบายองค์ประกอบของ Ansible: playbook, inventory, module',
        'อธิบายว่าทำไม Ansible แบบ agentless จึงเหมาะกับอุปกรณ์เครือข่าย',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Python สำหรับเครือข่าย และพื้นฐาน Ansible',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'ทำไม Python',
              body: [
                '**Python** เป็นภาษาที่นิยมที่สุดในงาน network automation เพราะอ่านง่าย ไลบรารีเยอะ และมีเครื่องมือเฉพาะทางมาก:',
                '',
                '- **requests** — เรียก REST API (GET/POST + อ่าน JSON)',
                '- **Netmiko / NAPALM** — ส่งคำสั่ง CLI ไปอุปกรณ์หลายยี่ห้อผ่าน SSH',
                '- **ncclient** — คุย NETCONF',
                '',
                'งานทั่วไป เช่น ดึง config จากร้อยอุปกรณ์, แปลง JSON ที่ API ส่งกลับมาเป็นรายงาน, หรือ push การเปลี่ยนแปลงพร้อมกัน — CCNA เน้นแค่ "อ่านโค้ดเข้าใจ" ไม่ต้องเขียนเองระดับลึก',
              ].join('\n'),
            },
            {
              heading: 'Ansible: องค์ประกอบหลัก',
              body: [
                '**Ansible** เป็นเครื่องมือ automation ยอดนิยม ใช้ไฟล์ YAML บอก "สถานะที่ต้องการ" (declarative) องค์ประกอบหลัก:',
                '',
                '- **Inventory** — รายชื่ออุปกรณ์/กลุ่มที่จะจัดการ (เช่น [routers], [switches])',
                '- **Playbook** — ไฟล์ YAML ที่บอกขั้นตอน/สถานะที่ต้องการให้เป็น (เรียงเป็น tasks)',
                '- **Module** — หน่วยงานสำเร็จรูปที่ลงมือทำจริง (เช่น module ตั้ง VLAN, ตั้ง interface) — ส่วนใหญ่ออกแบบให้ **idempotent**',
                '- **Task** — หนึ่งขั้นใน playbook ที่เรียกใช้ module หนึ่งตัว',
                '',
                'รัน playbook เดียวกับ inventory ที่มีร้อยอุปกรณ์ = จัดการทั้งหมดพร้อมกันให้ตรงตามที่เขียน',
              ].join('\n'),
            },
            {
              heading: 'Agentless: จุดเด่นของ Ansible กับเครือข่าย',
              body: [
                'เครื่องมือ automation บางตัว (เช่น Puppet/Chef) ต้องลง "agent" บนเครื่องเป้าหมายก่อน — แต่อุปกรณ์เครือข่ายส่วนใหญ่ลงซอฟต์แวร์เพิ่มไม่ได้',
                '',
                '**Ansible เป็น agentless** — คุยกับอุปกรณ์ผ่าน SSH หรือ API ที่มีอยู่แล้ว ไม่ต้องลงอะไรเพิ่ม จึงเหมาะกับ router/switch/firewall มาก เพียงเครื่องที่รัน Ansible (control node) เข้าถึงอุปกรณ์ได้ก็พอ',
                '',
                '> เชื่อมโยงทั้งคอร์ส: REST API (โมดูล 3) + Python/Ansible (โมดูลนี้) ทำงานบน SDN/controller (โมดูล 2) เพื่อแก้ปัญหาการทำด้วยมือ (โมดูล 1) — นี่คือภาพรวมของ NetDevOps',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — Python และ Ansible',
          order: 1,
          estMinutes: 6,
          passThreshold: 60,
          questions: [
            {
              prompt: 'ไลบรารี Python ใดที่ใช้สำหรับเรียก REST API และอ่าน JSON ที่ตอบกลับมา',
              choices: ['Netmiko', 'requests', 'ncclient', 'pandas'],
              answer: [1],
              explanation: 'requests ใช้เรียก HTTP/REST API ส่วน Netmiko/NAPALM เน้น SSH CLI และ ncclient เน้น NETCONF',
              points: 1,
            },
            {
              prompt: 'ใน Ansible ไฟล์ YAML ที่บอกขั้นตอน/สถานะที่ต้องการให้เป็นเรียกว่าอะไร',
              choices: ['Inventory', 'Playbook', 'Module', 'Token'],
              answer: [1],
              explanation: 'Playbook คือไฟล์ YAML ที่อธิบาย tasks/สถานะที่ต้องการ ส่วน inventory คือรายชื่ออุปกรณ์',
              points: 1,
            },
            {
              prompt: 'เหตุใด Ansible แบบ agentless จึงเหมาะกับอุปกรณ์เครือข่าย',
              choices: [
                'เพราะเร็วกว่าทุกเครื่องมือ',
                'เพราะไม่ต้องลงซอฟต์แวร์ agent บนอุปกรณ์ คุยผ่าน SSH/API ที่มีอยู่แล้ว',
                'เพราะใช้ได้กับ Cisco เท่านั้น',
                'เพราะไม่ต้องมี inventory',
              ],
              answer: [1],
              explanation: 'อุปกรณ์เครือข่ายมักลง agent เพิ่มไม่ได้ Ansible แบบ agentless จึงเหมาะ เพราะคุยผ่าน SSH/API ที่มีอยู่แล้ว',
              points: 1,
            },
            {
              prompt: 'ใน Ansible หน่วยงานสำเร็จรูปที่ลงมือทำจริง (เช่นตั้ง VLAN) และมักออกแบบให้ idempotent เรียกว่าอะไร',
              choices: ['Playbook', 'Module', 'Inventory', 'Endpoint'],
              answer: [1],
              explanation: 'Module คือหน่วยงานที่ทำงานจริง playbook เรียกใช้ module ผ่าน tasks และ module ส่วนใหญ่เป็น idempotent',
              points: 1,
            },
          ],
        },
      ],
    },
  ],
};
