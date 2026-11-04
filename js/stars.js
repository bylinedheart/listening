// Half-star rating display and input.
// Display: <span class="stars" style="--r:3.5">. Input adds role="slider".
// Inputs fire a bubbling "rate" CustomEvent with detail = new value.
import { esc, fmtRating } from './util.js';

export function starsHTML(r, size = 'sm') {
  return `<span class="stars stars-${size}" style="--r:${r || 0}" role="img" aria-label="${r ? `${r} of 5 stars` : 'Not rated'}"></span>`;
}

export function starInputHTML(r, { size = 'lg', label = 'Rating', key = '' } = {}) {
  return `<span class="stars stars-${size}" style="--r:${r || 0}" role="slider" tabindex="0"
    aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${r || 0}"
    aria-valuetext="${r ? `${r} of 5 stars` : 'Not rated'}" data-stars="${esc(key)}"></span>`;
}

function setValue(el, v) {
  el.style.setProperty('--r', v);
  el.setAttribute('aria-valuenow', v);
  el.setAttribute('aria-valuetext', v ? `${v} of 5 stars` : 'Not rated');
  const out = el.parentElement && el.parentElement.querySelector('.rating-value');
  if (out) out.textContent = fmtRating(v);
  el.dispatchEvent(new CustomEvent('rate', { bubbles: true, detail: v }));
}

function valueAt(el, clientX) {
  const rect = el.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  return Math.min(5, Math.max(0.5, Math.ceil(x * 10) / 2));
}

/** Install delegated handlers once for every star input on the page. */
export function installStarInputs(root = document) {
  let drag = null;
  root.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('[data-stars]');
    if (!el) return;
    ev.preventDefault();
    const start = Number(el.getAttribute('aria-valuenow')) || 0;
    drag = { el, start, last: start, moved: false, x: ev.clientX };
    el.setPointerCapture?.(ev.pointerId);
    el.focus({ preventScroll: true });
  });
  root.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    if (Math.abs(ev.clientX - drag.x) > 6) drag.moved = true;
    if (!drag.moved) return;
    const v = valueAt(drag.el, ev.clientX);
    if (v !== drag.last) { drag.last = v; drag.el.style.setProperty('--r', v); }
  });
  const end = (ev) => {
    if (!drag) return;
    const { el, start, moved } = drag;
    drag = null;
    if (ev.type === 'pointercancel') { el.style.setProperty('--r', start); return; }
    let v = valueAt(el, ev.clientX);
    if (!moved && v === start) v = 0; // tapping the current value clears it
    setValue(el, v);
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  root.addEventListener('keydown', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-stars]');
    if (!el) return;
    const cur = Number(el.getAttribute('aria-valuenow')) || 0;
    const map = {
      ArrowRight: cur + 0.5, ArrowUp: cur + 0.5, ArrowLeft: cur - 0.5, ArrowDown: cur - 0.5,
      Home: 0, End: 5, Backspace: 0, Delete: 0,
    };
    if (ev.key in map) {
      ev.preventDefault();
      setValue(el, Math.min(5, Math.max(0, map[ev.key])));
    } else if (/^[0-5]$/.test(ev.key)) {
      ev.preventDefault();
      setValue(el, Number(ev.key));
    }
  });
}
