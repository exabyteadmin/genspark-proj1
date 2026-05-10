/* ============================================================
   Her Stage — Main JavaScript
   ============================================================ */

'use strict';

/* ============================================================
   1. HEADER: scroll effect & hamburger menu
   ============================================================ */
(function initHeader() {
  const header    = document.getElementById('header');
  const hamburger = document.getElementById('hamburger');
  const nav       = document.getElementById('nav');

  if (!header) return;

  // Scroll shadow
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // Hamburger toggle
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      const open = hamburger.classList.toggle('active');
      nav.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
    });

    // Close nav when a link inside is clicked
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
   2. SMOOTH SCROLL for anchor links
   ============================================================ */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const headerH = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--header-h')) || 72;
      const top = target.getBoundingClientRect().top + window.scrollY - headerH - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
})();

/* ============================================================
   3. FAQ ACCORDION
   ============================================================ */
(function initFaq() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const btn = item.querySelector('.faq-q');
    const ans = item.querySelector('.faq-a');
    if (!btn || !ans) return;

    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';

      // Close all others
      items.forEach(other => {
        if (other !== item) {
          other.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
          other.querySelector('.faq-a').classList.remove('open');
        }
      });

      // Toggle current
      btn.setAttribute('aria-expanded', String(!expanded));
      ans.classList.toggle('open', !expanded);
    });
  });
})();

/* ============================================================
   4. SCROLL REVEAL (IntersectionObserver)
   ============================================================ */
