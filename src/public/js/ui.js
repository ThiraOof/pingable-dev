// Show-more toggle for the dashboard activity list.
// Items beyond index 8 start with [hidden]; clicking the button reveals them.
document.querySelectorAll('.show-more-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const list = document.getElementById(btn.dataset.list);
    if (!list) return;
    const expanded = btn.dataset.expanded === '1';
    Array.from(list.children).forEach((li, i) => {
      if (i >= 8) li.hidden = expanded;
    });
    btn.dataset.expanded = expanded ? '0' : '1';
    btn.textContent = expanded
      ? `ดูเพิ่มอีก ${btn.dataset.count} รายการ`
      : 'ย่อรายการ';
  });
});

// Live search for the course catalog. Filters <png-course-card> elements by
// their title/desc attributes and hides empty <png-level-lane> sections.
const searchInput = document.getElementById('course-search');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    document.querySelectorAll('png-level-lane').forEach((lane) => {
      let visible = 0;
      lane.querySelectorAll('png-course-card').forEach((card) => {
        const match = !q
          || (card.getAttribute('title') || '').toLowerCase().includes(q)
          || (card.getAttribute('desc') || '').toLowerCase().includes(q);
        card.hidden = !match;
        if (match) visible++;
      });
      lane.hidden = visible === 0;
    });
  });
}
