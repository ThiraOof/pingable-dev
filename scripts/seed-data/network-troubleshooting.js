// Network Troubleshooting — โจทย์ "ระบบพังมาแล้ว หาให้เจอ ซ่อมให้ได้"
//
// ทุก lab เป็น mode: 'troubleshoot' — หลังอุปกรณ์บูตครบ ระบบจะฉีด
// `setupCommands` (config ที่ทำงานเกือบสมบูรณ์แต่พังจุดเดียว) ผ่าน telnet
// เดียวกับ grader แล้วค่อยปลดปุ่มตรวจ ผู้เรียนเห็นแค่ "อาการ" จาก ticket
// ต้องไล่หาสาเหตุเองเหมือนงาน NOC จริง
//
// หลักการออกแบบความพัง: ระดับต้น 1 จุด/lab, Boss 3 จุด — และ hints เขียน
// เป็นบันได (อาการ → จุดที่ควรดู → คำสั่งที่ช่วย) ไม่เฉลยตรง ๆ

import { vyos, pc } from './_vyos.js';

export default {
  slug: 'network-troubleshooting',
  title: 'Network Troubleshooting — ซ่อมระบบที่พังจริง',
  description: 'คอร์สแนว troubleshoot ล้วน: ทุกแล็บคือระบบที่ถูกตั้งค่าพังมาแล้วจริง ๆ บนอุปกรณ์จริง คุณได้แค่ใบแจ้งปัญหากับอาการ — ไล่หาสาเหตุด้วยคำสั่ง show แล้วซ่อมให้เครือข่ายกลับมาทำงาน เหมือนชีวิตวิศวกรเครือข่ายวันจริงทุกประการ',
  level: 'advanced',
  track: 'Enterprise Networking',
  estimatedHours: 8,
  prerequisites: ['ใช้ VyOS CLI ได้ (คอร์ส Enterprise Core Networking)', 'เข้าใจ routing/NAT/VLAN พื้นฐาน'],
  published: true,
  modules: [
    {
      title: 'โมดูล 1 — วิธีคิดและโจทย์ซ่อมระดับต้น',
      description: 'กระบวนการไล่ปัญหาอย่างเป็นระบบ แล้วลงสนามกับความพังทีละจุด',
      order: 0,
      objectives: [
        'ไล่ปัญหาตามชั้น (bottom-up) ด้วยคำสั่ง show อย่างเป็นระบบ',
        'วินิจฉัย interface down, BGP peering ไม่ขึ้น และ NAT ผิดกฎ',
      ],
      lessons: [
        {
          type: 'reading',
          title: 'สี่ขั้นของการไล่ปัญหาแบบมือโปร',
          order: 0,
          estMinutes: 10,
          sections: [
            {
              heading: '1. เก็บอาการ ก่อนแตะ config',
              body: [
                'มือใหม่รีบแก้ มือโปรรีบ**ดู** — เริ่มจากคำถามสามข้อ:',
                '',
                '- อะไร "ใช้ไม่ได้" และอะไร "ยังใช้ได้"? (ขอบเขตของปัญหาคือคำใบ้ที่ดีที่สุด)',
                '- พังตั้งแต่เมื่อไหร่ มีอะไรเปลี่ยนก่อนหน้านั้น?',
                '- ทำซ้ำได้ไหม? `ping` / `traceroute` ให้ผลเหมือนเดิมทุกครั้งหรือเปล่า?',
              ].join('\n'),
            },
            {
              heading: '2. ไล่จากล่างขึ้นบน',
              body: [
                'ลำดับคำสั่งคู่ใจบน VyOS:',
                '',
                '```',
                'show interfaces            ← L1/L2: ลิงก์ u/u ไหม',
                'show ip route              ← L3: มีเส้นทางไปปลายทางไหม',
                'show ip bgp summary        ← protocol: peering ขึ้นไหม',
                'show nat source translations  ← มีการแปลงเกิดขึ้นจริงไหม',
                'show configuration commands | match <คำ>  ← config จุดนั้นว่าอะไร',
                '```',
                '',
                'A/D (admin down) ≠ A/U ≠ u/u — ตัวอักษรสองตัวนี้บอกได้เลยว่าปัญหาอยู่ชั้นไหน',
              ].join('\n'),
            },
            {
              heading: '3. ตั้งสมมติฐาน แก้ทีละอย่าง',
              body: [
                'เปลี่ยนหนึ่งอย่าง → ทดสอบ → จด ถ้าแก้แล้วไม่หาย ให้ย้อนกลับก่อนลองสมมติฐานถัดไป',
                'การเปลี่ยนหลายอย่างพร้อมกันคือวิธีสร้างปัญหาที่สอง',
              ].join('\n'),
            },
            {
              heading: '4. พิสูจน์ว่าหายจริง',
              body: [
                'ซ่อมเสร็จต้องทดสอบจาก**มุมมองผู้ใช้** ไม่ใช่แค่จาก router — ping จากเครื่องปลายทาง',
                'จนถึงปลายทางจริง แล้วค่อยปิด ticket ในคอร์สนี้ปุ่ม "ตรวจคำตอบ" คือผู้ใช้ของคุณ',
              ].join('\n'),
            },
          ],
        },
        {
          type: 'lab',
          title: 'ซ่อม #1 — ลิงก์ระหว่างสาขาเงียบสนิท',
          order: 1,
          estMinutes: 20,
          mode: 'troubleshoot',
          description: 'ลิงก์ R1–R2 ตั้ง IP ถูกต้องทั้งสองฝั่ง แต่ ping ไม่ผ่านสักแพ็กเก็ต — หาให้เจอว่าทำไม',
          scenario: {
            from: 'คุณฝน NOC กะดึก',
            priority: 'high',
            body: 'กราฟ traffic ลิงก์ไปสาขาระยองดิ่งเป็นศูนย์ตั้งแต่ตีหนึ่งค่ะ สาขาโทรมาบอกใช้ระบบไม่ได้ทั้งออฟฟิศ ทีมกะดึกบอกว่าเมื่อคืน "มีการ maintenance อะไรสักอย่าง" บนอุปกรณ์ฝั่งสำนักงานใหญ่ แต่ใครทำอะไรไว้ไม่มีบันทึก... ฝากเช็คด่วนเลยนะคะ',
          },
          objectives: [
            'หาสาเหตุที่ลิงก์ R1–R2 ไม่สื่อสาร ทั้งที่ IP ถูกต้อง',
            'ซ่อมให้ interface ฝั่งที่มีปัญหากลับมา u/u',
            'พิสูจน์ด้วย ping ข้ามลิงก์',
          ],
          hints: [
            'เริ่มที่ L1/L2 เสมอ: `show interfaces` บนทั้งสองเครื่อง — สังเกตคอลัมน์สถานะ (u/u, A/D)',
            'A/D = Administratively Down — ไม่ใช่สายหลุด แต่มีคนสั่งปิดไว้ใน config',
            'หาคำสั่งที่ปิดมัน: `show configuration commands | match disable` แล้วลบทิ้งด้วย `delete interfaces ethernet eth1 disable` (อย่าลืม commit)',
          ],
          topology: {
            nodes: [ vyos('R1', -200, 0), vyos('R2', 200, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.1/24',
              'set interfaces ethernet eth1 disable',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.2/24',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'eth1 ของ R1 กลับมา u/u', node: 'R1', command: 'show interfaces | match eth1', expect: 'eth1.+u/u', points: 4,
              failHint: 'eth1 ของ R1 ยังไม่ u/u — ดูสถานะใน `show interfaces`: ถ้าเป็น A/D แปลว่าโดนสั่งปิดใน config ลองหาว่าคำสั่งไหนปิดไว้' },
            { description: 'R1 ping R2 (10.0.12.2) ได้', node: 'R1', command: 'ping 10.0.12.2 count 3', expect: 'bytes from 10\\.0\\.12\\.2', points: 5,
              failHint: 'ยัง ping ไม่ผ่าน — ถ้าแก้ disable แล้ว อย่าลืม `commit` การแก้ใน configure mode ไม่มีผลจนกว่าจะ commit' },
          ],
        },
        {
          type: 'lab',
          title: 'ซ่อม #2 — BGP peering ไม่ยอมขึ้น',
          order: 2,
          estMinutes: 30,
          mode: 'troubleshoot',
          description: 'eBGP ระหว่างเรากับพาร์ตเนอร์ตั้งครบทุกบรรทัด แต่ session ไม่ Established และไม่มี route แลกกันเลย',
          scenario: {
            from: 'พี่ต้น Network Architect',
            priority: 'high',
            body: 'พาร์ตเนอร์ (AS 65002) โทรมาว่า BGP session ฝั่งเขาขึ้นสถานะ Active ค้างมาเป็นชั่วโมง เส้นทางไม่แลกกัน ระบบแลกเปลี่ยนข้อมูลหยุดเดิน ฝั่งเรา config ก็ "ดูครบ" นะ — แต่พี่ว่ามีอะไรพิมพ์ผิดสักที่ตอนตั้งเมื่อวาน ตาน้องแล้ว หาให้เจอ',
          },
          objectives: [
            'วินิจฉัยว่าทำไม eBGP session ระหว่าง R1 (AS 65001) กับ R2 (AS 65002) ไม่ขึ้น',
            'ซ่อมให้ peering Established และเรียนรู้เส้นทาง 192.168.2.0/24 จาก R2',
            'พิสูจน์ด้วยการ ping ไปยัง 192.168.2.1',
          ],
          hints: [
            'เริ่มจาก `show ip bgp summary` บน R1 — สถานะอะไร และ "AS ของเพื่อนบ้าน" ที่ตั้งไว้คือเลขอะไร',
            'BGP จะจับมือกันได้ก็ต่อเมื่อ remote-as ที่เราตั้ง ตรงกับ system-as ของอีกฝั่ง "จริง ๆ" — เทียบเลขสองฝั่งดี ๆ',
            'แก้ค่าได้ด้วย `set protocols bgp neighbor 10.0.12.2 remote-as <เลขที่ถูก>` (set ทับค่าเดิมได้เลย) แล้ว commit — session ใช้เวลาขึ้นไม่กี่วินาที',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.1/24',
              'set interfaces dummy dum0 address 192.168.1.1/24',
              'set protocols bgp system-as 65001',
              'set protocols bgp neighbor 10.0.12.2 remote-as 65999',
              'set protocols bgp neighbor 10.0.12.2 address-family ipv4-unicast',
              'set protocols bgp address-family ipv4-unicast network 192.168.1.0/24',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.2/24',
              'set interfaces dummy dum0 address 192.168.2.1/24',
              'set protocols bgp system-as 65002',
              'set protocols bgp neighbor 10.0.12.1 remote-as 65001',
              'set protocols bgp neighbor 10.0.12.1 address-family ipv4-unicast',
              'set protocols bgp address-family ipv4-unicast network 192.168.2.0/24',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'R1 เรียนรู้ 192.168.2.0/24 ผ่าน BGP', node: 'R1', command: 'show ip route bgp | match 192.168.2', expect: '192\\.168\\.2\\.0', points: 4,
              failHint: 'ยังไม่มีเส้นทางจาก BGP — `show ip bgp summary` ดูสถานะ neighbor: ถ้าไม่ Established ให้สงสัยค่า remote-as ที่ตั้งไว้ฝั่ง R1 ว่าตรงกับ AS จริงของ R2 (65002) หรือไม่' },
            { description: 'R1 ping เครือข่ายของพาร์ตเนอร์ (192.168.2.1) ได้', node: 'R1', command: 'ping 192.168.2.1 count 3', expect: 'bytes from 192\\.168\\.2\\.1', points: 4,
              failHint: 'route มาแล้วแต่ ping ยังไม่ถึง — รอ BGP converge สักครู่แล้วลองใหม่ หรือเช็คว่า R1 ยังโฆษณา 192.168.1.0/24 อยู่ (อีกฝั่งต้องรู้ทางกลับด้วย)' },
            { description: 'remote-as บน R1 ชี้ไปยัง AS ที่ถูกต้อง', node: 'R1', command: 'show configuration commands | match "remote-as"', expect: '65002', points: 1,
              failHint: 'config ของ R1 ยังอ้าง AS ผิดตัว — พาร์ตเนอร์คือ AS 65002' },
          ],
        },
        {
          type: 'lab',
          title: 'ซ่อม #3 — ออฟฟิศทั้งวงออกเน็ตไม่ได้',
          order: 3,
          estMinutes: 30,
          mode: 'troubleshoot',
          description: 'เครื่องลูกข่ายถึง gateway ได้ปกติ แต่ออกไปข้างนอกไม่ได้สักเครื่อง — NAT มีกฎอยู่ แต่ทำไมไม่ทำงาน?',
          scenario: {
            from: 'คุณเจน ผู้จัดการสาขาใหม่',
            priority: 'high',
            body: 'เน็ตทั้งสาขาล่มค่ะ! เครื่องทุกตัว ping หากันเองได้ ปริ้นเตอร์ใช้ได้ แต่ออกอินเทอร์เน็ตไม่ได้เลยสักเครื่อง ISP ยืนยันแล้วว่าลิงก์ฝั่งเขาปกติ... เอ๊ะ เมื่อเช้ามีน้องในทีมบอกว่า "จัดระเบียบ config NAT ใหม่ให้อ่านง่ายขึ้น" — เกี่ยวกันไหมคะเนี่ย',
          },
          objectives: [
            'ตั้งค่า PC1 = 192.168.1.10/24 gateway 192.168.1.1 (เครื่องผู้ใช้ปกติ)',
            'วินิจฉัยว่าทำไมทราฟฟิกขาออกไม่ถูก NAT ทั้งที่กฎ masquerade มีอยู่',
            'ซ่อมแล้วพิสูจน์ว่า PC1 ออกไปถึงเครือข่ายภายนอก (10.0.12.2) ได้',
          ],
          hints: [
            'ทดสอบจาก PC1: ถึง gateway (192.168.1.1) ได้ไหม → ถ้าได้ ปัญหาอยู่ "หลัง" gateway ไม่ใช่ในวง LAN',
            'บน R1 ดู `show nat source translations` — ว่างเปล่า = ไม่มีทราฟฟิกตรงกับกฎเลย ลองดูตัวกฎ: `show configuration commands | match "nat source"`',
            'อ่าน source address ในกฎดี ๆ — มันครอบวงของ PC1 (192.168.1.0/24) จริงหรือเปล่า? แก้ด้วย `set nat source rule 100 source address <วงที่ถูก>` แล้ว commit',
          ],
          topology: {
            nodes: [ pc('PC1', -300, 0), vyos('R1', -40, 0), vyos('R2', 240, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 1 },
            ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 address 192.168.1.1/24',
              'set interfaces ethernet eth2 address 10.0.12.1/30',
              'set nat source rule 100 source address 192.168.99.0/24',
              'set nat source rule 100 outbound-interface name eth2',
              'set nat source rule 100 translation address masquerade',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.2/30',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'PC1 ถึง gateway (192.168.1.1) ได้', node: 'PC1', command: 'ping 192.168.1.1', expect: 'bytes from 192\\.168\\.1\\.1', points: 2,
              failHint: 'ยังไม่ถึง gateway — ขั้นแรกตั้ง IP บน PC1 ก่อน: `ip 192.168.1.10 255.255.255.0 192.168.1.1` (ต้องครบสามค่า รวม gateway)' },
            { description: 'PC1 ออกสู่ภายนอก (10.0.12.2) ผ่าน NAT ได้', node: 'PC1', command: 'ping 10.0.12.2', expect: 'bytes from 10\\.0\\.12\\.2', points: 5,
              failHint: 'ในวงได้แต่ออกนอกไม่ได้ = อาการคลาสสิกของ NAT ไม่จับ — เทียบ source address ในกฎ NAT กับวงจริงของ PC1 ว่าตรงกันไหม (R2 ไม่มี route กลับมาวง LAN — มีแต่ NAT เท่านั้นที่พาออกได้)' },
            { description: 'กฎ NAT ครอบวง LAN ที่ถูกต้อง', node: 'R1', command: 'show configuration commands | match "source address"', expect: '192\\.168\\.1\\.0/24', points: 2,
              failHint: 'กฎ NAT ยังอ้างวงผิด — วงจริงของสาขาคือ 192.168.1.0/24' },
          ],
        },
      ],
    },
    {
      title: 'โมดูล 2 — โจทย์ซ่อมขั้นสูง และ Boss Lab',
      description: 'ความพังที่ซ่อนลึกขึ้น ปิดท้ายด้วยด่านสุดท้ายที่พังสามจุดซ้อนกัน',
      order: 1,
      objectives: [
        'วินิจฉัยปัญหาที่ config "ดูถูก" แต่ค่าไม่ตรงกันระหว่างอุปกรณ์',
        'รับมือเหตุการณ์ที่มีหลายความผิดพลาดพร้อมกันอย่างเป็นระบบ',
      ],
      lessons: [
        {
          type: 'lab',
          title: 'ซ่อม #4 — สอง VLAN ที่ไม่เคยเจอกัน',
          order: 0,
          estMinutes: 25,
          mode: 'troubleshoot',
          description: 'trunk ระหว่างตึกขึ้นปกติ sub-interface ก็มีทั้งสองฝั่ง แต่ ping ข้ามไม่เคยผ่าน — ทำไม?',
          scenario: {
            from: 'พี่เบียร์ หัวหน้าฝ่าย IT',
            priority: 'medium',
            body: 'วงกล้องวงจรปิดระหว่างตึก A กับตึก B ไม่เห็นกันมาตั้งแต่ติดตั้งเสร็จเมื่อวาน ผู้รับเหมายืนยันเป็นมั่นเหมาะว่า "config สองฝั่งเหมือนกันเป๊ะ ตรวจสามรอบแล้ว" ก่อนปิดงานกลับบ้านไปแล้วด้วย... พี่ชักไม่แน่ใจคำว่า "เหมือนกัน" ของเขาแล้วล่ะ น้องช่วยดูที',
          },
          objectives: [
            'วินิจฉัยว่าทำไมทราฟฟิก VLAN ไม่ข้าม trunk ทั้งที่ลิงก์ u/u',
            'ทำให้ทั้งสองฝั่งอยู่ VLAN 10 (วง 10.0.10.0/24) ตรงกัน',
            'พิสูจน์ด้วย ping ข้าม trunk',
          ],
          hints: [
            'ลิงก์ u/u แต่ ping ไม่ผ่าน บน trunk 802.1Q → สงสัยเรื่อง "แท็ก" เป็นอันดับแรก',
            'เทียบ config สองฝั่ง: `show configuration commands | match vif` — เลข vif (VLAN ID) ต้องตรงกันทั้งคู่ frame ที่แท็ก VLAN 10 จะถูกฝั่งที่ฟังอยู่ VLAN 20 ทิ้งเงียบ ๆ',
            'ฝั่งที่ผิดให้ลบ vif เดิมทิ้งก่อน (`delete interfaces ethernet eth1 vif 20`) แล้วสร้าง vif 10 ด้วย IP เดิม อย่าลืม commit',
          ],
          topology: {
            nodes: [ vyos('R1', -200, 0), vyos('R2', 200, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 vif 10 address 10.0.10.1/24',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 vif 20 address 10.0.10.2/24',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'R2 ใช้ VLAN 10 ตรงกับ R1', node: 'R2', command: 'show configuration commands | match "vif 10"', expect: 'vif 10', points: 3,
              failHint: 'R2 ยังไม่อยู่ VLAN 10 — ดู vif ของทั้งสองฝั่งแล้วเทียบเลขกัน ฝั่งหนึ่งถูกตั้งไว้คนละ VLAN' },
            { description: 'R1 ping ข้าม trunk (10.0.10.2) ได้', node: 'R1', command: 'ping 10.0.10.2 count 3', expect: 'bytes from 10\\.0\\.10\\.2', points: 5,
              failHint: 'ยังข้ามไม่ได้ — ถ้าแก้ vif แล้ว เช็คว่า IP 10.0.10.2/24 ติดอยู่กับ vif 10 ตัวใหม่ (ไม่ใช่ค้างอยู่บน vif เก่าที่ยังไม่ได้ลบ) แล้ว commit' },
          ],
        },
        {
          type: 'lab',
          title: 'ซ่อม #5 — อุโมงค์ GRE ที่ชี้ผิดทิศ',
          order: 1,
          estMinutes: 30,
          mode: 'troubleshoot',
          description: 'underlay ระหว่างสองสาขา ping ถึงกันปกติ แต่ overlay ผ่านอุโมงค์ GRE เงียบสนิท',
          scenario: {
            from: 'พี่เมษ์ ทีม Data Center',
            priority: 'medium',
            body: 'ระบบ ERP ระหว่างสำนักงานใหญ่กับโรงงานใช้ไม่ได้ตั้งแต่ย้าย IP ฝั่ง WAN เมื่อสุดสัปดาห์ ทีมที่ย้ายบอกอัปเดต config อุโมงค์ "ครบแล้ว" — ลิงก์ WAN ปกติดี ping IP จริงถึงกันสบาย แต่ระบบที่วิ่งใน tunnel ตายหมด ฝากไล่ดูว่าค่าไหนตกหล่นตอนย้าย',
          },
          objectives: [
            'ยืนยันว่า underlay (10.0.12.0/24) ปกติ แล้วแยกปัญหาไปที่ตัวอุโมงค์',
            'วินิจฉัย config GRE ของสองฝั่งว่าค่าใดไม่สอดคล้องกัน',
            'ซ่อมให้ ping ผ่าน overlay (172.16.0.0/30) ได้',
          ],
          hints: [
            'เช็ค underlay ก่อน: `ping 10.0.12.2` จาก R1 — ถ้าผ่าน ปัญหาอยู่ที่ตัวอุโมงค์ ไม่ใช่ลิงก์',
            'กางค่าอุโมงค์สองฝั่งเทียบกัน: `show configuration commands | match tunnel` — source-address ของฝั่งเรา ต้องเท่ากับ remote ของฝั่งโน้น "ไขว้กันพอดี"',
            'ค่า remote ของ R1 ชี้ไปที่ IP ที่มีอยู่จริงหรือเปล่า? แก้ด้วย `set interfaces tunnel tun0 remote <IP จริงของ R2>` แล้ว commit',
          ],
          topology: {
            nodes: [ vyos('R1', -180, 0), vyos('R2', 180, 0) ],
            links: [ { node1: 'R1', port1: 1, node2: 'R2', port2: 1 } ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.1/24',
              'set interfaces tunnel tun0 encapsulation gre',
              'set interfaces tunnel tun0 address 172.16.0.1/30',
              'set interfaces tunnel tun0 source-address 10.0.12.1',
              'set interfaces tunnel tun0 remote 10.0.12.99',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.2/24',
              'set interfaces tunnel tun0 encapsulation gre',
              'set interfaces tunnel tun0 address 172.16.0.2/30',
              'set interfaces tunnel tun0 source-address 10.0.12.2',
              'set interfaces tunnel tun0 remote 10.0.12.1',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'underlay ปกติ (R1 ping 10.0.12.2)', node: 'R1', command: 'ping 10.0.12.2 count 3', expect: 'bytes from 10\\.0\\.12\\.2', points: 1,
              failHint: 'underlay ไม่ควรพังในโจทย์นี้ — ถ้า ping IP จริงไม่ผ่าน อาจไปแก้ eth1 โดยไม่ตั้งใจ เช็ค `show interfaces` ก่อน' },
            { description: 'remote ของอุโมงค์ R1 ชี้ไปยัง R2 ตัวจริง', node: 'R1', command: 'show configuration commands | match "tun0 remote"', expect: '10\\.0\\.12\\.2', points: 3,
              failHint: 'ค่า remote ของ tun0 บน R1 ยังชี้ไปยัง IP ที่ไม่มีอยู่จริง — ปลายอุโมงค์ตัวจริงคือ IP ของ R2 บนลิงก์ WAN' },
            { description: 'ping ผ่าน overlay (172.16.0.2) ได้', node: 'R1', command: 'ping 172.16.0.2 count 3', expect: 'bytes from 172\\.16\\.0\\.2', points: 5,
              failHint: 'อุโมงค์ยังไม่เดิน — กฎทอง GRE: source ของ R1 = remote ของ R2 และ remote ของ R1 = source ของ R2 เทียบสี่ค่านี้ให้ไขว้กันพอดีแล้ว commit' },
          ],
        },
        {
          type: 'lab',
          title: '👹 BOSS — เครือข่ายสาขาล่มสามจุดซ้อน',
          order: 2,
          estMinutes: 45,
          mode: 'troubleshoot',
          isBoss: true,
          passThreshold: 80,
          description: 'ด่านสุดท้าย: เหตุการณ์จริงไม่เคยพังทีละอย่าง — ระบบนี้พังสามจุดพร้อมกัน ต้องไล่แก้ครบจึงจะกู้บริการได้ (เกณฑ์ผ่าน 80%)',
          scenario: {
            from: 'CTO (โทรมาเองตอนสองทุ่ม)',
            priority: 'high',
            body: 'สาขาใหญ่สุดของเราขาดการติดต่อกับ data center มาสามชั่วโมง พนักงานหน้าร้านขายของไม่ได้ ลูกค้ารอคิวยาว — ทีมแรกเข้าไปแก้แล้ว "ยิ่งแก้ยิ่งพัง" ผมสั่งหยุดทุกอย่างไว้ก่อน ตอนนี้เหลือคุณคนเดียวที่ผมไว้ใจ ระบบต้องกลับมาคืนนี้ อย่าเดา — ไล่ทีละชั้น พิสูจน์ทุกข้อสรุป แล้วรายงานผมทุกครึ่งชั่วโมง',
          },
          objectives: [
            'ตั้งค่า PC1 = 192.168.1.10/24 gateway 192.168.1.1 (เครื่องหน้าร้าน)',
            'ไล่หาความผิดพลาดทั้งหมดบนเส้นทาง PC1 → R1 → R2 → 192.168.2.1 (data center)',
            'กู้ให้เครื่องหน้าร้านถึงระบบ data center ได้ครบเส้นทาง',
          ],
          hints: [
            'อย่าเพิ่งแตะ config — วาดเส้นทางแล้วทดสอบทีละช่วง: PC1→R1, R1→R2, R1→DC, PC1→DC ช่วงไหนขาด ปัญหาอยู่ช่วงนั้น (และอาจมีมากกว่าหนึ่งช่วง)',
            'ช่วง R1→R2: `show interfaces` บน R1 ดูสถานะ eth2 ให้ดี — คุ้น ๆ อาการจากโจทย์แรกไหม',
            'ช่วง R1→DC: `show ip route` บน R1 — เส้นทางไป 192.168.2.0/24 ชี้ next-hop ไปที่ IP ที่มีตัวตนจริงหรือเปล่า (เทียบกับ IP จริงของ R2)',
            'ช่วงขากลับ: บน R2 ลอง `show ip route` — แพ็กเก็ตจาก PC1 ไปถึงแล้ว แต่ R2 รู้ทางกลับมาวง 192.168.1.0/24 ไหม? ไม่มี route กลับ = ping เงียบเหมือนกัน',
          ],
          topology: {
            nodes: [ pc('PC1', -320, 0), vyos('R1', -60, 0), vyos('R2', 220, 0) ],
            links: [
              { node1: 'PC1', port1: 0, node2: 'R1', port2: 1 },
              { node1: 'R1', port1: 2, node2: 'R2', port2: 1 },
            ],
          },
          setupCommands: [
            { node: 'R1', commands: [
              'configure',
              'set interfaces ethernet eth1 address 192.168.1.1/24',
              'set interfaces ethernet eth2 address 10.0.12.1/24',
              'set interfaces ethernet eth2 disable',
              'set protocols static route 192.168.2.0/24 next-hop 10.0.12.99',
              'commit',
              'exit',
            ] },
            { node: 'R2', commands: [
              'configure',
              'set interfaces ethernet eth1 address 10.0.12.2/24',
              'set interfaces dummy dum0 address 192.168.2.1/24',
              'commit',
              'exit',
            ] },
          ],
          gradingChecks: [
            { description: 'ลิงก์ WAN ของ R1 (eth2) กลับมา u/u', node: 'R1', command: 'show interfaces | match eth2', expect: 'eth2.+u/u', points: 2,
              failHint: 'eth2 ของ R1 ยังไม่ขึ้น — สถานะ A/D คือถูกสั่งปิดไว้ใน config (จุดพังที่ 1 จาก 3)' },
            { description: 'R1 ถึง R2 (10.0.12.2) ได้', node: 'R1', command: 'ping 10.0.12.2 count 3', expect: 'bytes from 10\\.0\\.12\\.2', points: 2,
              failHint: 'ลิงก์ R1–R2 ยังไม่เดิน — ต้องซ่อม eth2 ให้ u/u ก่อน ช่วงอื่นถึงจะทดสอบต่อได้' },
            { description: 'R1 ถึง data center (192.168.2.1) ได้', node: 'R1', command: 'ping 192.168.2.1 count 3', expect: 'bytes from 192\\.168\\.2\\.1', points: 3,
              failHint: 'R1 ยังไปไม่ถึง DC — ดู `show ip route`: static route ไป 192.168.2.0/24 ชี้ next-hop ที่ไม่มีตัวตน (จุดพังที่ 2) แก้ให้ชี้ IP จริงของ R2' },
            { description: 'R2 มีเส้นทางกลับไปวงสาขา (192.168.1.0/24)', node: 'R2', command: 'show configuration commands | match "192.168.1.0/24"', expect: '192\\.168\\.1\\.0/24', points: 2,
              failHint: 'R2 ไม่รู้ทางกลับวงสาขาเลย (จุดพังที่ 3 — ไม่ใช่ของพังแต่เป็น "ของหาย") เพิ่ม static route 192.168.1.0/24 ชี้กลับมาที่ R1' },
            { description: 'เครื่องหน้าร้าน (PC1) ถึงระบบ DC (192.168.2.1) ครบเส้นทาง', node: 'PC1', command: 'ping 192.168.2.1', expect: 'bytes from 192\\.168\\.2\\.1', points: 4,
              failHint: 'เส้นทางเต็มยังไม่ครบ — ต้องผ่านทั้งสามจุด: eth2 ขึ้น, next-hop ถูก, R2 มี route กลับ และ PC1 ต้องตั้ง IP+gateway ครบ (`ip 192.168.1.10 255.255.255.0 192.168.1.1`)' },
          ],
        },
      ],
    },
  ],
};
