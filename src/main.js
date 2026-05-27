/* ============================================================
   Her Stage — Main JavaScript (Corporate Redesign)
   ============================================================ */
'use strict';

/* ============================================================
   1. HEADER — scroll shadow & hamburger
   ============================================================ */
(function initHeader() {
  const header    = document.getElementById('header');
  const hamburger = document.getElementById('hamburger');
  const nav       = document.getElementById('nav');
  if (!header) return;

  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
    const btn = document.getElementById('backToTop');
    if (btn) btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('active');
      nav.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        nav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });
  }
})();

/* ============================================================
   2. BACK TO TOP
   ============================================================ */
(function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ============================================================
   3. SMOOTH SCROLL
   ============================================================ */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const id = anchor.getAttribute('href');
      if (id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      const headerH = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--header-h')
      ) || 80;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

/* ============================================================
   4. SCROLL REVEAL (IntersectionObserver)
   ============================================================ */
(function initReveal() {
  const targets = document.querySelectorAll(
    '.reveal-up, .reveal-left, .reveal-right, .section-header, .media-bar, .hero-stat-bar'
  );

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => observer.observe(el));

  /* Section headers */
  document.querySelectorAll('.section-header').forEach((el, i) => {
    el.classList.add('reveal-up');
    el.style.setProperty('--delay', `${i * 0.04}s`);
    observer.observe(el);
  });
})();

/* ============================================================
   5. COUNTER ANIMATION (hero stat bar)
   ============================================================ */
(function initCounters() {
  const numEls = document.querySelectorAll('.stat-num[data-target]');
  if (!numEls.length) return;

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function animateNum(el) {
    const target   = parseFloat(el.dataset.target);
    const duration = 1600;
    const start    = performance.now();

    function update(now) {
      const progress = Math.min((now - start) / duration, 1);
      const val = target * easeOut(progress);
      el.textContent = Number.isInteger(target) ? Math.round(val) : val.toFixed(1);
      if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateNum(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  numEls.forEach(el => observer.observe(el));
})();

/* ============================================================
   6. FAQ ACCORDION
   ============================================================ */
(function initFaq() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const btn = item.querySelector('.faq-q');
    const ans = item.querySelector('.faq-a');
    if (!btn || !ans) return;

    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';

      /* Close all others */
      items.forEach(other => {
        if (other !== item) {
          other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
          other.querySelector('.faq-a').classList.remove('open');
        }
      });

      btn.setAttribute('aria-expanded', String(!expanded));
      ans.classList.toggle('open', !expanded);
    });
  });
})();

/* ============================================================
   7. IMAGE PARALLAX (hero & photo-feature)
   ============================================================ */
(function initParallax() {
  const pairs = [
    { wrap: document.querySelector('.hero'),          img: document.querySelector('.hero-img'),     speed: 0.25 },
    { wrap: document.querySelector('.photo-feature'), img: document.querySelector('.photo-feature-media img'), speed: 0.2  },
    { wrap: document.querySelector('.cta-section'),   img: document.querySelector('.cta-media img'),  speed: 0.18 },
  ];

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  if (isMobile) return;

  function update() {
    const scrollY = window.scrollY;
    pairs.forEach(({ wrap, img, speed }) => {
      if (!wrap || !img) return;
      const rect = wrap.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const offset = (scrollY - (wrap.offsetTop)) * speed;
      img.style.transform = `translateY(${offset}px) scale(1.1)`;
    });
  }

  /* Set initial scale to allow parallax room */
  pairs.forEach(({ img }) => {
    if (img) img.style.willChange = 'transform';
  });

  window.addEventListener('scroll', update, { passive: true });
  update();
})();

/* ============================================================
   8. ACTIVE NAV LINK (scroll spy)
   ============================================================ */
(function initScrollSpy() {
  const sections = document.querySelectorAll('section[id], div[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const headerH = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--header-h')
  ) || 80;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        const href = link.getAttribute('href');
        link.classList.toggle(
          'active-nav',
          href === `#${entry.target.id}` || href === `index.html#${entry.target.id}`
        );
      });
    });
  }, { rootMargin: `-${headerH + 10}px 0px -55% 0px` });

  sections.forEach(s => observer.observe(s));
})();

/* ============================================================
   9. REGISTER PAGE — Multi-step form
   ============================================================ */
