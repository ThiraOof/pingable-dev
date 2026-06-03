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
