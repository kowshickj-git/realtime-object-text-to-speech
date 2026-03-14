/* ============================================================
   Expense Tracker — Animations (GSAP)
   ============================================================ */

'use strict';

const Animations = (() => {

  // ─── Fade In Elements ──────────────────────────────────
  function fadeInElements(selector, stagger) {
    if (typeof gsap === 'undefined') return;
    const els = document.querySelectorAll(selector);
    if (!els.length) return;
    gsap.from(els, {
      opacity: 0,
      y: 30,
      duration: 0.6,
      stagger: stagger || 0.1,
      ease: 'power2.out',
    });
  }

  // ─── Slide In Sidebar ─────────────────────────────────
  function slideSidebar() {
    if (typeof gsap === 'undefined') return;
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    gsap.from(sidebar, {
      x: -260,
      duration: 0.5,
      ease: 'power3.out',
    });
  }

  // ─── Animate Dashboard Cards ──────────────────────────
  function animateCards() {
    if (typeof gsap === 'undefined') return;
    const cards = document.querySelectorAll('.stat-card');
    if (!cards.length) return;
    gsap.from(cards, {
      opacity: 0,
      y: 40,
      scale: 0.95,
      duration: 0.5,
      stagger: 0.12,
      ease: 'back.out(1.3)',
    });
  }

  // ─── Animate Chart Containers ─────────────────────────
  function animateCharts() {
    if (typeof gsap === 'undefined') return;
    const charts = document.querySelectorAll('.chart-card');
    if (!charts.length) return;
    gsap.from(charts, {
      opacity: 0,
      y: 50,
      duration: 0.6,
      stagger: 0.15,
      ease: 'power2.out',
      delay: 0.3,
    });
  }

  // ─── Kinetic Typography ───────────────────────────────
  function kineticText(selector) {
    if (typeof gsap === 'undefined') return;
    const el = document.querySelector(selector);
    if (!el) return;

    const text = el.textContent;
    el.textContent = '';
    el.style.visibility = 'visible';

    text.split('').forEach((char, i) => {
      const span = document.createElement('span');
      span.textContent = char === ' ' ? '\u00a0' : char;
      span.style.display = 'inline-block';
      span.style.opacity = '0';
      el.appendChild(span);
    });

    gsap.to(el.querySelectorAll('span'), {
      opacity: 1,
      y: 0,
      duration: 0.4,
      stagger: 0.03,
      ease: 'power2.out',
    });
  }

  // ─── Scroll Animations (ScrollTrigger) ─────────────────
  function initScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    document.querySelectorAll('.scroll-reveal').forEach(el => {
      gsap.from(el, {
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        y: 60,
        duration: 0.7,
        ease: 'power2.out',
      });
    });
  }

  // ─── Microinteractions ────────────────────────────────
  function initMicroInteractions() {
    // Button hover scale
    document.querySelectorAll('.btn, .btn-primary, .btn-secondary, .sidebar-nav a').forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (typeof gsap !== 'undefined') gsap.to(el, { scale: 1.03, duration: 0.2 });
      });
      el.addEventListener('mouseleave', () => {
        if (typeof gsap !== 'undefined') gsap.to(el, { scale: 1, duration: 0.2 });
      });
    });

    // Card hover elevation
    document.querySelectorAll('.stat-card, .chart-card, .card').forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (typeof gsap !== 'undefined') gsap.to(el, { y: -4, boxShadow: '0 12px 40px rgba(255,90,9,0.15)', duration: 0.3 });
      });
      el.addEventListener('mouseleave', () => {
        if (typeof gsap !== 'undefined') gsap.to(el, { y: 0, boxShadow: '0 4px 20px rgba(0,0,0,0.2)', duration: 0.3 });
      });
    });

    // Input focus glow
    document.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('focus', () => {
        if (typeof gsap !== 'undefined') gsap.to(el, { boxShadow: '0 0 0 3px rgba(255,90,9,0.3)', duration: 0.2 });
      });
      el.addEventListener('blur', () => {
        if (typeof gsap !== 'undefined') gsap.to(el, { boxShadow: 'none', duration: 0.2 });
      });
    });
  }

  // ─── Ambient Background ───────────────────────────────
  function initAmbientBackground() {
    const canvas = document.getElementById('ambient-bg');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = [];
    const PARTICLE_COUNT = 30;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 1,
        opacity: Math.random() * 0.3 + 0.1,
      });
    }

    let animFrameId;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 90, 9, ${p.opacity})`;
        ctx.fill();
      });

      animFrameId = requestAnimationFrame(animate);
    }

    animate();

    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });

    // Cleanup on page unload to prevent memory leaks
    window.addEventListener('beforeunload', () => {
      if (animFrameId) cancelAnimationFrame(animFrameId);
    });
  }

  // ─── Page Transition ──────────────────────────────────
  function initPageTransition() {
    const overlay = document.getElementById('page-transition');
    if (!overlay) return;

    // Fade in current page
    if (typeof gsap !== 'undefined') {
      gsap.from(overlay, { opacity: 1, duration: 0.3, onComplete: () => { overlay.style.pointerEvents = 'none'; } });
    }

    // Intercept navigation links for smooth transitions
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('javascript')) return;

      link.addEventListener('click', (e) => {
        e.preventDefault();
        overlay.style.pointerEvents = 'all';

        if (typeof gsap !== 'undefined') {
          gsap.to(overlay, {
            opacity: 1,
            duration: 0.3,
            onComplete: () => { window.location.href = href; }
          });
        } else {
          window.location.href = href;
        }
      });
    });
  }

  // ─── Init All ─────────────────────────────────────────
  function initAll() {
    slideSidebar();
    animateCards();
    animateCharts();
    initMicroInteractions();
    initAmbientBackground();
    initPageTransition();
    initScrollAnimations();
  }

  return {
    fadeInElements,
    slideSidebar,
    animateCards,
    animateCharts,
    kineticText,
    initScrollAnimations,
    initMicroInteractions,
    initAmbientBackground,
    initPageTransition,
    initAll,
  };
})();