(function initRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  const stepEls   = form.querySelectorAll('.form-step');
  const stepDots  = document.querySelectorAll('.steps-indicator .step');
  const stepLines = document.querySelectorAll('.steps-indicator .step-line');

  const nextBtn1  = document.getElementById('nextStep1');
  const nextBtn2  = document.getElementById('nextStep2');
  const prevBtn2  = document.getElementById('prevStep2');
  const prevBtn3  = document.getElementById('prevStep3');
  const submitBtn = document.getElementById('submitBtn');

  const formData  = {};

  /* ---- show step ---- */
  function showStep(n) {
    stepEls.forEach(s => s.classList.add('hidden'));
    const target = form.querySelector(`#step${n}`) || form.querySelector('#stepComplete');
    if (!target) return;
    target.classList.remove('hidden');

    /* scroll to form top */
    const formTop = form.closest('.register-form-wrap') || form;
    setTimeout(() => formTop.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);

    updateIndicator(n);
  }

  function updateIndicator(n) {
    stepDots.forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i + 1 === n) dot.classList.add('active');
      if (i + 1 < n)  dot.classList.add('done');
    });
    stepLines.forEach((line, i) => {
      line.classList.toggle('done', i + 1 < n);
    });
  }

  /* ---- validation helpers ---- */
  const $ = id => document.getElementById(id);

  function setErr(errId, msg) {
    const el = $(errId);
    if (el) el.textContent = msg;
  }
  function clrErr(errId) { setErr(errId, ''); }

  function markInvalid(fieldId, invalid) {
    const el = $(fieldId);
    if (el) el.classList.toggle('error', invalid);
  }

  function isEmail(v)    { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function isKana(v)     { return /^[ァ-ヶーｦ-ｯ\s　]+$/.test(v); }
  function isPhone(v)    { return /^[\d\-\+\(\)\s]{10,15}$/.test(v.replace(/\s/g,'')); }
  function isStrongPw(v) { return v.length >= 8 && /[A-Za-z]/.test(v) && /[0-9]/.test(v); }

  /* ---- Step 1 ---- */
  function validateStep1() {
    const plan     = form.querySelector('input[name="plan"]:checked');
    const errEl    = $('planError');
    const ok       = !!plan;
    if (errEl) errEl.style.display = ok ? 'none' : 'flex';
    if (ok) formData.plan = plan.value;
    return ok;
  }

  /* ---- Step 2 ---- */
  function validateStep2() {
    let valid = true;

    const rules = [
      { id:'lastName',        errId:'lastNameError',        msg:'姓を入力してください',              chk: v => v.trim().length > 0 },
      { id:'firstName',       errId:'firstNameError',       msg:'名を入力してください',              chk: v => v.trim().length > 0 },
      { id:'lastNameKana',    errId:'lastNameKanaError',    msg:'カタカナで入力してください',         chk: v => v.trim() && isKana(v) },
      { id:'firstNameKana',   errId:'firstNameKanaError',   msg:'カタカナで入力してください',         chk: v => v.trim() && isKana(v) },
      { id:'email',           errId:'emailError',           msg:'正しいメールアドレスを入力してください', chk: v => isEmail(v) },
      { id:'phone',           errId:'phoneError',           msg:'電話番号を入力してください',          chk: v => isPhone(v) },
      { id:'age',             errId:'ageError',             msg:'年齢を選択してください',              chk: v => v !== '' },
      { id:'currentStatus',   errId:'currentStatusError',   msg:'現在のご状況を選択してください',       chk: v => v !== '' },
      { id:'goal',            errId:'goalError',            msg:'10文字以上で入力してください',         chk: v => v.trim().length >= 10 },
      { id:'date1',           errId:'date1Error',           msg:'第1希望日時を選択してください',        chk: v => v !== '' },
      { id:'password',        errId:'passwordError',        msg:'8文字以上・英字と数字を含むパスワードを入力してください', chk: v => isStrongPw(v) },
      { id:'passwordConfirm', errId:'passwordConfirmError', msg:'パスワードが一致しません',            chk: v => { const pw = $('password'); return pw && v === pw.value && v !== ''; } },
    ];

    rules.forEach(({ id, errId, msg, chk }) => {
      const el = $(id);
      if (!el) return;
      const ok = chk(el.value);
      markInvalid(id, !ok);
      setErr(errId, ok ? '' : msg);
      if (!ok) valid = false;
    });

    /* email confirm cross-check */
    const emailEl  = $('email');
    const confirmEl = $('emailConfirm');
    if (emailEl && confirmEl) {
      const ok = confirmEl.value !== '' && emailEl.value === confirmEl.value;
      markInvalid('emailConfirm', !ok);
      setErr('emailConfirmError', ok ? '' : 'メールアドレスが一致しません');
      if (!ok) valid = false;
    }

    /* terms */
    const terms = $('agreeTerms');
    if (terms) {
      const ok = terms.checked;
      setErr('agreeTermsError', ok ? '' : '利用規約・プライバシーポリシーへの同意が必要です');
      if (!ok) valid = false;
    }

    if (valid) {
      ['lastName','firstName','lastNameKana','firstNameKana',
       'email','phone','age','currentStatus','goal','concern','date1','date2'
      ].forEach(id => { const el = $(id); if (el) formData[id] = el.value; });
    }
    return valid;
  }

  /* ---- Build confirm table ---- */
  function buildConfirm() {
    const table = $('confirmTable');
    if (!table) return;

    const planLabel = { consult:'無料相談のみ', petal:'Petal Plan — ¥4,900/月', bloom:'Bloom Plan — ¥9,000/月' };

    const rows = [
      ['ご希望プラン',   planLabel[formData.plan] || formData.plan],
      ['お名前',         `${formData.lastName||''} ${formData.firstName||''}`],
      ['フリガナ',       `${formData.lastNameKana||''} ${formData.firstNameKana||''}`],
      ['メールアドレス', formData.email||''],
      ['電話番号',       formData.phone||''],
      ['年齢',           formData.age ? `${formData.age}歳` : ''],
      ['現在のご状況',   formData.currentStatus||''],
      ['実現したいこと', formData.goal||''],
      ['お悩み・不安',   formData.concern||'（未記入）'],
      ['第1希望日時',    formData.date1 ? fmtDt(formData.date1) : ''],
      ['第2希望日時',    formData.date2 ? fmtDt(formData.date2) : '（未記入）'],
    ];

    table.innerHTML = rows.map(([label, val]) => `
      <div class="confirm-row">
        <div class="confirm-label">${label}</div>
        <div class="confirm-value">${esc(val)}</div>
      </div>`).join('');
  }

  function fmtDt(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
  function esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ---- Button listeners ---- */
  nextBtn1?.addEventListener('click', () => { if (validateStep1()) showStep(2); });
  nextBtn2?.addEventListener('click', () => { if (validateStep2()) { buildConfirm(); showStep(3); } });
  prevBtn2?.addEventListener('click', () => showStep(1));
  prevBtn3?.addEventListener('click', () => showStep(2));

  /* ---- Submit ---- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!submitBtn) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 送信中…';

    await new Promise(r => setTimeout(r, 1800));

    stepEls.forEach(s => s.classList.add('hidden'));
    const done = form.querySelector('#stepComplete');
    if (done) {
      done.classList.remove('hidden');
      done.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* hide step indicator after completion */
    const indicator = document.querySelector('.steps-indicator');
    if (indicator) {
      indicator.style.opacity = '0';
      indicator.style.pointerEvents = 'none';
    }
  });

  /* ---- URL param pre-select ---- */
  const urlPlan = new URLSearchParams(window.location.search).get('plan');
  if (urlPlan) {
    const radio = form.querySelector(`input[name="plan"][value="${urlPlan}"]`);
    if (radio) radio.checked = true;
  }

  /* ---- Sidebar plan display ---- */
  const planDisplay = $('selectedPlanDisplay');
  const planLabels  = {
    consult: { icon:'💬', name:'無料相談のみ',  price:'¥0',          note:'相談後にプランを選択' },
    petal:   { icon:'🌸', name:'Petal Plan',    price:'¥4,900 / 月', note:'初月無料体験あり' },
    bloom:   { icon:'🌺', name:'Bloom Plan',    price:'¥9,000 / 月', note:'初月無料体験あり・おすすめ' },
  };

  function updateSidebar() {
    const sel = form.querySelector('input[name="plan"]:checked');
    if (!planDisplay) return;
    if (!sel) {
      planDisplay.innerHTML = '<p class="plan-not-selected">プランを選択してください</p>';
      return;
    }
    const info = planLabels[sel.value] || { icon:'✦', name:sel.value, price:'', note:'' };
    planDisplay.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <span style="font-size:1.5rem;">${info.icon}</span>
        <div>
          <strong style="display:block;font-size:.93rem;color:var(--text);">${info.name}</strong>
          <span style="font-size:.88rem;color:var(--salmon);font-weight:700;">${info.price}</span>
        </div>
      </div>
      <p style="font-size:.76rem;color:var(--gray-400);">${info.note}</p>`;
  }

  form.querySelectorAll('input[name="plan"]').forEach(r => r.addEventListener('change', updateSidebar));
  updateSidebar();

  /* ---- Password toggle ---- */
  function setupToggle(btnId, inputId) {
    const btn   = $(btnId);
    const input = $(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('i').className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });
  }
  setupToggle('togglePw',        'password');
  setupToggle('togglePwConfirm', 'passwordConfirm');

  /* ---- Live inline validation on blur ---- */
  [
    ['lastName','lastNameError','姓を入力してください', v => v.trim().length > 0],
    ['email',   'emailError',   '正しいメールアドレスを入力してください', v => isEmail(v)],
    ['phone',   'phoneError',   '電話番号を入力してください', v => isPhone(v)],
  ].forEach(([id, errId, msg, chk]) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      if (!el.value) return;
      const ok = chk(el.value);
      markInvalid(id, !ok);
      setErr(errId, ok ? '' : msg);
    });
    el.addEventListener('input', () => {
      if (el.classList.contains('error')) {
        const ok = chk(el.value);
        markInvalid(id, !ok);
        setErr(errId, ok ? '' : msg);
      }
    });
  });
})();

/* ============================================================
   10. PAGE HERO TRUST BADGES — stagger fade-in
   ============================================================ */
(function initHeroTrust() {
  const badges = document.querySelectorAll('.page-hero-trust span');
  badges.forEach((b, i) => {
    b.style.opacity = '0';
    b.style.transform = 'translateY(12px)';
    b.style.transition = `opacity .5s ease ${.3 + i * .12}s, transform .5s ease ${.3 + i * .12}s`;
    setTimeout(() => {
      b.style.opacity = '1';
      b.style.transform = 'translateY(0)';
    }, 100);
  });
})();
