/* India Mind League — student dashboard (reads the demo login session) */
(function () {
  'use strict';

  var STORE_KEY = 'iml_student';
  var student = null;
  try { student = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) {}

  // Not logged in → back to login
  if (!student || !student.name) {
    window.location.replace('login.html');
    return;
  }

  var firstName = student.name.split(' ')[0];

  function set(id, prop, val) { var el = document.getElementById(id); if (el) el[prop] = val; }
  set('userName', 'textContent', firstName);
  set('greetName', 'textContent', firstName);
  set('udName', 'textContent', student.name);
  set('udContact', 'textContent', student.contact);
  set('meName', 'textContent', 'You · ' + firstName);
  set('userAv', 'src', student.avatar);
  set('udAv', 'src', student.avatar);

  var yr = document.getElementById('year'); if (yr) yr.textContent = new Date().getFullYear();

  /* dropdown */
  var menu = document.getElementById('userMenu');
  var btn = document.getElementById('userBtn');
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (!menu.contains(e.target)) { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { menu.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
  });

  /* logout */
  document.getElementById('logoutBtn').addEventListener('click', function () {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    window.location.href = 'index.html';
  });
})();
