// Playground — โหมดเล่นอิสระ (Sandbox)
// Lab เปล่าไม่มี gradingChecks: ใช้ lifecycle เดิมทุกอย่าง (start/heartbeat/
// sweeper/stop) แต่หน้า lab จะซ่อนปุ่มตรวจและขึ้นป้าย "โหมดเล่นอิสระ" แทน
// เหมาะกับการทดลองคำสั่ง ซ้อมก่อนสอบ หรือพังแล้วซ่อมเองโดยไม่มีคะแนนกดดัน

import { vyos, pc, sw } from './_vyos.js';

export default {
  slug: 'playground',
  title: 'Playground — สนามซ้อมอิสระ',
  description: 'พื้นที่ทดลองไม่มีการตรวจคะแนน — เลือก topology ที่อยากเล่น แล้วทำอะไรก็ได้: ลองคำสั่งใหม่ ซ้อม config ก่อนสอบ หรือตั้งใจพังระบบแล้วซ่อมเอง อุปกรณ์เป็นของจริงทั้งหมด',
  level: 'beginner',
  track: 'Playground',
  estimatedHours: 2,
  prerequisites: [],
  published: true,
  modules: [
    {
      title: 'สนามซ้อม — เลือก Topology ที่อยากเล่น',
      description: 'ทุกห้องไม่มีการตรวจคะแนน ใช้ทรัพยากรตามกติกาเดียวกับ lab ปกติ (ปิดอัตโนมัติเมื่อไม่มีการใช้งาน)',
      order: 0,
      objectives: [
        'ทดลองคำสั่งได้อย่างอิสระโดยไม่มีผลต่อคะแนน',
        'ซ้อม config ที่เรียนมาก่อนกลับไปตรวจจริงใน lab ของคอร์ส',
      ],
      lessons: [
        {
          type: 'lab',
          title: 'สนามซ้อม — LAN สวิตช์ + 4 PC',
          order: 0,
          estMinutes: 30,
          description: 'วงแลนเปล่า ๆ หนึ่งวง: สวิตช์หนึ่งตัวกับ PC สี่เครื่อง — สนามซ้อมพื้นฐานที่สุด',
          objectives: [
            'ไอเดียชวนลอง: แจก IP เองทั้งวง แล้ว ping ให้ครบทุกคู่',
            'ลองตั้งสองเครื่องให้ IP ชนกัน แล้วสังเกตอาการ',
            'ลองคนละ subnet บนสวิตช์เดียวกัน — ทำไม ping ไม่ถึง?',
          ],
          hints: [
            'VPCS: `ip <address> <mask> [gateway]` · `show ip` · `ping <ip>` · `trace <ip>`',
            'ล้างค่า: `clear ip` — เริ่มใหม่ได้เสมอ ที่นี่ไม่มีคะแนน',
          ],
          topology: {
            nodes: [ pc('PC1', -250, -100), pc('PC2', -250, 100), pc('PC3', 250, -100), pc('PC4', 250, 100), sw('SW1', 0, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
              { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
              { node1: 'PC3', port1: 0, node2: 'SW1', port2: 2 },
              { node1: 'PC4', port1: 0, node2: 'SW1', port2: 3 },
            ],
          },
          gradingChecks: [],
        },
        {
          type: 'lab',
          title: 'สนามซ้อม — VyOS Router คู่',
          order: 1,
          estMinutes: 45,
          description: 'VyOS สองตัวต่อตรงถึงกันสองลิงก์ — เล่นได้ตั้งแต่ static route, BGP, GRE จนถึง bonding',
          objectives: [
            'ไอเดียชวนลอง: ตั้ง IP บนลิงก์แล้ว ping ข้าม จากนั้นลอง eBGP สอง AS',
            'ลองขุด GRE tunnel ทับลิงก์ แล้ว ping ผ่าน overlay',
            'ลองรวมสองลิงก์เป็น LACP bond — แบนด์วิดท์คูณสอง',
          ],
          hints: [
            'เข้า config mode: `configure` · ใช้ `set ...` · `commit` · `save` · ออกด้วย `exit`',
            'ดูของจริง: `show interfaces` · `show ip route` · `show configuration commands`',
            'login: vyos / vyos — เครื่องนี้พังได้เต็มที่ กดเริ่ม Lab ใหม่เมื่อไหร่ก็ได้',
          ],
          topology: {
            nodes: [ vyos('R1', -200, 0), vyos('R2', 200, 0) ],
            links: [
              { node1: 'R1', port1: 1, node2: 'R2', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 2 },
            ],
          },
          gradingChecks: [],
        },
        {
          type: 'lab',
          title: 'สนามซ้อม — Router + สวิตช์ + 2 PC',
          order: 2,
          estMinutes: 45,
          description: 'โครงสร้าง router-on-a-stick: ซ้อม VLAN, inter-VLAN routing, DHCP server หรือ firewall ได้ครบในห้องเดียว',
          objectives: [
            'ไอเดียชวนลอง: แบ่ง PC สองเครื่องคนละ VLAN แล้ว route ข้ามผ่าน R1',
            'ลองตั้ง R1 เป็น DHCP server แจก IP ให้ PC',
            'ลองเขียน firewall กั้นไม่ให้ PC1 เห็น PC2',
          ],
          hints: [
            'VLAN บน VyOS: `set interfaces ethernet eth1 vif <id> address <ip/มาสก์>`',
            'สวิตช์ใน GNS3 ตั้งพอร์ต access/dot1q ได้จากหน้า config ของ SW1',
            'DHCP: `set service dhcp-server shared-network-name LAN subnet ... range ...`',
          ],
          topology: {
            nodes: [ pc('PC1', -280, -120), pc('PC2', -280, 120), sw('SW1', -40, 0), vyos('R1', 220, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'SW1', port2: 0 },
              { node1: 'PC2', port1: 0, node2: 'SW1', port2: 1 },
              { node1: 'SW1', port1: 2, node2: 'R1', port2: 1 },
            ],
          },
          gradingChecks: [],
        },
        {
          type: 'lab',
          title: 'สนามซ้อม — สามเหลี่ยม Router + 2 LAN',
          order: 3,
          estMinutes: 60,
          description: 'สาม router ต่อเป็นวงแหวน มี LAN ปลายทางสองฝั่ง — สนามใหญ่สุดสำหรับซ้อม routing แบบมีทางเลือกเส้นทาง',
          objectives: [
            'ไอเดียชวนลอง: ทำ static route ให้ PC1 คุยกับ PC2 ข้ามสาม hop',
            'ลองตัดลิงก์เส้นหนึ่ง (ปิด interface) แล้วหาเส้นทางสำรอง',
            'ลอง iBGP/route reflector สามตัว หรือ NAT ที่ขอบเครือข่าย',
          ],
          hints: [
            'ตั้งชื่อวงให้จำง่าย เช่น R1–R2 = 10.0.12.0/30, R2–R3 = 10.0.23.0/30, R1–R3 = 10.0.13.0/30',
            'static route: `set protocols static route <ปลายทาง> next-hop <ip>`',
            'ดูเส้นทางที่เลือกจริง: `show ip route` และทดสอบด้วย `traceroute`',
          ],
          topology: {
            nodes: [ pc('PC1', -360, 0), vyos('R1', -180, 0), vyos('R2', 60, -130), vyos('R3', 60, 130), pc('PC2', 280, 130) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 1 },
              { node1: 'R1', port1: 3, node2: 'R3', port2: 1 },
              { node1: 'R2', port1: 2, node2: 'R3', port2: 2 },
              { node1: 'R3', port1: 3, node2: 'PC2', port2: 0 },
            ],
          },
          gradingChecks: [],
        },
      ],
    },
  ],
};
