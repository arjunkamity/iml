/* India Mind League — student login (email/phone + OTP demo, no backend) */
(function () {
  'use strict';

  var STORE_KEY = 'iml_student';
  var method = 'email';

  var seg = document.querySelector('.seg');
  var segBtns = document.querySelectorAll('.seg-btn');
  var contactForm = document.getElementById('contactForm');
  var contactInput = document.getElementById('contact');
  var contactLabel = document.getElementById('contactLabel');
  var msg1 = document.getElementById('msg1');
  var otpForm = document.getElementById('otpForm');
  var otpBoxes = document.getElementById('otpBoxes');
  var otpInputs = [].slice.call(otpBoxes.querySelectorAll('input'));
  var msg2 = document.getElementById('msg2');
  var sentTo = document.getElementById('sentTo');
  var editContact = document.getElementById('editContact');
  var resendBtn = document.getElementById('resendBtn');
  var resendIn = document.getElementById('resendIn');

  function alertHtml(box, text, kind) {
    box.innerHTML = text ? '<div class="alert ' + (kind || 'error') + '">' + text + '</div>' : '';
  }

  /* ---------- method toggle ---------- */
  segBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      method = b.dataset.method;
      segBtns.forEach(function (x) { x.classList.toggle('active', x === b); });
      seg.classList.toggle('phone', method === 'phone');
      if (method === 'email') {
        contactLabel.textContent = 'Email address';
        contactInput.type = 'email'; contactInput.placeholder = 'you@example.com'; contactInput.autocomplete = 'email';
        contactInput.inputMode = 'email';
      } else {
        contactLabel.textContent = 'Mobile number';
        contactInput.type = 'tel'; contactInput.placeholder = '10-digit mobile number'; contactInput.autocomplete = 'tel';
        contactInput.inputMode = 'numeric';
      }
      contactInput.value = ''; alertHtml(msg1, '');
      contactInput.focus();
    });
  });

  function validContact(v) {
    v = (v || '').trim();
    if (method === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    return /^[6-9]\d{9}$/.test(v.replace(/\D/g, ''));
  }

  /* ---------- step 1 → send OTP ---------- */
  var resendTimer;
  function startResend() {
    var t = 30; resendBtn.disabled = true; resendIn.textContent = t;
    clearInterval(resendTimer);
    resendTimer = setInterval(function () {
      t -= 1; resendIn.textContent = t;
      if (t <= 0) {
        clearInterval(resendTimer); resendBtn.disabled = false;
        resendBtn.innerHTML = 'Resend code';
      }
    }, 1000);
  }

  contactForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validContact(contactInput.value)) {
      alertHtml(msg1, method === 'email' ? 'Enter a valid email address.' : 'Enter a valid 10-digit mobile number.');
      return;
    }
    alertHtml(msg1, '');
    sentTo.textContent = contactInput.value.trim();
    contactForm.hidden = true; otpForm.hidden = false;
    otpInputs.forEach(function (i) { i.value = ''; });
    otpInputs[0].focus();
    startResend();
  });

  editContact.addEventListener('click', function () {
    otpForm.hidden = true; contactForm.hidden = false;
    alertHtml(msg2, ''); contactInput.focus();
  });

  resendBtn.addEventListener('click', function () {
    if (resendBtn.disabled) return;
    resendBtn.innerHTML = 'Resend in <span id="resendIn">30</span>s';
    resendIn = document.getElementById('resendIn');
    startResend();
    alertHtml(msg2, 'A new code has been sent.', 'ok');
  });

  /* ---------- OTP box behaviour ---------- */
  otpInputs.forEach(function (input, idx) {
    input.addEventListener('input', function () {
      input.value = input.value.replace(/\D/g, '').slice(0, 1);
      if (input.value && idx < otpInputs.length - 1) otpInputs[idx + 1].focus();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !input.value && idx > 0) otpInputs[idx - 1].focus();
    });
    input.addEventListener('paste', function (e) {
      e.preventDefault();
      var digits = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, otpInputs.length);
      digits.split('').forEach(function (d, i) { if (otpInputs[i]) otpInputs[i].value = d; });
      (otpInputs[digits.length] || otpInputs[otpInputs.length - 1]).focus();
    });
  });

  function titleCase(s) { return s.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  /* ---------- step 2 → verify & login ---------- */
  otpForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var code = otpInputs.map(function (i) { return i.value; }).join('');
    if (code.length < otpInputs.length) {
      alertHtml(msg2, 'Enter the full 6-digit code.');
      return;
    }
    var contact = contactInput.value.trim();
    var name = method === 'email' ? titleCase(contact.split('@')[0]) : 'Champion';
    if (!name) name = 'Champion';
    var student = {
      contact: contact,
      method: method,
      name: name,
      avatar: 'https://api.dicebear.com/9.x/avataaars/svg?seed=' + encodeURIComponent(contact) +
        '&radius=50&backgroundColor=b6e3f4,c0aede,ffd5dc,d1d4f9,ffdfbf,c1f0dc',
      since: Date.now(),
    };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(student)); } catch (err) {}
    alertHtml(msg2, 'Verified! Taking you to your dashboard…', 'ok');
    setTimeout(function () { window.location.href = 'dashboard.html'; }, 700);
  });

  contactInput.focus();
})();
