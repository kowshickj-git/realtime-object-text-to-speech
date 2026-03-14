/* ============================================================
   Expense Tracker — Chart.js Analytics
   ============================================================ */

'use strict';

const Charts = (() => {
  let pieChart = null;
  let barChart = null;
  let lineChart = null;

  const COLORS = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
    '#FF9F40', '#FF6384', '#C9CBCF', '#7C8CF8', '#2ecc71',
    '#e74c3c', '#3498db', '#f39c12', '#1abc9c'
  ];

  function getChartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#ccc', font: { size: 12 } }
        }
      }
    };
  }

  function isChartAvailable() {
    return typeof Chart !== 'undefined';
  }

  // ─── Pie Chart: Category Distribution ──────────────────
  function renderPieChart(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !isChartAvailable()) return;

    const now = new Date();
    const catTotals = App.Expenses.getCategoryTotals(now.getFullYear(), now.getMonth());
    const categories = App.Categories.getAll();

    const labels = [];
    const data = [];
    const bgColors = [];

    Object.keys(catTotals).forEach((catName, i) => {
      if (catTotals[catName] > 0) {
        labels.push(catName);
        data.push(catTotals[catName]);
        const cat = categories.find(c => c.name === catName);
        bgColors.push(cat ? cat.color : COLORS[i % COLORS.length]);
      }
    });

    if (labels.length === 0) {
      labels.push('No Data');
      data.push(1);
      bgColors.push('#555');
    }

    if (pieChart) pieChart.destroy();

    pieChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 0,
          hoverOffset: 8,
        }]
      },
      options: {
        ...getChartDefaults(),
        cutout: '65%',
        plugins: {
          ...getChartDefaults().plugins,
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const sym = App.Settings.getCurrencySymbol();
                return ctx.label + ': ' + sym + ctx.parsed.toFixed(2);
              }
            }
          }
        }
      }
    });
  }

  // ─── Bar Chart: Monthly Comparison ─────────────────────
  function renderBarChart(canvasId, months) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !isChartAvailable()) return;

    months = months || 6;
    const trend = App.Expenses.getMonthlyTrend(months);

    if (barChart) barChart.destroy();

    barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: trend.map(t => t.label),
        datasets: [{
          label: 'Monthly Spending',
          data: trend.map(t => t.total),
          backgroundColor: trend.map((_, i) => i === trend.length - 1 ? '#FF5A09' : '#ec7f37'),
          borderRadius: 6,
          borderSkipped: false,
          barThickness: 32,
        }]
      },
      options: {
        ...getChartDefaults(),
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#aaa' }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#aaa',
              callback: (v) => App.Settings.getCurrencySymbol() + v,
            }
          }
        },
        plugins: {
          ...getChartDefaults().plugins,
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return App.Settings.getCurrencySymbol() + ctx.parsed.y.toFixed(2);
              }
            }
          }
        }
      }
    });
  }

  // ─── Line Chart: Spending Trend ────────────────────────
  function renderLineChart(canvasId, months) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !isChartAvailable()) return;

    months = months || 12;
    const trend = App.Expenses.getMonthlyTrend(months);

    if (lineChart) lineChart.destroy();

    lineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: trend.map(t => t.label),
        datasets: [{
          label: 'Spending Trend',
          data: trend.map(t => t.total),
          borderColor: '#FF5A09',
          backgroundColor: 'rgba(255,90,9,0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#FF5A09',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
        }]
      },
      options: {
        ...getChartDefaults(),
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#aaa' }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: {
              color: '#aaa',
              callback: (v) => App.Settings.getCurrencySymbol() + v,
            }
          }
        }
      }
    });
  }

  // ─── Refresh All Charts ────────────────────────────────
  function refreshAll() {
    renderPieChart('pie-chart');
    renderBarChart('bar-chart');
    renderLineChart('line-chart');
  }

  return { renderPieChart, renderBarChart, renderLineChart, refreshAll };
})();
