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

  /* ---------- exam-start countdown clock (demo: 3 seconds) ---------- */
  (function () {
    var remaining = 3; // demo: opens 3 seconds from now
    var clock = document.getElementById('examClock');
    var startBtn = document.getElementById('startBtn');
    var ecH = document.getElementById('ecH'), ecM = document.getElementById('ecM'), ecS = document.getElementById('ecS');
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function render() {
      ecH.textContent = pad(Math.floor(remaining / 3600));
      ecM.textContent = pad(Math.floor((remaining % 3600) / 60));
      ecS.textContent = pad(remaining % 60);
    }
    function unlock() {
      clock.classList.add('live');
      document.getElementById('ecLabel').innerHTML = '🟢 Your Qualifier is <b>live</b> — good luck!';
      document.getElementById('ecDigits').style.display = 'none';
      startBtn.classList.remove('locked');
      startBtn.classList.add('ready');
      startBtn.textContent = 'Start Exam Now →';
    }
    render();
    var iv = setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) { clearInterval(iv); remaining = 0; render(); unlock(); return; }
      render();
    }, 1000);
  })();
})();