(function initReveal() {
  // Add reveal class to target elements
  const selectors = [
    '.about-card', '.feature-item', '.voice-card',
    '.flow-step', '.faq-item', '.plan-card',
    '.section-header', '.numbers-bar', '.cta-content'
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${i * 60}ms`;
    });
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

/* ============================================================
   5. REGISTER PAGE — Multi-step form
   ============================================================ */
(function initRegisterForm() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  /* ---- Elements ---- */
  const steps   = form.querySelectorAll('.form-step');
  const stepDots = document.querySelectorAll('.steps-indicator .step');
  const stepLines = document.querySelectorAll('.steps-indicator .step-line');

  const nextBtn1 = document.getElementById('nextStep1');
  const nextBtn2 = document.getElementById('nextStep2');
  const prevBtn2 = document.getElementById('prevStep2');
  const prevBtn3 = document.getElementById('prevStep3');
  const submitBtn = document.getElementById('submitBtn');

  let currentStep = 1;
  const formData = {};

  /* ---- Helpers ---- */
  function showStep(n) {
    steps.forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(`step${n}`);
    if (target) {
      target.classList.remove('hidden');
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    updateStepIndicator(n);
    currentStep = n;
  }

  function updateStepIndicator(n) {
    stepDots.forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i + 1 === n) dot.classList.add('active');
      if (i + 1 < n)  dot.classList.add('done');
    });
    stepLines.forEach((line, i) => {
      line.classList.toggle('done', i + 1 < n);
    });
  }

  /* ---- Validation helpers ---- */
  function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }
  function clearError(id) { showError(id, ''); }

  function markField(fieldId, error) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    field.classList.toggle('error', !!error);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateKana(str) {
    return /^[ァ-ヶーｦ-ｯ\s　]+$/.test(str);
  }

  function validatePhone(phone) {
    return /^[\d\-\+\(\)\s]{10,15}$/.test(phone.replace(/\s/g, ''));
  }

  function validatePassword(pw) {
    return pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
  }

  /* ---- Step 1 validation ---- */
  function validateStep1() {
    const plan = form.querySelector('input[name="plan"]:checked');
    const planError = document.getElementById('planError');
    if (!plan) {
      if (planError) planError.style.display = 'flex';
      return false;
    }
    if (planError) planError.style.display = 'none';
    formData.plan = plan.value;
    return true;
  }

  /* ---- Step 2 validation ---- */
  function validateStep2() {
    let valid = true;
    const fields = [
      { id: 'lastName',        errId: 'lastNameError',        msg: '姓を入力してください',         check: v => v.trim().length > 0 },
      { id: 'firstName',       errId: 'firstNameError',       msg: '名を入力してください',         check: v => v.trim().length > 0 },
      { id: 'lastNameKana',    errId: 'lastNameKanaError',    msg: 'カタカナで入力してください',    check: v => v.trim() && validateKana(v) },
      { id: 'firstNameKana',   errId: 'firstNameKanaError',   msg: 'カタカナで入力してください',    check: v => v.trim() && validateKana(v) },
      { id: 'email',           errId: 'emailError',           msg: '正しいメールアドレスを入力してください', check: v => validateEmail(v) },
      { id: 'phone',           errId: 'phoneError',           msg: '電話番号を入力してください',    check: v => validatePhone(v) },
      { id: 'age',             errId: 'ageError',             msg: '年齢を選択してください',        check: v => v !== '' },
      { id: 'currentStatus',   errId: 'currentStatusError',   msg: '現在のご状況を選択してください', check: v => v !== '' },
      { id: 'goal',            errId: 'goalError',            msg: '実現したいことを入力してください', check: v => v.trim().length >= 10 },
      { id: 'date1',           errId: 'date1Error',           msg: '第1希望日時を選択してください',  check: v => v !== '' },
      { id: 'password',        errId: 'passwordError',        msg: '8文字以上・英字と数字を含むパスワードを入力してください', check: v => validatePassword(v) },
      { id: 'passwordConfirm', errId: 'passwordConfirmError', msg: 'パスワードが一致しません',      check: (v) => {
        const pw = document.getElementById('password');
        return pw && v === pw.value;
      }},
    ];

    fields.forEach(({ id, errId, msg, check }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const ok = check(el.value);
      markField(id, !ok);
      showError(errId, ok ? '' : msg);
      if (!ok) valid = false;
    });

    // Email confirm
    const emailEl        = document.getElementById('email');
    const emailConfirmEl = document.getElementById('emailConfirm');
    if (emailEl && emailConfirmEl) {
      const ok = emailEl.value === emailConfirmEl.value && emailConfirmEl.value !== '';
      markField('emailConfirm', !ok);
      showError('emailConfirmError', ok ? '' : 'メールアドレスが一致しません');
      if (!ok) valid = false;
    }

    // Terms
    const terms = document.getElementById('agreeTerms');
    if (terms && !terms.checked) {
      showError('agreeTermsError', '利用規約・プライバシーポリシーへの同意が必要です');
      valid = false;
    } else if (terms) {
      showError('agreeTermsError', '');
    }

    if (valid) collectFormData();
    return valid;
  }

  function collectFormData() {
    const ids = [
      'lastName','firstName','lastNameKana','firstNameKana',
      'email','phone','age','currentStatus','goal','concern','date1','date2'
    ];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) formData[id] = el.value;
    });
  }

  /* ---- Build confirm table ---- */
  function buildConfirmTable() {
    const table = document.getElementById('confirmTable');
    if (!table) return;

    const planLabels = {
      consult: '無料相談のみ',
      petal:   'Petal Plan — ¥4,900 / 月',
      bloom:   'Bloom Plan — ¥9,000 / 月',
    };

    const rows = [
      ['ご希望プラン',     planLabels[formData.plan] || formData.plan],
      ['お名前',           `${formData.lastName || ''} ${formData.firstName || ''}`],
      ['フリガナ',         `${formData.lastNameKana || ''} ${formData.firstNameKana || ''}`],
      ['メールアドレス',   formData.email || ''],
      ['電話番号',         formData.phone || ''],
      ['年齢',             formData.age ? `${formData.age}歳` : ''],
      ['現在のご状況',     formData.currentStatus || ''],
      ['実現したいこと',   formData.goal || ''],
      ['お悩み・不安',     formData.concern || '（未記入）'],
      ['第1希望日時',      formData.date1 ? formatDatetime(formData.date1) : ''],
      ['第2希望日時',      formData.date2 ? formatDatetime(formData.date2) : '（未記入）'],
    ];

    table.innerHTML = rows.map(([label, value]) => `
      <div class="confirm-row">
        <div class="confirm-label">${label}</div>
        <div class="confirm-value">${escapeHtml(value)}</div>
      </div>
    `).join('');
  }

  function formatDatetime(dt) {
    if (!dt) return '';
    const d = new Date(dt);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h  = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}年${mo}月${day}日 ${h}:${mi}`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ---- Button event listeners ---- */
  if (nextBtn1) {
    nextBtn1.addEventListener('click', () => {
      if (validateStep1()) showStep(2);
    });
  }

  if (nextBtn2) {
    nextBtn2.addEventListener('click', () => {
      if (validateStep2()) {
        buildConfirmTable();
        showStep(3);
      }
    });
  }

  if (prevBtn2) prevBtn2.addEventListener('click', () => showStep(1));
  if (prevBtn3) prevBtn3.addEventListener('click', () => showStep(2));

  /* ---- Form submit (mock) ---- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!submitBtn) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 送信中…';

    // Simulate async submission
    await new Promise(r => setTimeout(r, 1800));

    // Show complete step
    steps.forEach(s => s.classList.add('hidden'));
    const complete = document.getElementById('stepComplete');
    if (complete) {
      complete.classList.remove('hidden');
      complete.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ---- Plan pre-selection from URL query param ---- */
  const urlParams = new URLSearchParams(window.location.search);
  const planParam = urlParams.get('plan');
  if (planParam) {
    const radio = form.querySelector(`input[name="plan"][value="${planParam}"]`);
    if (radio) radio.checked = true;
  }

  /* ---- Update sidebar plan display when plan changes ---- */
  const planRadios = form.querySelectorAll('input[name="plan"]');
  const planDisplay = document.getElementById('selectedPlanDisplay');

  function updateSidebarPlan() {
    const selected = form.querySelector('input[name="plan"]:checked');
    if (!planDisplay) return;
    if (!selected) {
      planDisplay.innerHTML = '<p class="plan-not-selected">プランを選択してください</p>';
      return;
    }
    const labels = {
      consult: { icon: '💬', name: '無料相談のみ', price: '¥0', note: '相談後にプランを選択' },
      petal:   { icon: '🌸', name: 'Petal Plan',   price: '¥4,900 / 月', note: '初月無料体験あり' },
      bloom:   { icon: '🌺', name: 'Bloom Plan',   price: '¥9,000 / 月', note: '初月無料体験あり・おすすめ' },
    };
    const info = labels[selected.value] || { icon: '✦', name: selected.value, price: '', note: '' };
    planDisplay.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <span style="font-size:1.6rem;">${info.icon}</span>
        <div>
          <strong style="display:block;font-size:0.95rem;color:var(--text);">${info.name}</strong>
          <span style="font-size:0.88rem;color:var(--salmon);font-weight:700;">${info.price}</span>
        </div>
      </div>
      <p style="font-size:0.78rem;color:var(--gray-400);">${info.note}</p>
    `;
  }

  planRadios.forEach(r => r.addEventListener('change', updateSidebarPlan));
  updateSidebarPlan(); // init

  /* ---- Password toggle ---- */
  function setupToggle(btnId, inputId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.querySelector('i').className = isText ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
    });
  }
  setupToggle('togglePw',       'password');
  setupToggle('togglePwConfirm','passwordConfirm');

  /* ---- Live validation on blur ---- */
  ['lastName','firstName','email','phone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('blur', () => {
      if (el.value.trim()) {
        markField(id, false);
        clearError(id + 'Error');
      }
    });
  });

})();

/* ============================================================
   6. ACTIVE NAV LINK (scroll spy)
   ============================================================ */
(function initScrollSpy() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  if (!sections.length || !navLinks.length) return;

  const headerH = parseInt(getComputedStyle(document.documentElement)
    .getPropertyValue('--header-h')) || 72;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => {
          link.style.color = '';
          link.style.background = '';
          if (link.getAttribute('href') === `#${entry.target.id}`) {
            link.style.color = 'var(--salmon)';
            link.style.background = 'var(--salmon-bg)';
          }
        });
      }
    });
  }, { rootMargin: `-${headerH}px 0px -60% 0px` });

  sections.forEach(s => observer.observe(s));
})();

