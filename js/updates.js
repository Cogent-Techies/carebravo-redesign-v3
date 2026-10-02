/* carebravo.com — js/updates.js
   /updates only. Filters the accordion by area tag. Entries stay in the DOM and expandable
   (via native <details>) with JS off — this only ever toggles [hidden], never removes content,
   so the page degrades to "everything, always visible" rather than breaking. Loaded after
   main.js's nav/menu wiring runs its own boot(); this file is independent of it. */
(function () {
  function init() {
    const bar = document.querySelector('.upd-filter');
    if (!bar) return; // not on /updates

    const chips = [...bar.querySelectorAll('.filter-chip')];
    const groups = [...document.querySelectorAll('.upd-group')];
    const empty = document.querySelector('.upd-empty');

    function apply(filter) {
      let anyVisible = false;
      groups.forEach(group => {
        const entries = [...group.querySelectorAll('.upd-entry')];
        let groupHasMatch = false;
        entries.forEach(entry => {
          const tags = (entry.dataset.tags || '').split('|');
          const match = filter === 'all' || tags.includes(filter);
          entry.hidden = !match;
          if (match) groupHasMatch = true;
        });
        group.hidden = !groupHasMatch;
        if (groupHasMatch) anyVisible = true;
      });
      if (empty) empty.hidden = anyVisible;
    }

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.toggle('on', c === chip));
        apply(chip.dataset.filter);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
