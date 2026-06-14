// หน้าเข้าร่วมดวล: ยิง POST /duel/:id/join แบบ fetch แล้ว redirect เข้าห้อง
// (ฟอร์ม POST ปกติจะเด้งไปหน้า JSON ดิบ). ต้องเป็นไฟล์ภายนอก ไม่ใช่ inline
// เพราะ CSP scriptSrc เป็น 'self' เท่านั้น — inline script ถูกบล็อก
const form = document.getElementById('joinForm');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = form.querySelector('button');
  btn.disabled = true; btn.textContent = 'กำลังเข้าร่วม…';
  try {
    const r = await fetch(form.action, { method: 'POST' });
    const d = await r.json();
    if (!d.ok) throw new Error(d.error || 'เข้าร่วมไม่สำเร็จ');
    location.href = form.action.replace(/\/join$/, ''); // /duel/:id/join -> /duel/:id
  } catch (err) {
    btn.disabled = false; btn.textContent = 'ลองใหม่';
    alert(err.message);
  }
});
