'use strict';

/**
 * Progressive enhancements only — the app is fully usable without this file.
 * No inline handlers anywhere, so the CSP stays script-src 'self'.
 */
(function () {
  'use strict';

  // Signature detail: the 2px accent thread tracks scroll progress.
  const thread = document.getElementById('progress-thread');
  if (thread) {
    let frame = 0;
    const paint = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      thread.style.transform = `scaleX(${Math.min(Math.max(progress, 0), 1)})`;
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(paint);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    paint();
  }

  // Show / hide password controls on the auth forms.
  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.getAttribute('data-toggle-password'));
      if (!input) return;
      const showing = input.getAttribute('type') === 'text';
      input.setAttribute('type', showing ? 'password' : 'text');
      button.textContent = showing ? 'Show' : 'Hide';
      button.setAttribute('aria-pressed', showing ? 'false' : 'true');
      input.focus();
    });
  });

  // Clicking an existing tag in the sidebar appends it to the tag field.
  const tagInput = document.getElementById('tags');
  if (tagInput) {
    document.querySelectorAll('[data-add-tag]').forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.getAttribute('data-add-tag');
        const current = tagInput.value
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        if (!current.some((value) => value.toLowerCase() === name.toLowerCase())) {
          current.push(name);
        }
        tagInput.value = current.join(', ');
        tagInput.focus();
      });
    });
  }

  // Destructive actions confirm before submitting.
  document.querySelectorAll('form[data-confirm]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (!window.confirm(form.getAttribute('data-confirm'))) {
        event.preventDefault();
      }
    });
  });

  // Submitting twice must not create two records: disable after the first submit.
  document.querySelectorAll('form').forEach((form) => {
    if (form.hasAttribute('data-confirm')) return;
    form.addEventListener('submit', () => {
      const button = form.querySelector('button[type="submit"]');
      if (button && !button.disabled) {
        button.disabled = true;
        button.dataset.busy = 'true';
      }
    });
  });

  // Precision tick: flash the score element that just changed for 300ms.
  const flashes = document.querySelectorAll('[data-flash]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (flashes.length && !reduceMotion) {
    flashes.forEach((element) => {
      const direction = element.getAttribute('data-flash');
      if (!direction || direction === 'none') return;
      const className = direction === 'up' ? 'is-flash-up' : 'is-flash-down';
      element.classList.add(className);
      window.setTimeout(() => element.classList.remove(className), 320);
    });
  }
})();
