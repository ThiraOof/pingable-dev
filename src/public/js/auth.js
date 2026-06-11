// Password show/hide toggle for login & register forms.
document.querySelectorAll('.pw-toggle').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    btn.setAttribute('aria-label', isHidden ? 'ซ่อนรหัสผ่าน' : 'แสดง/ซ่อนรหัสผ่าน');
    // Swap eye / eye-off icon
    const svg = btn.querySelector('svg');
    if (svg) svg.innerHTML = isHidden
      ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
      : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  });
});

// Form submit loading state — show spinner on submit button while form is posting.
document.querySelectorAll('form').forEach((form) => {
  const submitBtn = form.querySelector('button[data-submit]');
  if (!submitBtn) return;
  form.addEventListener('submit', () => {
    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.disabled = true;
  });
});
