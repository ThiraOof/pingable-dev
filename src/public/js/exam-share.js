// ปุ่มคัดลอกลิงก์แชร์ผลสอบ: POST /exam/result/:id/share แล้วคัดลอกลิงก์
// ต้องเป็นไฟล์ภายนอก ไม่ใช่ inline — CSP scriptSrc เป็น 'self' เท่านั้น
const btn = document.getElementById('btnShareExam');
btn?.addEventListener('click', async () => {
  btn.disabled = true;
  try {
    const r = await fetch(`/exam/result/${btn.dataset.id}/share`, { method: 'POST' });
    const d = await r.json();
    if (!d.ok) throw new Error();
    await navigator.clipboard.writeText(location.origin + d.url);
    btn.textContent = 'คัดลอกลิงก์แล้ว ✓';
  } catch { btn.textContent = 'คัดลอกไม่สำเร็จ'; }
  finally { setTimeout(() => { btn.disabled = false; }, 2500); }
});
