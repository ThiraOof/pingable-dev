// Wireless Networking — เครือข่ายไร้สาย (ทฤษฎี)
//
// CCNA 200-301 ให้น้ำหนัก Network Access 20% ซึ่งรวม wireless แต่หลักสูตรเดิม
// ไม่มีเนื้อหา wireless เลย — คอร์สนี้ปิดช่องว่างนั้น
//
// ไม่สามารถทำแล็บไร้สายบน GNS3/VyOS ได้ (ไม่มีการจำลองคลื่นวิทยุ) คอร์สนี้จึง
// เป็น reading + แบบทดสอบล้วน เน้นแนวคิดที่ออกสอบ CCNA และใช้งานจริงในองค์กร

export default {
  slug: 'wireless-networking',
  title: 'Wireless Networking',
  description: 'พื้นฐานเครือข่ายไร้สายสำหรับ CCNA: มาตรฐาน 802.11 และย่านความถี่, สถาปัตยกรรม AP (autonomous/controller-based), ความปลอดภัย WPA2/WPA3/802.1X และการออกแบบ/ไล่ปัญหา WLAN — ปิดช่องว่างหัวข้อ wireless ที่อยู่ในโดเมน Network Access (20%) ของ CCNA',
  level: 'intermediate',
  track: 'Networking',
  estimatedHours: 6,
  prerequisites: ['ผ่าน Networking Basics หรือเทียบเท่า'],
  published: true,
  modules: [
    // ── โมดูล 1 — WLAN Fundamentals ─────────────────────────────────────
    {
      title: 'โมดูล 1 — พื้นฐาน WLAN',
      description: 'มาตรฐาน 802.11, ย่านความถี่ 2.4/5/6 GHz, ช่องสัญญาณ และ SSID',
      order: 0,
      objectives: [
        'อธิบายวิวัฒนาการของมาตรฐาน 802.11 (Wi-Fi 4/5/6/6E)',
        'แยกความต่างของย่านความถี่ 2.4/5/6 GHz และข้อดีข้อเสีย',
        'อธิบายแนวคิด channel, channel overlap และ SSID',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'มาตรฐาน 802.11, ย่านความถี่ และช่องสัญญาณ',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'Wi-Fi คือ Half-Duplex แบบ "พูดทีละคน"',
              body: [
                'เครือข่ายไร้สายใช้คลื่นวิทยุเป็นตัวกลางร่วม (shared medium) อุปกรณ์ทุกตัวในช่องเดียวกันต้อง **ผลัดกันส่ง** — เป็น **half-duplex** เสมอ (ต่างจากสายที่ full-duplex ได้)',
                '',
                'เพื่อกันชนกัน Wi-Fi ใช้ **CSMA/CA** (Carrier Sense Multiple Access with Collision Avoidance): ฟังก่อนว่าว่างไหม ถ้าว่างค่อยส่ง ต่างจาก Ethernet เก่าที่ใช้ CSMA/CD (detect การชน) เพราะไร้สาย "ฟังตอนส่ง" ไม่ได้',
                '',
                '> ยิ่งมีอุปกรณ์ในช่องเดียวกันมาก ยิ่งต้องรอคิวนาน throughput ต่อเครื่องจึงลดลง',
              ].join('\n'),
            },
            {
              heading: 'วิวัฒนาการมาตรฐาน 802.11',
              body: [
                '| มาตรฐาน | ชื่อการตลาด | ย่านความถี่ |',
                '|---|---|---|',
                '| 802.11n | Wi-Fi 4 | 2.4 และ 5 GHz |',
                '| 802.11ac | Wi-Fi 5 | 5 GHz |',
                '| 802.11ax | Wi-Fi 6 | 2.4 และ 5 GHz |',
                '| 802.11ax | Wi-Fi 6E | เพิ่มย่าน 6 GHz |',
                '',
                'รุ่นใหม่เร็วขึ้นด้วยเทคนิคเช่น MIMO (หลายเสา), channel bonding (รวมช่อง) และ OFDMA (แบ่งช่องให้หลายเครื่องพร้อมกันใน Wi-Fi 6) — และยังคง **backward compatible** กับรุ่นเก่า',
              ].join('\n'),
            },
            {
              heading: 'ย่านความถี่และช่องสัญญาณ',
              body: [
                '- **2.4 GHz** — ไปไกล ทะลุกำแพงดี แต่ช้ากว่าและแออัด (มีแค่ 3 ช่องที่ไม่ทับกัน: **1, 6, 11**) แถมโดนรบกวนจากไมโครเวฟ/บลูทูธ',
                '- **5 GHz** — เร็วกว่า มีช่องไม่ทับกันเยอะ แต่ระยะสั้นกว่าและทะลุกำแพงแย่กว่า',
                '- **6 GHz (Wi-Fi 6E)** — ช่องเยอะมาก โล่ง ไม่แออัด แต่ระยะสั้นสุดและต้องอุปกรณ์รุ่นใหม่',
                '',
                '**Channel overlap** บน 2.4 GHz เป็นปัญหาคลาสสิก: ถ้า AP ข้างกันใช้ช่องทับกัน (เช่น 1 กับ 3) จะรบกวนกันเอง การออกแบบที่ดีจึงสลับใช้ 1/6/11 ในพื้นที่ติดกัน',
                '',
                '**SSID (Service Set Identifier)** คือ "ชื่อเครือข่าย" ที่ผู้ใช้เห็นและเลือกเชื่อมต่อ',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — พื้นฐาน WLAN',
          order: 1,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'เครือข่ายไร้สายใช้กลไกใดในการหลีกเลี่ยงการชนกันของสัญญาณ',
              choices: ['CSMA/CD', 'CSMA/CA', 'STP', 'Full-duplex switching'],
              answer: [1],
              explanation: 'Wi-Fi ใช้ CSMA/CA (หลีกเลี่ยงการชน) เพราะ "ฟังตอนส่ง" ไม่ได้ ส่วน CSMA/CD เป็นของ Ethernet เก่า',
              points: 1,
            },
            {
              prompt: 'บนย่าน 2.4 GHz ช่องสัญญาณชุดใดที่ไม่ทับกัน',
              choices: ['1, 2, 3', '1, 6, 11', '1, 5, 9', 'ทุกช่องไม่ทับกัน'],
              answer: [1],
              explanation: 'ช่อง 1, 6, 11 เป็นสามช่องที่ไม่ทับกันบน 2.4 GHz จึงใช้สลับกันในพื้นที่ติดกันได้',
              points: 1,
            },
            {
              prompt: 'ข้อใดอธิบายข้อดีของย่าน 5 GHz เทียบกับ 2.4 GHz',
              choices: [
                'ไปไกลกว่าและทะลุกำแพงดีกว่า',
                'เร็วกว่าและมีช่องไม่ทับกันมากกว่า แต่ระยะสั้นกว่า',
                'ใช้พลังงานน้อยกว่ามาก',
                'ไม่ต้องมี AP',
              ],
              answer: [1],
              explanation: '5 GHz เร็วกว่าและมีช่องว่างมากกว่า แต่แลกมาด้วยระยะที่สั้นกว่าและทะลุสิ่งกีดขวางได้แย่กว่า 2.4 GHz',
              points: 1,
            },
            {
              prompt: 'การสื่อสารบนเครือข่าย Wi-Fi เป็นแบบใด',
              choices: ['Full-duplex เสมอ', 'Half-duplex (ผลัดกันส่ง)', 'Simplex เท่านั้น', 'ขึ้นกับ SSID'],
              answer: [1],
              explanation: 'Wi-Fi ใช้ตัวกลางร่วมจึงเป็น half-duplex เสมอ ทุกอุปกรณ์ในช่องเดียวกันต้องผลัดกันส่ง',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 2 — WLAN Architecture ─────────────────────────────────────
    {
      title: 'โมดูล 2 — สถาปัตยกรรม WLAN',
      description: 'Autonomous AP เทียบ controller-based (WLC), Lightweight AP, CAPWAP และโหมด deployment',
      order: 1,
      objectives: [
        'แยกความต่างของ Autonomous AP กับ Controller-based (Lightweight AP + WLC)',
        'อธิบายบทบาทของ WLC และโปรโตคอล CAPWAP',
        'อธิบายโหมด deployment (local, FlexConnect, cloud-managed)',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Autonomous เทียบ Controller-Based และ CAPWAP',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'Autonomous AP: ต่างคนต่างจัดการ',
              body: [
                '**Autonomous AP** คือ AP ที่ทำงานครบในตัว — มี config ของตัวเอง จัดการเอง เหมาะกับที่ที่มี AP ไม่กี่ตัว (ร้านเล็ก บ้าน)',
                '',
                'ปัญหาเมื่อโตขึ้น: มี AP 100 ตัวก็ต้องตั้งค่าทีละตัว 100 ครั้ง เปลี่ยนรหัส Wi-Fi ทีต้องไล่แก้ทั้งหมด และจัดการ roaming/ช่องสัญญาณข้าม AP เองได้ยาก',
              ].join('\n'),
            },
            {
              heading: 'Controller-Based: รวมศูนย์ด้วย WLC',
              body: [
                'สถาปัตยกรรมองค์กรใช้ **WLC (Wireless LAN Controller)** เป็นสมองกลาง คุม **Lightweight AP (LWAP)** จำนวนมากพร้อมกัน:',
                '',
                '- ตั้งค่า/นโยบาย/รหัส ที่ WLC ที่เดียว แล้ว push ลงทุก AP',
                '- WLC จัดการ **RRM** (เลือกช่อง/กำลังส่งอัตโนมัติ), roaming ที่ไร้รอยต่อ และความปลอดภัยรวมศูนย์',
                '- AP ทำหน้าที่แค่ "วิทยุ" (real-time) ส่วนการตัดสินใจ (management) อยู่ที่ WLC — เรียกการแบ่งนี้ว่า **split-MAC**',
                '',
                'AP กับ WLC คุยกันผ่านอุโมงค์ **CAPWAP (Control And Provisioning of Wireless Access Points)** ซึ่งมีทั้งช่อง control และช่อง data',
              ].join('\n'),
            },
            {
              heading: 'โหมด Deployment',
              body: [
                '- **Local mode** — ทราฟฟิกผู้ใช้วิ่งผ่านอุโมงค์ CAPWAP กลับไปที่ WLC ก่อน เหมาะกับ AP ในสำนักงานใหญ่ที่อยู่ใกล้ WLC',
                '- **FlexConnect** — AP สาขาที่ WLC อยู่ไกล (ข้าม WAN) สามารถ switch ทราฟฟิกออกที่ท้องถิ่นเองได้ และยังทำงานต่อแม้ลิงก์ไป WLC ขาด',
                '- **Cloud-managed** — จัดการ AP ผ่านแดชบอร์ดบนคลาวด์ (เช่น Meraki) ไม่ต้องมี WLC ฮาร์ดแวร์ในไซต์',
                '',
                '> CCNA เน้นเข้าใจว่า "เมื่อไหร่ใช้แบบไหน" — ไซต์เล็กใช้ autonomous/cloud, องค์กรใหญ่ใช้ controller-based',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — สถาปัตยกรรม WLAN',
          order: 1,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'ในสถาปัตยกรรม controller-based อุปกรณ์ใดทำหน้าที่เป็นสมองกลางคุม Lightweight AP จำนวนมาก',
              choices: ['Switch', 'WLC (Wireless LAN Controller)', 'Router', 'DHCP server'],
              answer: [1],
              explanation: 'WLC คุม config/นโยบาย/ช่องสัญญาณของ LWAP ทั้งหมดจากศูนย์กลาง',
              points: 1,
            },
            {
              prompt: 'โปรโตคอลใดสร้างอุโมงค์ระหว่าง Lightweight AP กับ WLC',
              choices: ['CAPWAP', 'CDP', 'CSMA/CA', 'EAP'],
              answer: [0],
              explanation: 'CAPWAP เป็นอุโมงค์ระหว่าง AP กับ WLC มีทั้งช่อง control และ data',
              points: 1,
            },
            {
              prompt: 'โหมด deployment ใดเหมาะกับ AP สาขาที่ WLC อยู่ไกลข้าม WAN และต้อง switch ทราฟฟิกท้องถิ่นเองได้',
              choices: ['Local mode', 'FlexConnect', 'Monitor mode', 'Rogue mode'],
              answer: [1],
              explanation: 'FlexConnect ให้ AP สาขา switch ทราฟฟิกออกท้องถิ่นและทำงานต่อได้แม้ลิงก์ไป WLC ขาด',
              points: 1,
            },
            {
              prompt: 'ข้อเสียหลักของ Autonomous AP เมื่อจำนวน AP มากขึ้นคือข้อใด',
              choices: [
                'ราคาแพงกว่ามาก',
                'ต้องตั้งค่าและจัดการทีละตัว ไม่รวมศูนย์',
                'ไม่รองรับ WPA2',
                'ใช้ได้แค่ย่าน 6 GHz',
              ],
              answer: [1],
              explanation: 'Autonomous AP จัดการแยกทีละตัว เมื่อมีจำนวนมากจึงดูแลยาก ต่างจาก controller-based ที่คุมรวมศูนย์',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 3 — Wireless Security ──────────────────────────────────────
    {
      title: 'โมดูล 3 — ความปลอดภัยไร้สาย',
      description: 'วิวัฒนาการความปลอดภัย Wi-Fi, WPA2/WPA3, Personal เทียบ Enterprise และ 802.1X/EAP',
      order: 2,
      objectives: [
        'อธิบายวิวัฒนาการจาก WEP → WPA → WPA2 → WPA3',
        'แยกความต่างของโหมด Personal (PSK) กับ Enterprise (802.1X)',
        'อธิบายบทบาทของ 802.1X, EAP และ RADIUS ในการยืนยันตัวตน',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'WPA2/WPA3, Personal เทียบ Enterprise และ 802.1X',
          order: 0,
          estMinutes: 13,
          sections: [
            {
              heading: 'วิวัฒนาการความปลอดภัย Wi-Fi',
              body: [
                'เพราะคลื่นวิทยุ "ใครอยู่ในระยะก็ดักได้" ความปลอดภัยไร้สายจึงสำคัญมากและพัฒนามาหลายรุ่น:',
                '',
                '- **WEP** — รุ่นแรก แตกง่ายมาก **เลิกใช้แล้ว**',
                '- **WPA** — แก้ขัดชั่วคราวจาก WEP (TKIP)',
                '- **WPA2** — มาตรฐานหลักนานหลายปี ใช้ **AES-CCMP** ที่แข็งแรง',
                '- **WPA3** — รุ่นล่าสุด เพิ่ม **SAE** (กัน offline dictionary attack แม้รหัสอ่อน), forward secrecy และเข้ารหัสแม้เครือข่ายเปิด (OWE)',
              ].join('\n'),
            },
            {
              heading: 'Personal เทียบ Enterprise',
              body: [
                '- **Personal (PSK)** — ใช้รหัสร่วมกันทั้งเครือข่าย (pre-shared key) ตั้งง่าย เหมาะกับบ้าน/ร้านเล็ก แต่ทุกคนใช้รหัสเดียวกัน — คนออกต้องเปลี่ยนรหัสทั้งระบบ และแยกแยะผู้ใช้ไม่ได้',
                '- **Enterprise (802.1X)** — ผู้ใช้แต่ละคน login ด้วยบัญชีของตัวเอง ยืนยันตัวตนกับ **RADIUS server** กลาง เพิกถอนทีละคนได้ ตรวจสอบย้อนได้ว่าใครเชื่อมต่อ เหมาะกับองค์กร',
                '',
                'ทั้ง WPA2 และ WPA3 มีทั้งโหมด Personal และ Enterprise',
              ].join('\n'),
            },
            {
              heading: '802.1X, EAP และ RADIUS',
              body: [
                'การยืนยันตัวตนแบบ Enterprise มีสามผู้เล่น:',
                '',
                '- **Supplicant** — อุปกรณ์ผู้ใช้ที่ขอเข้า',
                '- **Authenticator** — AP/WLC (หรือสวิตช์) ที่กั้นประตูไว้',
                '- **Authentication Server** — **RADIUS** ที่ตัดสินว่าผ่านหรือไม่',
                '',
                '**802.1X** คือกรอบควบคุมการเข้าถึงที่พอร์ต ส่วน **EAP (Extensible Authentication Protocol)** คือ "ภาษา" ที่ใช้คุยกันระหว่างการยืนยันตัวตน (มีหลายแบบเช่น EAP-TLS ใช้ certificate, PEAP ใช้ username/password)',
                '',
                '> นี่คือหัวข้อเดียวกับ AAA/RADIUS ในคอร์ส Network Security — wireless Enterprise คือการนำ 802.1X มาใช้กับการเข้าถึงไร้สาย',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — ความปลอดภัยไร้สาย',
          order: 1,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'มาตรฐานความปลอดภัย Wi-Fi ใดที่ควรเลิกใช้เพราะแตกง่ายมาก',
              choices: ['WPA3', 'WPA2', 'WEP', 'AES-CCMP'],
              answer: [2],
              explanation: 'WEP เป็นรุ่นแรกสุดและแตกได้ง่ายมาก ปัจจุบันเลิกใช้แล้ว',
              points: 1,
            },
            {
              prompt: 'ในโหมด WPA2/WPA3 Enterprise ผู้ใช้ยืนยันตัวตนกับเซิร์ฟเวอร์ใด',
              choices: ['DNS server', 'RADIUS server', 'DHCP server', 'NTP server'],
              answer: [1],
              explanation: 'Enterprise ใช้ 802.1X ให้ผู้ใช้ยืนยันตัวตนกับ RADIUS server กลาง',
              points: 1,
            },
            {
              prompt: 'ข้อใดคือข้อดีหลักของโหมด Enterprise เทียบกับ Personal (PSK)',
              choices: [
                'ตั้งค่าง่ายกว่า',
                'ผู้ใช้แต่ละคนมีบัญชีของตัวเอง เพิกถอน/ตรวจสอบย้อนได้ทีละคน',
                'ไม่ต้องใช้รหัสผ่านเลย',
                'เร็วกว่ามาก',
              ],
              answer: [1],
              explanation: 'Enterprise ให้แต่ละคนใช้บัญชีของตัวเอง จึงเพิกถอนทีละคนและตรวจสอบย้อนได้ ต่างจาก PSK ที่ใช้รหัสร่วมกัน',
              points: 1,
            },
            {
              prompt: 'WPA3 เพิ่มกลไก SAE เข้ามาเพื่อแก้ปัญหาใดเป็นหลัก',
              choices: [
                'ทำให้ Wi-Fi เร็วขึ้น',
                'ป้องกัน offline dictionary attack แม้รหัสผ่านจะอ่อน',
                'เพิ่มระยะสัญญาณ',
                'รองรับ AP ได้มากขึ้น',
              ],
              answer: [1],
              explanation: 'SAE (Simultaneous Authentication of Equals) ป้องกันการเดารหัสแบบ offline ทำให้แม้รหัสอ่อนก็ปลอดภัยขึ้นมาก',
              points: 1,
            },
          ],
        },
      ],
    },

    // ── โมดูล 4 — WLAN Design & Troubleshooting ─────────────────────────
    {
      title: 'โมดูล 4 — การออกแบบและไล่ปัญหา WLAN',
      description: 'การวางแผน coverage, channel planning, roaming และปัญหาไร้สายที่พบบ่อย',
      order: 3,
      objectives: [
        'อธิบายแนวคิด coverage/capacity และ site survey',
        'อธิบายการวางแผนช่องสัญญาณเพื่อลด co-channel interference',
        'วินิจฉัยปัญหา WLAN ที่พบบ่อย (สัญญาณอ่อน, interference, roaming)',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'Coverage, Channel Planning, Roaming และการไล่ปัญหา',
          order: 0,
          estMinutes: 12,
          sections: [
            {
              heading: 'Coverage เทียบ Capacity และ Site Survey',
              body: [
                'การออกแบบ WLAN ต้องบาลานซ์สองอย่าง:',
                '',
                '- **Coverage** — สัญญาณครอบคลุมทุกจุดที่ต้องใช้ (วัดด้วยความแรงสัญญาณ RSSI และ SNR)',
                '- **Capacity** — รองรับจำนวนผู้ใช้/อุปกรณ์ที่หนาแน่นได้ (เช่นห้องประชุม ต้องมี AP มากขึ้นแม้พื้นที่เล็ก)',
                '',
                'พื้นที่หนาแน่นต้องเน้น capacity (AP ถี่ขึ้น กำลังส่งต่ำลงเพื่อไม่ให้กวนกัน) ส่วนพื้นที่โล่งเน้น coverage การทำ **site survey** (เดินวัดสัญญาณจริง) ช่วยวางตำแหน่ง AP ให้เหมาะ',
              ].join('\n'),
            },
            {
              heading: 'Channel Planning และ Roaming',
              body: [
                '**Co-channel interference** เกิดเมื่อ AP ใกล้กันใช้ช่องเดียว/ทับกัน ต้องรอคิวกันจน throughput ตก — แก้ด้วยการวางช่องสลับ (บน 2.4 GHz ใช้ 1/6/11) ให้ AP ที่อยู่ติดกันไม่ใช้ช่องเดียวกัน',
                '',
                '**Roaming** คือการที่อุปกรณ์ย้ายจาก AP หนึ่งไปอีกตัวขณะเคลื่อนที่ โดยไม่หลุดการเชื่อมต่อ การออกแบบที่ดีต้องมี **cell overlap** (พื้นที่สัญญาณ AP สองตัวซ้อนกันราว 15–20%) เพื่อให้ย้ายได้ลื่นก่อนสัญญาณเดิมหายหมด',
              ].join('\n'),
            },
            {
              heading: 'ปัญหา WLAN ที่พบบ่อย',
              body: [
                '| อาการ | สาเหตุที่พบบ่อย | แนวทางแก้ |',
                '|---|---|---|',
                '| สัญญาณอ่อน/หลุดบ่อย | AP ไกลเกิน, กำแพงหนา, กำลังส่งต่ำ | เพิ่ม AP, ย้ายตำแหน่ง, ปรับกำลังส่ง |',
                '| ช้าตอนคนเยอะ | capacity ไม่พอ, co-channel | เพิ่ม AP, ย้ายไป 5 GHz, จัดช่องใหม่ |',
                '| ถูกรบกวน | ไมโครเวฟ/บลูทูธ/AP เพื่อนบ้าน (2.4 GHz) | ย้ายช่อง, ใช้ 5 GHz |',
                '| roaming สะดุด | cell overlap น้อยเกิน | ปรับ coverage ให้ซ้อนกันพอเหมาะ |',
                '| client เชื่อมไม่ได้ | รหัส/802.1X ผิด, DHCP หมด | ตรวจ security config, pool DHCP |',
                '',
                '> ไล่ปัญหาไร้สายเริ่มที่ชั้นกายภาพของคลื่นเสมอ (สัญญาณ/ช่อง/interference) ก่อนค่อยขึ้นไปดู config/auth',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'quiz',
          title: 'แบบทดสอบ — ออกแบบและไล่ปัญหา WLAN',
          order: 1,
          estMinutes: 5,
          passThreshold: 60,
          questions: [
            {
              prompt: 'การที่ AP ใกล้กันใช้ช่องสัญญาณเดียวกันจนต้องรอคิวกันและ throughput ตก เรียกว่าอะไร',
              choices: ['Roaming', 'Co-channel interference', 'Cell overlap', 'Site survey'],
              answer: [1],
              explanation: 'Co-channel interference เกิดเมื่อ AP ใช้ช่องเดียว/ทับกัน แก้ด้วยการวางช่องสลับ (1/6/11)',
              points: 1,
            },
            {
              prompt: 'เพื่อให้ roaming ลื่นไหล การออกแบบ coverage ของ AP สองตัวที่ติดกันควรเป็นอย่างไร',
              choices: [
                'ไม่ให้สัญญาณซ้อนกันเลย',
                'มี cell overlap ซ้อนกันราว 15–20%',
                'ใช้ช่องเดียวกันทั้งหมด',
                'ปิด AP ตัวหนึ่ง',
              ],
              answer: [1],
              explanation: 'cell overlap ราว 15–20% ทำให้อุปกรณ์ย้าย AP ได้ก่อนสัญญาณเดิมหมด ทำให้ roaming ไม่สะดุด',
              points: 1,
            },
            {
              prompt: 'ห้องประชุมที่มีคนหนาแน่นในพื้นที่เล็ก ควรเน้นการออกแบบด้านใด',
              choices: ['Coverage เป็นหลัก', 'Capacity (AP ถี่ขึ้น กำลังส่งต่ำลง)', 'ใช้ AP ตัวเดียวกำลังส่งสูงสุด', 'ปิด 5 GHz'],
              answer: [1],
              explanation: 'พื้นที่หนาแน่นต้องเน้น capacity เพิ่ม AP และลดกำลังส่งเพื่อรองรับผู้ใช้จำนวนมากโดยไม่กวนกัน',
              points: 1,
            },
            {
              prompt: 'เมื่อไล่ปัญหา WLAN ควรเริ่มตรวจจากชั้นใดก่อน',
              choices: [
                'ชั้น application',
                'ชั้นกายภาพของคลื่น (สัญญาณ/ช่อง/interference)',
                'ชั้น DNS',
                'ชั้น routing',
              ],
              answer: [1],
              explanation: 'ปัญหาไร้สายมักอยู่ที่ชั้นกายภาพของคลื่น ควรตรวจสัญญาณ/ช่อง/interference ก่อนขึ้นไปดู config/auth',
              points: 1,
            },
          ],
        },
      ],
    },
  ],
};