/* ============================================================
   7. COUNTER ANIMATION for numbers-bar
   ============================================================ */
(function initCounters() {
  const numEls = document.querySelectorAll('.num');
  if (!numEls.length) return;

  function animateCounter(el, target, duration = 1500) {
    const start = performance.now();
    const isFloat = target % 1 !== 0;
    const update = (time) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      const display = isFloat ? value.toFixed(1) : Math.round(value);
      // Only update the text node (first child), preserve <small> tag
      const textNode = el.childNodes[0];
      if (textNode && textNode.nodeType === Node.TEXT_NODE) {
        textNode.nodeValue = display;
      }
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  const targets = { '300': 300, '92': 92, '3': 3, '15': 15 };

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const textNode = el.childNodes[0];
      if (!textNode) return;
      const raw = textNode.nodeValue.trim();
      const target = targets[raw] || parseFloat(raw) || 0;
      if (target) animateCounter(el, target);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });

  numEls.forEach(el => observer.observe(el));
})();

/* ============================================================
   8. UTILITY: back-to-top on hero scroll
   ============================================================ */
(function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const illus = document.querySelector('.hero-illustration');
  if (!hero || !illus) return;

  window.addEventListener('scroll', () => {
    const scrolled = window.scrollY;
    if (scrolled < hero.offsetHeight) {
      illus.style.transform = `translateY(${-scrolled * 0.08}px)`;
    }
  }, { passive: true });
})();
