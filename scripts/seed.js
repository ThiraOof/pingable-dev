import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import Course from '../src/models/Course.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const courses = [
  {
    title: 'Network Fundamentals — VPCS Lab',
    description: 'ฝึกพื้นฐาน IP Addressing, Ping และ Static Routing ด้วย VPCS',
    level: 'beginner',
    published: true,
    labs: [
      {
        title: 'Lab 1 — Basic IP & Ping',
        description: 'ตั้งค่า IP address บน PC สองตัวที่อยู่ใน subnet เดียวกัน แล้วทดสอบการเชื่อมต่อด้วย ping',
        order: 0,
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
            { name: 'PC2', nodeType: 'vpcs', x:  150, y: 0 },
            { name: 'SW1', nodeType: 'ethernet_switch', x: 0, y: 0 },
          ],
          links: [
            { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
            { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
          ],
        },
        gradingChecks: [
          { description: 'PC1 มี IP 192.168.1.1/24',   node: 'PC1', command: 'show ip', expect: '192\\.168\\.1\\.1', points: 2 },
          { description: 'PC2 มี IP 192.168.1.2/24',   node: 'PC2', command: 'show ip', expect: '192\\.168\\.1\\.2', points: 2 },
          { description: 'PC1 ping PC2 ได้สำเร็จ',     node: 'PC1', command: 'ping 192.168.1.2', expect: 'bytes from 192\\.168\\.1\\.2', points: 3 },
          { description: 'PC2 ping PC1 ได้สำเร็จ',     node: 'PC2', command: 'ping 192.168.1.1', expect: 'bytes from 192\\.168\\.1\\.1', points: 3 },
        ],
      },
      {
        title: 'Lab 2 — Multiple Subnets',
        description: 'PC สองกลุ่มอยู่คนละ subnet เชื่อมกันผ่าน Switch แยก ฝึกเข้าใจ broadcast domain',
        order: 1,
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
            { name: 'PC2', nodeType: 'vpcs', x: -250, y:  80 },
            { name: 'PC3', nodeType: 'vpcs', x:  250, y: -80 },
            { name: 'PC4', nodeType: 'vpcs', x:  250, y:  80 },
            { name: 'SW1', nodeType: 'ethernet_switch', x: -100, y: 0 },
            { name: 'SW2', nodeType: 'ethernet_switch', x:  100, y: 0 },
          ],
          links: [
            { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
            { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
            { node1: 'PC3', port1: 0, node2: 'SW2', port2: 0 },
            { node1: 'PC4', port1: 0, node2: 'SW2', port2: 1 },
          ],
        },
        gradingChecks: [
          { description: 'PC1 มี IP 192.168.1.1/24',          node: 'PC1', command: 'show ip', expect: '192\\.168\\.1\\.1', points: 1 },
          { description: 'PC2 มี IP 192.168.1.2/24',          node: 'PC2', command: 'show ip', expect: '192\\.168\\.1\\.2', points: 1 },
          { description: 'PC3 มี IP 10.0.0.1/24',             node: 'PC3', command: 'show ip', expect: '10\\.0\\.0\\.1',   points: 1 },
          { description: 'PC4 มี IP 10.0.0.2/24',             node: 'PC4', command: 'show ip', expect: '10\\.0\\.0\\.2',   points: 1 },
          { description: 'PC1 ping PC2 ได้ (subnet เดียวกัน)', node: 'PC1', command: 'ping 192.168.1.2', expect: 'bytes from 192\\.168\\.1\\.2', points: 3 },
          { description: 'PC3 ping PC4 ได้ (subnet เดียวกัน)', node: 'PC3', command: 'ping 10.0.0.2',   expect: 'bytes from 10\\.0\\.0\\.2',   points: 3 },
        ],
      },
    ],
  },

  {
    title: 'IP Addressing & Subnetting',
    description: 'เจาะลึก subnet mask, VLSM และ default gateway ผ่านการลงมือตั้งค่าจริงบน VPCS',
    level: 'intermediate',
    published: true,
    labs: [
      {
        title: 'Lab 1 — Hosts in a /26 Subnet',
        description: 'ออกแบบและตั้งค่า host หลายตัวให้อยู่ใน subnet /26 (255.255.255.192) เดียวกัน แล้วยืนยัน connectivity แบบเต็ม',
        order: 0,
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
            { name: 'PC2', nodeType: 'vpcs', x:  200, y: -100 },
            { name: 'PC3', nodeType: 'vpcs', x:    0, y:  150 },
            { name: 'SW1', nodeType: 'ethernet_switch', x: 0, y: 0 },
          ],
          links: [
            { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
            { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
            { node1: 'PC3', port1: 0, node2: 'SW1', port2: 2 },
          ],
        },
        gradingChecks: [
          { description: 'PC1 ตั้งค่า 192.168.10.11/26',  node: 'PC1', command: 'show ip', expect: '192\\.168\\.10\\.11/26', points: 2 },
          { description: 'PC2 ตั้งค่า 192.168.10.22/26',  node: 'PC2', command: 'show ip', expect: '192\\.168\\.10\\.22/26', points: 2 },
          { description: 'PC3 ตั้งค่า 192.168.10.33/26',  node: 'PC3', command: 'show ip', expect: '192\\.168\\.10\\.33/26', points: 2 },
          { description: 'PC1 ping PC2 ได้',             node: 'PC1', command: 'ping 192.168.10.22', expect: 'bytes from 192\\.168\\.10\\.22', points: 2 },
          { description: 'PC1 ping PC3 ได้',             node: 'PC1', command: 'ping 192.168.10.33', expect: 'bytes from 192\\.168\\.10\\.33', points: 2 },
        ],
      },
      {
        title: 'Lab 2 — Default Gateway',
        description: 'ตั้งค่า default gateway ให้ host เพื่อเตรียมส่ง traffic ออกนอก subnet และยืนยันค่าใน routing ของ host',
        order: 1,
        objectives: [
          'เข้าใจบทบาทของ default gateway: ปลายทางที่ host ส่ง packet ไปเมื่อปลายทางอยู่นอก subnet',
          'ตั้งค่า PC1 = 192.168.20.10/24 gateway 192.168.20.1',
          'ตั้งค่า PC2 = 192.168.20.20/24 gateway 192.168.20.1',
          'ตรวจสอบว่า host บันทึก gateway ไว้ถูกต้อง และยังคง ping ภายใน subnet ได้',
        ],
        hints: [
          'VPCS ตั้ง gateway ในคำสั่งเดียว: `ip 192.168.20.10 255.255.255.0 192.168.20.1`',
          '`show ip` จะมีบรรทัด GATEWAY แสดง 192.168.20.1',
          'gateway มักเป็น IP ของ interface router ที่ต่อกับ subnet นี้ (ในแล็บนี้ยังไม่มี router จริง จึงเน้นการตั้งค่าให้ถูก)',
        ],
        topology: {
          nodes: [
            { name: 'PC1', nodeType: 'vpcs', x: -150, y: 0 },
            { name: 'PC2', nodeType: 'vpcs', x:  150, y: 0 },
            { name: 'SW1', nodeType: 'ethernet_switch', x: 0, y: 0 },
          ],
          links: [
            { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
            { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
          ],
        },
        gradingChecks: [
          { description: 'PC1 มี IP 192.168.20.10/24',       node: 'PC1', command: 'show ip', expect: '192\\.168\\.20\\.10/24', points: 2 },
          { description: 'PC1 ตั้ง gateway 192.168.20.1',     node: 'PC1', command: 'show ip', expect: 'GATEWAY\\s*:\\s*192\\.168\\.20\\.1', points: 3 },
          { description: 'PC2 มี IP 192.168.20.20/24',       node: 'PC2', command: 'show ip', expect: '192\\.168\\.20\\.20/24', points: 2 },
          { description: 'PC2 ตั้ง gateway 192.168.20.1',     node: 'PC2', command: 'show ip', expect: 'GATEWAY\\s*:\\s*192\\.168\\.20\\.1', points: 3 },
          { description: 'PC1 ping PC2 ภายใน subnet ได้',     node: 'PC1', command: 'ping 192.168.20.20', expect: 'bytes from 192\\.168\\.20\\.20', points: 2 },
        ],
      },
    ],
  },

  {
    title: 'Building & Scaling a LAN',
    description: 'ต่อขยาย LAN ด้วยหลาย switch (extended star) และเข้าใจว่า broadcast domain เดียวกันสื่อสารข้ามสวิตช์ได้อย่างไร',
    level: 'intermediate',
    published: true,
    labs: [
      {
        title: 'Lab 1 — Multi-Switch LAN',
        description: 'ต่อ switch สองตัวเข้าด้วยกัน วาง host บนแต่ละ switch ใน subnet เดียวกัน แล้วยืนยันว่าสื่อสารข้าม uplink ได้',
        order: 0,
        objectives: [
          'PC1, PC2 ต่ออยู่กับ SW1 และ PC3, PC4 ต่ออยู่กับ SW2',
          'SW1 กับ SW2 เชื่อมกันด้วย uplink หนึ่งเส้น',
          'ทุกเครื่องอยู่ใน 172.16.0.0/24 และ ping หากันได้ทั้งที่อยู่คนละ switch',
          'เข้าใจว่า switch ส่งต่อ frame ภายใน broadcast domain เดียวกัน ทำให้ host ข้ามสวิตช์คุยกันได้โดยไม่ต้อง route',
        ],
        hints: [
          'ตั้ง IP เช่น `ip 172.16.0.11 255.255.255.0` บนแต่ละ PC ให้ host part ไม่ซ้ำกัน',
          'การสื่อสารข้าม switch อาศัย uplink ระหว่าง SW1–SW2 ถ้าลิงก์นี้หลุด PC คนละฝั่งจะ ping ไม่ถึง',
          'ลอง `trace 172.16.0.44` จะเห็นว่าถึงปลายทางใน hop เดียว เพราะเป็น L2 เดียวกัน',
        ],
        topology: {
          nodes: [
            { name: 'PC1', nodeType: 'vpcs', x: -300, y: -80 },
            { name: 'PC2', nodeType: 'vpcs', x: -300, y:  80 },
            { name: 'PC3', nodeType: 'vpcs', x:  300, y: -80 },
            { name: 'PC4', nodeType: 'vpcs', x:  300, y:  80 },
            { name: 'SW1', nodeType: 'ethernet_switch', x: -120, y: 0 },
            { name: 'SW2', nodeType: 'ethernet_switch', x:  120, y: 0 },
          ],
          links: [
            { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
            { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
            { node1: 'PC3', port1: 0, node2: 'SW2', port2: 0 },
            { node1: 'PC4', port1: 0, node2: 'SW2', port2: 1 },
            { node1: 'SW1', port1: 7, node2: 'SW2', port2: 7 },
          ],
        },
        gradingChecks: [
          { description: 'PC1 มี IP 172.16.0.11/24',            node: 'PC1', command: 'show ip', expect: '172\\.16\\.0\\.11/24', points: 1 },
          { description: 'PC4 มี IP 172.16.0.44/24',            node: 'PC4', command: 'show ip', expect: '172\\.16\\.0\\.44/24', points: 1 },
          { description: 'PC1 ping PC2 ได้ (SW1 เดียวกัน)',      node: 'PC1', command: 'ping 172.16.0.22', expect: 'bytes from 172\\.16\\.0\\.22', points: 2 },
          { description: 'PC1 ping PC3 ได้ (ข้าม SW1→SW2)',     node: 'PC1', command: 'ping 172.16.0.33', expect: 'bytes from 172\\.16\\.0\\.33', points: 3 },
          { description: 'PC1 ping PC4 ได้ (ข้าม SW1→SW2)',     node: 'PC1', command: 'ping 172.16.0.44', expect: 'bytes from 172\\.16\\.0\\.44', points: 3 },
        ],
      },
    ],
  },

  {
    title: 'Network Troubleshooting & Tools',
    description: 'ฝึกใช้เครื่องมือวินิจฉัยเครือข่าย (ping, trace) อย่างเป็นระบบ และซ่อม host ที่ตั้งค่าผิด',
    level: 'intermediate',
    published: true,
    labs: [
      {
        title: 'Lab 1 — Fix the Broken Host',
        description: 'PC ทั้งหมดต้อง ping หากันได้ใน 192.168.50.0/24 — ลงมือตั้งค่า host ทุกเครื่องให้ถูก subnet/mask แล้วพิสูจน์ด้วย ping',
        order: 0,
        objectives: [
          'วิเคราะห์ว่า host ที่ ping ไม่ถึงเกิดจาก IP/mask ผิด subnet',
          'ตั้งค่า PC1 = 192.168.50.10/24, PC2 = 192.168.50.20/24, PC3 = 192.168.50.30/24 ให้อยู่ network เดียวกัน',
          'ยืนยันว่าทุกเครื่อง ping หากันได้หลังแก้ไข',
        ],
        hints: [
          'mask /24 (255.255.255.0) ต้องเหมือนกันทุกเครื่อง และ network part (192.168.50) ต้องตรงกัน',
          'ถ้า ping ขึ้น "host not reachable" ให้ใช้ `show ip` เทียบ IP/MASK ของแต่ละเครื่อง',
          'host part (เลขชุดสุดท้าย) ต้องไม่ซ้ำกัน และต้องไม่ใช่ .0 หรือ .255',
        ],
        topology: {
          nodes: [
            { name: 'PC1', nodeType: 'vpcs', x: -200, y: -100 },
            { name: 'PC2', nodeType: 'vpcs', x:  200, y: -100 },
            { name: 'PC3', nodeType: 'vpcs', x:    0, y:  150 },
            { name: 'SW1', nodeType: 'ethernet_switch', x: 0, y: 0 },
          ],
          links: [
            { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
            { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
            { node1: 'PC3', port1: 0, node2: 'SW1', port2: 2 },
          ],
        },
        gradingChecks: [
          { description: 'PC1 อยู่ใน 192.168.50.0/24',  node: 'PC1', command: 'show ip', expect: '192\\.168\\.50\\.10/24', points: 2 },
          { description: 'PC2 อยู่ใน 192.168.50.0/24',  node: 'PC2', command: 'show ip', expect: '192\\.168\\.50\\.20/24', points: 2 },
          { description: 'PC3 อยู่ใน 192.168.50.0/24',  node: 'PC3', command: 'show ip', expect: '192\\.168\\.50\\.30/24', points: 2 },
          { description: 'PC1 ping PC2 ได้',           node: 'PC1', command: 'ping 192.168.50.20', expect: 'bytes from 192\\.168\\.50\\.20', points: 2 },
          { description: 'PC2 ping PC3 ได้',           node: 'PC2', command: 'ping 192.168.50.30', expect: 'bytes from 192\\.168\\.50\\.30', points: 2 },
        ],
      },
      {
        title: 'Lab 2 — Trace the Path',
        description: 'ใช้ ping และ trace เพื่อตรวจสอบเส้นทางและ connectivity ใน LAN และเข้าใจผลลัพธ์ของ traceroute',
        order: 1,
        objectives: [
          'ตั้งค่า PC1 = 10.10.10.1/24, PC2 = 10.10.10.2/24, PC3 = 10.10.10.3/24',
          'ใช้ `ping` ยืนยัน reachability ระหว่างเครื่อง',
          'ใช้ `trace` ดูเส้นทางไปยังปลายทาง — ใน LAN เดียวกันจะถึงใน hop เดียว',
        ],
        hints: [
          'คำสั่ง traceroute บน VPCS คือ `trace 10.10.10.3`',
          'ปลายทางที่อยู่ subnet เดียวกันจะปรากฏเป็น hop แรกและ hop สุดท้ายพร้อมกัน',
          'ถ้า trace ค้างหรือไม่ถึง ให้ตรวจ IP/mask ด้วย `show ip` ก่อน',
        ],
        topology: {
          nodes: [
            { name: 'PC1', nodeType: 'vpcs', x: -200, y: 0 },
            { name: 'PC2', nodeType: 'vpcs', x:    0, y: 150 },
            { name: 'PC3', nodeType: 'vpcs', x:  200, y: 0 },
            { name: 'SW1', nodeType: 'ethernet_switch', x: 0, y: 0 },
          ],
          links: [
            { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
            { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
            { node1: 'PC3', port1: 0, node2: 'SW1', port2: 2 },
          ],
        },
        gradingChecks: [
          { description: 'PC1 มี IP 10.10.10.1/24',        node: 'PC1', command: 'show ip', expect: '10\\.10\\.10\\.1/24', points: 2 },
          { description: 'PC3 มี IP 10.10.10.3/24',        node: 'PC3', command: 'show ip', expect: '10\\.10\\.10\\.3/24', points: 2 },
          { description: 'PC1 ping PC3 ได้',               node: 'PC1', command: 'ping 10.10.10.3', expect: 'bytes from 10\\.10\\.10\\.3', points: 3 },
          { description: 'PC1 trace ถึง PC3 (10.10.10.3)', node: 'PC1', command: 'trace 10.10.10.3', expect: '10\\.10\\.10\\.3', points: 3 },
        ],
      },
    ],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pingable-dev');
  console.log('MongoDB connected');

  await Course.deleteMany({});
  console.log('Cleared existing courses');

  const inserted = await Course.insertMany(courses);
  console.log(`Seeded ${inserted.length} course(s):`);
  inserted.forEach((c) => {
    console.log(`  [${c._id}] ${c.title} — ${c.labs.length} labs`);
  });

  await mongoose.disconnect();
  console.log('Done');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
