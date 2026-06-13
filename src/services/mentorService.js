// AI Mentor (§22) — พี่เลี้ยงที่ถามนำแบบโสเครติส ไม่บอกเฉลย
//
// Feature-flag: ทำงานเมื่อมี ANTHROPIC_API_KEY เท่านั้น (ไม่ตั้ง = ปุ่มไม่โชว์
// และ endpoint ตอบ 503) คุมต้นทุนด้วย rate-limit ฝั่ง route + max_tokens ต่ำ
//
// ใช้ Messages API ตรง ๆ ผ่าน fetch (โปรเจกต์เลี่ยงเพิ่ม dependency, งานสั้น
// ครั้งเดียว) โมเดล fast/cheap tier (Haiku) พอสำหรับงานสั้นที่มี context ชัด
// ข้อได้เปรียบเหนือ ChatGPT ที่ผู้เรียนเปิดเอง: mentor เห็น output จริงจาก
// อุปกรณ์ของผู้เรียน — แนะนำตรงจุดกว่ามาก

import logger from '../config/logger.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.MENTOR_MODEL || 'claude-haiku-4-5'; // fast/cheap tier
const ANTHROPIC_VERSION = '2023-06-01';

export const mentorEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = [
  'คุณคือ "พี่เลี้ยง" ผู้ช่วยสอนเครือข่าย (networking) สำหรับผู้เรียนบนแพลตฟอร์ม Pingable',
  'ผู้เรียนกำลังทำแล็บบนอุปกรณ์ VyOS/VPCS จริง และเพิ่งตรวจคำตอบแล้วมีข้อที่ยังไม่ผ่าน',
  '',
  'กฎเหล็ก:',
  '1. ห้ามเฉลยคำตอบหรือคำสั่งที่ถูกต้องแบบสำเร็จรูป — ให้ "ถามนำ" แบบโสเครติสเพื่อให้ผู้เรียนคิดเอง',
  '2. ชี้ว่าควรไปดูอะไรต่อ (เช่น คำสั่ง show ตัวไหน, อาการแบบไหนบอกอะไร) ไม่ใช่บอกว่าต้องพิมพ์อะไร',
  '3. ตอบสั้น กระชับ 2-3 ประโยค เป็นภาษาไทย เป็นกันเองแต่ให้กำลังใจ',
  '4. อ้างอิงจาก output จริงของอุปกรณ์ที่ให้มา ถ้ามีเบาะแสในนั้น',
  '5. ถ้าผู้เรียนใกล้แล้ว บอกว่าใกล้แล้วและชี้จุดที่ขาด',
].join('\n');

// สร้างข้อความ context จากข้อมูลแล็บ + ข้อที่ fail (ไม่ส่ง expect regex เด็ดขาด)
function buildUserMessage({ labTitle, objectives, failed }) {
  const lines = [`แล็บ: ${labTitle}`];
  if (objectives?.length) lines.push(`เป้าหมาย:\n- ${objectives.join('\n- ')}`);
  lines.push('\nข้อที่ยังไม่ผ่าน และสิ่งที่อุปกรณ์ตอบกลับมา:');
  failed.forEach((f, i) => {
    lines.push(`\n${i + 1}. ${f.description}`);
    if (f.output) lines.push(`   อุปกรณ์ตอบ: ${String(f.output).slice(0, 400)}`);
  });
  lines.push('\nช่วยถามนำให้ผู้เรียนหาทางแก้เองหน่อย (อย่าเฉลยตรง ๆ)');
  return lines.join('\n');
}

/**
 * ขอคำแนะนำแบบโสเครติสจาก Claude คืน string ภาษาไทย 2-3 ประโยค
 * โยน Error ถ้า API พังเพื่อให้ route ตอบ error ที่เหมาะสม
 */
export async function askMentor(ctx) {
  if (!mentorEnabled()) throw new Error('mentor disabled');

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 300, // คุมต้นทุน — คำแนะนำสั้น ๆ พอ
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserMessage(ctx) }],
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.error({ status: res.status, body: body.slice(0, 300) }, 'mentor API call failed');
    throw new Error(`mentor API ${res.status}`);
  }

  const data = await res.json();
  // คืน text block แรก (Haiku ไม่ได้เปิด thinking จึงเป็น text ตรง ๆ)
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  logger.info({ model: MODEL, inTok: data.usage?.input_tokens, outTok: data.usage?.output_tokens }, 'mentor call ok');
  return text || 'ลองดู show command ที่เกี่ยวข้องกับข้อที่ติดอีกครั้งนะ แล้วเทียบกับเป้าหมายของแล็บ';
}
