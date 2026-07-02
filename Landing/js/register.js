/* India Mind League — dedicated registration page (demo, no backend) */
(function () {
  'use strict';
  var form = document.getElementById('regForm');
  var formMsg = document.getElementById('formMsg');
  var success = document.getElementById('formSuccess');
  if (!form) return;

  var lead = document.querySelector('.af-lead');
  var alt = document.querySelector('.af-alt');

  function msg(text, kind) {
    formMsg.innerHTML = text ? '<div class="alert ' + (kind || 'error') + '">' + text + '</div>' : '';
  }
  function isPhone(v) { return /^[6-9]\d{9}$/.test((v || '').trim()); }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(form).entries());
    if (!(data.name || '').trim() || !(data.grade || '').trim()) { msg('Please enter the student name and class.'); return; }
    if (!isPhone(data.phone || '')) { msg('Enter a valid 10-digit mobile number.'); return; }

    msg('');
    // Demo only (no backend). In production POST these fields to the IML API.
    form.style.display = 'none';
    if (lead) lead.style.display = 'none';
    if (alt) alt.style.display = 'none';
    document.getElementById('successName').textContent = data.name.trim() + ', welcome to the India Mind League!';
    success.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('regAgain').addEventListener('click', function () {
    form.reset();
    success.classList.remove('show');
    form.style.display = '';
    if (lead) lead.style.display = '';
    if (alt) alt.style.display = '';
  });
})();
