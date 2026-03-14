/* ============================================================
   Expense Tracker — Core Application Logic
   ============================================================
   Handles: Authentication, Expense CRUD, Categories, Budgets,
   Recurring Expenses, Data Export, Settings, LocalStorage
   ============================================================ */

'use strict';

const App = (() => {
  // ─── Storage Keys ───────────────────────────────────────
  const KEYS = {
    USERS: 'et_users',
    CURRENT_USER: 'et_current_user',
    EXPENSES: 'et_expenses',
    CATEGORIES: 'et_categories',
    BUDGETS: 'et_budgets',
    SETTINGS: 'et_settings',
    INCOME: 'et_income',
  };

  // ─── Default Categories ─────────────────────────────────
  const DEFAULT_CATEGORIES = [
    { id: 'cat_food', name: 'Food', color: '#FF6384', icon: '🍔' },
    { id: 'cat_transport', name: 'Transport', color: '#36A2EB', icon: '🚗' },
    { id: 'cat_shopping', name: 'Shopping', color: '#FFCE56', icon: '🛍️' },
    { id: 'cat_rent', name: 'Rent', color: '#4BC0C0', icon: '🏠' },
    { id: 'cat_bills', name: 'Bills', color: '#9966FF', icon: '📄' },
    { id: 'cat_health', name: 'Health', color: '#FF9F40', icon: '💊' },
    { id: 'cat_entertainment', name: 'Entertainment', color: '#FF6384', icon: '🎬' },
    { id: 'cat_education', name: 'Education', color: '#C9CBCF', icon: '📚' },
    { id: 'cat_other', name: 'Other', color: '#7C8CF8', icon: '📦' },
  ];

  const DEFAULT_SETTINGS = {
    currency: 'USD',
    currencySymbol: '$',
    theme: 'dark',
    monthlyIncome: 5000,
  };

  // ─── Utility: Generate ID ──────────────────────────────
  function genId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ─── Storage Helpers ────────────────────────────────────
  function store(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error('Storage error:', e);
    }
  }

  function load(key) {
    try {
      const d = localStorage.getItem(key);
      return d ? JSON.parse(d) : null;
    } catch (e) {
      console.error('Load error:', e);
      return null;
    }
  }

  // ─── Init defaults if first run ────────────────────────
  function initDefaults() {
    if (!load(KEYS.USERS)) store(KEYS.USERS, []);
    if (!load(KEYS.CATEGORIES)) store(KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    if (!load(KEYS.SETTINGS)) store(KEYS.SETTINGS, DEFAULT_SETTINGS);
    if (!load(KEYS.EXPENSES)) store(KEYS.EXPENSES, []);
    if (!load(KEYS.BUDGETS)) store(KEYS.BUDGETS, []);
    if (!load(KEYS.INCOME)) store(KEYS.INCOME, []);
  }

  // ═══════════════════════════════════════════════════════
  //  AUTH MODULE
  // ═══════════════════════════════════════════════════════
  const Auth = {
    getUsers() {
      return load(KEYS.USERS) || [];
    },

    findUser(email) {
      return this.getUsers().find(u => u.email === email);
    },

    signup(name, email, password) {
      if (!name || name.trim().length < 1) return { ok: false, msg: 'Name is required.' };
      if (!this.validEmail(email)) return { ok: false, msg: 'Invalid email address.' };
      if (!password || password.length < 8) return { ok: false, msg: 'Password must be at least 8 characters.' };
      if (this.findUser(email)) return { ok: false, msg: 'An account with this email already exists.' };

      const user = { id: genId('usr'), name: name.trim(), email: email.trim().toLowerCase(), password, avatar: '', createdAt: new Date().toISOString() };
      const users = this.getUsers();
      users.push(user);
      store(KEYS.USERS, users);
      store(KEYS.CURRENT_USER, user);
      return { ok: true, user };
    },

    login(email, password) {
      if (!this.validEmail(email)) return { ok: false, msg: 'Invalid email address.' };
      const user = this.findUser(email.trim().toLowerCase());
      if (!user) return { ok: false, msg: 'No account found with this email.' };
      if (user.password !== password) return { ok: false, msg: 'Incorrect password.' };
      store(KEYS.CURRENT_USER, user);
      return { ok: true, user };
    },

    logout() {
      localStorage.removeItem(KEYS.CURRENT_USER);
    },

    currentUser() {
      return load(KEYS.CURRENT_USER);
    },

    isLoggedIn() {
      return !!this.currentUser();
    },

    updateProfile(updates) {
      const cur = this.currentUser();
      if (!cur) return false;
      const users = this.getUsers();
      const idx = users.findIndex(u => u.id === cur.id);
      if (idx === -1) return false;
      Object.assign(users[idx], updates);
      store(KEYS.USERS, users);
      store(KEYS.CURRENT_USER, users[idx]);
      return true;
    },

    validEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },

    requireAuth() {
      if (!this.isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
    }
  };

  // ═══════════════════════════════════════════════════════
  //  EXPENSE MODULE
  // ═══════════════════════════════════════════════════════
  const Expenses = {
    getAll() {
      return load(KEYS.EXPENSES) || [];
    },

    getUserExpenses() {
      const user = Auth.currentUser();
      if (!user) return [];
      return this.getAll().filter(e => e.userId === user.id);
    },

    add(expense) {
      if (!expense.amount || isNaN(expense.amount) || Number(expense.amount) <= 0) return { ok: false, msg: 'Enter a valid amount.' };
      if (!expense.category) return { ok: false, msg: 'Select a category.' };
      if (!expense.date) return { ok: false, msg: 'Select a date.' };

      const user = Auth.currentUser();
      if (!user) return { ok: false, msg: 'Not authenticated.' };

      const newExp = {
        id: genId('exp'),
        userId: user.id,
        amount: parseFloat(Number(expense.amount).toFixed(2)),
        category: expense.category,
        date: expense.date,
        description: (expense.description || '').trim(),
        paymentMethod: expense.paymentMethod || 'Cash',
        recurring: expense.recurring || 'none',
        createdAt: new Date().toISOString(),
      };

      const all = this.getAll();
      all.push(newExp);
      store(KEYS.EXPENSES, all);
      return { ok: true, expense: newExp };
    },

    update(id, updates) {
      const all = this.getAll();
      const idx = all.findIndex(e => e.id === id);
      if (idx === -1) return { ok: false, msg: 'Expense not found.' };
      if (updates.amount !== undefined) {
        if (isNaN(updates.amount) || Number(updates.amount) <= 0) return { ok: false, msg: 'Enter a valid amount.' };
        updates.amount = parseFloat(Number(updates.amount).toFixed(2));
      }
      Object.assign(all[idx], updates);
      store(KEYS.EXPENSES, all);
      return { ok: true, expense: all[idx] };
    },

    remove(id) {
      let all = this.getAll();
      const before = all.length;
      all = all.filter(e => e.id !== id);
      if (all.length === before) return { ok: false, msg: 'Expense not found.' };
      store(KEYS.EXPENSES, all);
      return { ok: true };
    },

    getFiltered({ category, startDate, endDate, search, sortBy, sortDir } = {}) {
      let list = this.getUserExpenses();

      if (category && category !== 'all') {
        list = list.filter(e => e.category === category);
      }
      if (startDate) {
        list = list.filter(e => e.date >= startDate);
      }
      if (endDate) {
        list = list.filter(e => e.date <= endDate);
      }
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(e =>
          e.description.toLowerCase().includes(s) ||
          e.category.toLowerCase().includes(s) ||
          e.paymentMethod.toLowerCase().includes(s)
        );
      }

      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'amount') {
        list.sort((a, b) => (a.amount - b.amount) * dir);
      } else {
        list.sort((a, b) => (new Date(a.date) - new Date(b.date)) * dir);
      }

      return list;
    },

    getMonthlyTotal(year, month) {
      return this.getUserExpenses()
        .filter(e => {
          const d = new Date(e.date);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((s, e) => s + e.amount, 0);
    },

    getCategoryTotals(year, month) {
      const exps = this.getUserExpenses().filter(e => {
        if (year === undefined) return true;
        const d = new Date(e.date);
        return d.getFullYear() === year && d.getMonth() === month;
      });
      const totals = {};
      exps.forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.amount;
      });
      return totals;
    },

    getMonthlyTrend(months) {
      const result = [];
      const now = new Date();
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const total = this.getMonthlyTotal(d.getFullYear(), d.getMonth());
        result.push({
          label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          year: d.getFullYear(),
          month: d.getMonth(),
          total,
        });
      }
      return result;
    }
  };

  // ═══════════════════════════════════════════════════════
  //  INCOME MODULE
  // ═══════════════════════════════════════════════════════
  const Income = {
    getAll() {
      return load(KEYS.INCOME) || [];
    },

    getUserIncome() {
      const user = Auth.currentUser();
      if (!user) return [];
      return this.getAll().filter(i => i.userId === user.id);
    },

    add(amount, description, date) {
      const user = Auth.currentUser();
      if (!user) return { ok: false, msg: 'Not authenticated.' };
      if (!amount || isNaN(amount) || Number(amount) <= 0) return { ok: false, msg: 'Enter a valid amount.' };

      const inc = {
        id: genId('inc'),
        userId: user.id,
        amount: parseFloat(Number(amount).toFixed(2)),
        description: (description || 'Income').trim(),
        date: date || new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      };
      const all = this.getAll();
      all.push(inc);
      store(KEYS.INCOME, all);
      return { ok: true, income: inc };
    },

    remove(id) {
      let all = this.getAll();
      all = all.filter(i => i.id !== id);
      store(KEYS.INCOME, all);
      return { ok: true };
    },

    getMonthlyTotal(year, month) {
      return this.getUserIncome()
        .filter(i => {
          const d = new Date(i.date);
          return d.getFullYear() === year && d.getMonth() === month;
        })
        .reduce((s, i) => s + i.amount, 0);
    },

    getTotalIncome() {
      return this.getUserIncome().reduce((s, i) => s + i.amount, 0);
    }
  };

  // ═══════════════════════════════════════════════════════
  //  CATEGORY MODULE
  // ═══════════════════════════════════════════════════════
  const Categories = {
    getAll() {
      return load(KEYS.CATEGORIES) || DEFAULT_CATEGORIES;
    },

    add(name, color, icon) {
      if (!name || name.trim().length < 1) return { ok: false, msg: 'Category name is required.' };
      const cats = this.getAll();
      if (cats.find(c => c.name.toLowerCase() === name.trim().toLowerCase())) {
        return { ok: false, msg: 'Category already exists.' };
      }
      const cat = { id: genId('cat'), name: name.trim(), color: color || '#FF5A09', icon: icon || '📁' };
      cats.push(cat);
      store(KEYS.CATEGORIES, cats);
      return { ok: true, category: cat };
    },

    update(id, updates) {
      const cats = this.getAll();
      const idx = cats.findIndex(c => c.id === id);
      if (idx === -1) return { ok: false, msg: 'Category not found.' };
      Object.assign(cats[idx], updates);
      store(KEYS.CATEGORIES, cats);
      return { ok: true };
    },

    remove(id) {
      let cats = this.getAll();
      cats = cats.filter(c => c.id !== id);
      store(KEYS.CATEGORIES, cats);
      return { ok: true };
    },

    getByName(name) {
      return this.getAll().find(c => c.name === name);
    }
  };

  // ═══════════════════════════════════════════════════════
  //  BUDGET MODULE
  // ═══════════════════════════════════════════════════════
  const Budgets = {
    getAll() {
      return load(KEYS.BUDGETS) || [];
    },

    getUserBudgets() {
      const user = Auth.currentUser();
      if (!user) return [];
      return this.getAll().filter(b => b.userId === user.id);
    },

    set(category, amount, period) {
      if (!amount || isNaN(amount) || Number(amount) <= 0) return { ok: false, msg: 'Enter a valid budget amount.' };
      const user = Auth.currentUser();
      if (!user) return { ok: false, msg: 'Not authenticated.' };

      const all = this.getAll();
      const existing = all.findIndex(b => b.userId === user.id && b.category === category && b.period === (period || 'monthly'));

      const budget = {
        id: existing >= 0 ? all[existing].id : genId('bgt'),
        userId: user.id,
        category,
        amount: parseFloat(Number(amount).toFixed(2)),
        period: period || 'monthly',
      };

      if (existing >= 0) {
        all[existing] = budget;
      } else {
        all.push(budget);
      }
      store(KEYS.BUDGETS, all);
      return { ok: true, budget };
    },

    remove(id) {
      let all = this.getAll();
      all = all.filter(b => b.id !== id);
      store(KEYS.BUDGETS, all);
      return { ok: true };
    },

    getStatus() {
      const budgets = this.getUserBudgets();
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();

      return budgets.map(b => {
        const spent = Expenses.getUserExpenses()
          .filter(e => {
            const d = new Date(e.date);
            const matchCat = b.category === 'overall' || e.category === b.category;
            return matchCat && d.getFullYear() === year && d.getMonth() === month;
          })
          .reduce((s, e) => s + e.amount, 0);

        const pct = b.amount > 0 ? Math.min((spent / b.amount) * 100, 100) : 0;
        let status = 'ok';
        if (pct >= 100) status = 'exceeded';
        else if (pct >= 80) status = 'warning';

        return { ...b, spent: parseFloat(spent.toFixed(2)), percentage: parseFloat(pct.toFixed(1)), status };
      });
    }
  };

  // ═══════════════════════════════════════════════════════
  //  RECURRING EXPENSES
  // ═══════════════════════════════════════════════════════
  function processRecurring() {
    const user = Auth.currentUser();
    if (!user) return;

    const expenses = Expenses.getUserExpenses().filter(e => e.recurring && e.recurring !== 'none');
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    expenses.forEach(e => {
      const lastDate = new Date(e.date);
      let nextDate;

      if (e.recurring === 'weekly') {
        nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + 7);
      } else if (e.recurring === 'monthly') {
        nextDate = new Date(lastDate);
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (e.recurring === 'yearly') {
        nextDate = new Date(lastDate);
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      if (nextDate && nextDate <= now) {
        const nextDateStr = nextDate.toISOString().split('T')[0];
        const alreadyExists = Expenses.getUserExpenses().find(
          ex => ex.category === e.category && ex.amount === e.amount && ex.date === nextDateStr && ex.description === e.description
        );

        if (!alreadyExists) {
          Expenses.add({
            amount: e.amount,
            category: e.category,
            date: nextDateStr,
            description: e.description + ' (recurring)',
            paymentMethod: e.paymentMethod,
            recurring: e.recurring,
          });
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════
  //  SETTINGS MODULE
  // ═══════════════════════════════════════════════════════
  const Settings = {
    get() {
      return load(KEYS.SETTINGS) || DEFAULT_SETTINGS;
    },

    update(updates) {
      const s = this.get();
      Object.assign(s, updates);
      store(KEYS.SETTINGS, s);
      return s;
    },

    getCurrencySymbol() {
      const map = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', AUD: 'A$', CAD: 'C$' };
      const s = this.get();
      return map[s.currency] || '$';
    },

    resetAllData() {
      Object.values(KEYS).forEach(k => localStorage.removeItem(k));
      initDefaults();
    }
  };

  // ═══════════════════════════════════════════════════════
  //  DATA EXPORT MODULE
  // ═══════════════════════════════════════════════════════
  const Export = {
    toCSV() {
      const expenses = Expenses.getUserExpenses();
      if (expenses.length === 0) return null;

      const headers = ['Date', 'Amount', 'Category', 'Description', 'Payment Method', 'Recurring'];
      const sym = Settings.getCurrencySymbol();
      const rows = expenses.map(e => [
        e.date,
        sym + e.amount.toFixed(2),
        e.category,
        '"' + (e.description || '').replace(/"/g, '""') + '"',
        e.paymentMethod,
        e.recurring || 'none'
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      this._download(csv, 'expenses.csv', 'text/csv');
      return true;
    },

    toJSON() {
      const expenses = Expenses.getUserExpenses();
      if (expenses.length === 0) return null;
      const json = JSON.stringify(expenses, null, 2);
      this._download(json, 'expenses.json', 'application/json');
      return true;
    },

    toPDF() {
      const expenses = Expenses.getUserExpenses();
      if (expenses.length === 0) return null;

      const sym = Settings.getCurrencySymbol();
      const now = new Date();
      const total = expenses.reduce((s, e) => s + e.amount, 0);

      let html = `
        <html><head><title>Expense Report</title>
        <style>
          body{font-family:Arial,sans-serif;padding:40px;color:#333}
          h1{color:#FF5A09;border-bottom:2px solid #FF5A09;padding-bottom:10px}
          .summary{display:flex;gap:20px;margin:20px 0}
          .stat{background:#f4f4f4;padding:15px 25px;border-radius:8px}
          .stat h3{margin:0;color:#666;font-size:14px}
          .stat p{margin:5px 0 0;font-size:24px;font-weight:bold;color:#FF5A09}
          table{width:100%;border-collapse:collapse;margin-top:20px}
          th{background:#393939;color:#fff;padding:12px;text-align:left}
          td{padding:10px 12px;border-bottom:1px solid #ddd}
          tr:nth-child(even){background:#f9f9f9}
          .footer{margin-top:30px;color:#999;font-size:12px}
        </style></head><body>
        <h1>Expense Report</h1>
        <p>Generated: ${now.toLocaleDateString()}</p>
        <div class="summary">
          <div class="stat"><h3>Total Expenses</h3><p>${sym}${total.toFixed(2)}</p></div>
          <div class="stat"><h3>Transactions</h3><p>${expenses.length}</p></div>
        </div>
        <table>
          <tr><th>Date</th><th>Amount</th><th>Category</th><th>Description</th><th>Payment</th></tr>
          ${expenses.map(e => `<tr><td>${e.date}</td><td>${sym}${e.amount.toFixed(2)}</td><td>${e.category}</td><td>${e.description || '-'}</td><td>${e.paymentMethod}</td></tr>`).join('')}
        </table>
        <div class="footer">Expense Tracker Report &copy; ${now.getFullYear()}</div>
        </body></html>`;

      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => printWin.print(), 500);
      }
      return true;
    },

    _download(content, filename, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // ═══════════════════════════════════════════════════════
  //  UI HELPERS
  // ═══════════════════════════════════════════════════════
  const UI = {
    formatCurrency(amount) {
      const sym = Settings.getCurrencySymbol();
      return sym + Number(amount).toFixed(2);
    },

    showToast(message, type) {
      type = type || 'info';
      let container = document.getElementById('toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.style.cssText = `
        padding:14px 24px;border-radius:8px;color:#fff;font-size:14px;
        box-shadow:0 4px 20px rgba(0,0,0,0.3);opacity:0;transform:translateX(100%);
        transition:all 0.3s ease;max-width:350px;
        background:${type === 'success' ? '#2ecc71' : type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#FF5A09'};
      `;
      toast.textContent = message;
      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      });

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    },

    populateCategorySelect(selectEl, includeAll) {
      if (!selectEl) return;
      selectEl.innerHTML = '';
      if (includeAll) {
        const opt = document.createElement('option');
        opt.value = 'all';
        opt.textContent = 'All Categories';
        selectEl.appendChild(opt);
      }
      Categories.getAll().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.name;
        opt.textContent = cat.icon + ' ' + cat.name;
        selectEl.appendChild(opt);
      });
    },

    renderDashboardCards() {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const sym = Settings.getCurrencySymbol();

      const totalExpense = Expenses.getMonthlyTotal(year, month);
      const settings = Settings.get();
      const totalIncome = Income.getMonthlyTotal(year, month) || settings.monthlyIncome;
      const balance = totalIncome - totalExpense;

      const allTimeExpense = Expenses.getUserExpenses().reduce((s, e) => s + e.amount, 0);

      this.setCardValue('total-income', sym + totalIncome.toFixed(2));
      this.setCardValue('total-expense', sym + totalExpense.toFixed(2));
      this.setCardValue('balance', sym + balance.toFixed(2));
      this.setCardValue('monthly-spending', sym + allTimeExpense.toFixed(2));
    },

    setCardValue(id, value) {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    },

    initSidebar() {
      const currentPage = window.location.pathname.split('/').pop() || 'index.html';
      document.querySelectorAll('.sidebar-nav a').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
          link.classList.add('active');
        }
      });

      const toggle = document.getElementById('sidebar-toggle');
      const sidebar = document.getElementById('sidebar');
      if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
          sidebar.classList.toggle('collapsed');
        });
      }
    },

    initThemeToggle() {
      const btn = document.getElementById('theme-toggle');
      if (!btn) return;
      const settings = Settings.get();
      if (settings.theme === 'light') document.body.classList.add('light-theme');

      btn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        Settings.update({ theme: isLight ? 'light' : 'dark' });
      });
    },

    initUserInfo() {
      const user = Auth.currentUser();
      if (!user) return;
      const nameEl = document.getElementById('user-name');
      const avatarEl = document.getElementById('user-avatar');
      if (nameEl) nameEl.textContent = user.name;
      if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
    },

    initSearchBar() {
      const searchInput = document.getElementById('global-search');
      if (!searchInput) return;
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value;
        if (typeof window.onGlobalSearch === 'function') {
          window.onGlobalSearch(q);
        }
      });
    },

    initLogout() {
      const btn = document.getElementById('logout-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          Auth.logout();
          window.location.href = 'login.html';
        });
      }
    }
  };

  // ─── Init on Load ──────────────────────────────────────
  function init() {
    initDefaults();
    processRecurring();
  }

  // Public API
  return { Auth, Expenses, Income, Categories, Budgets, Settings, Export, UI, init, KEYS };
})();

// Auto-init
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
