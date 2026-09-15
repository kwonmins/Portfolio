document.getElementById('refresh').addEventListener('click', () => location.reload());
document.getElementById('search').addEventListener('input', (event) => {
  const query = event.target.value.trim().toLowerCase();
  let matches = 0;
  document.querySelectorAll('[data-visit]').forEach(row => {
    row.hidden = !row.textContent.toLowerCase().includes(query);
    if (!row.hidden) matches++;
  });
  document.getElementById('no-matches').hidden = !query || matches > 0;
});
