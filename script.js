"use strict";

/* ------------------------------------------------------------------ *
 * Expense Tracker
 * State lives in a single array of expense objects. The DOM is always
 * rebuilt from that array via render(), which runs after every change.
 * ------------------------------------------------------------------ */

const STORAGE_KEY = "expense-tracker.expenses";

// --- Application state ---------------------------------------------------
/** @type {{id: string, description: string, amount: number, category: string, date: string}[]} */
let expenses = loadExpenses();

// UI state (not persisted): current filter and sort selections.
let filterCategory = "All";
let sortBy = "date-desc";

// --- Element references --------------------------------------------------
const form = document.getElementById("expense-form");
const descriptionInput = document.getElementById("description");
const amountInput = document.getElementById("amount");
const categoryInput = document.getElementById("category");
const dateInput = document.getElementById("date");
const formError = document.getElementById("form-error");

const filterSelect = document.getElementById("filter-category");
const sortSelect = document.getElementById("sort-by");

const totalEl = document.getElementById("total");
const totalEurEl = document.getElementById("total-eur");
const countEl = document.getElementById("count");
const categoryTotalsEl = document.getElementById("category-totals");

const listEl = document.getElementById("expense-list");
const emptyStateEl = document.getElementById("empty-state");

const convertBtn = document.getElementById("convert-btn");
const convertError = document.getElementById("convert-error");

// --- Persistence ---------------------------------------------------------
function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Guard against corrupt / unexpected data.
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not read saved expenses; starting empty.", err);
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

// --- Helpers -------------------------------------------------------------
const currencyUSD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatUSD(value) {
  return currencyUSD.format(value);
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  // Local date in YYYY-MM-DD for the <input type="date"> default.
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

// --- Derived data --------------------------------------------------------
// Returns the expenses to show, after applying filter + sort.
function getVisibleExpenses() {
  const filtered = expenses.filter(
    (exp) => filterCategory === "All" || exp.category === filterCategory
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "date-asc":
        return a.date.localeCompare(b.date);
      case "date-desc":
        return b.date.localeCompare(a.date);
      case "amount-asc":
        return a.amount - b.amount;
      case "amount-desc":
        return b.amount - a.amount;
      default:
        return 0;
    }
  });

  return sorted;
}

// --- Rendering -----------------------------------------------------------
function render() {
  const visible = getVisibleExpenses();

  renderList(visible);
  renderTotals(visible);

  // A fresh conversion is only valid for the current total, so hide any
  // previously-shown EUR figure whenever the data changes.
  totalEurEl.hidden = true;
}

function renderList(visible) {
  listEl.innerHTML = "";

  const isEmpty = visible.length === 0;
  emptyStateEl.hidden = !isEmpty;
  listEl.hidden = isEmpty;

  visible.forEach((exp) => {
    const li = document.createElement("li");
    li.className = "expense-item";

    const desc = document.createElement("span");
    desc.className = "expense-item__desc";
    desc.textContent = exp.description;

    const cat = document.createElement("span");
    cat.className = "expense-item__cat";
    cat.textContent = exp.category;

    const amount = document.createElement("span");
    amount.className = "expense-item__amount";
    amount.textContent = formatUSD(exp.amount);

    const date = document.createElement("span");
    date.className = "expense-item__date";
    date.textContent = exp.date;

    const delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.type = "button";
    delBtn.textContent = "Delete";
    delBtn.dataset.id = exp.id;
    delBtn.setAttribute("aria-label", `Delete ${exp.description}`);

    li.append(desc, cat, amount, date, delBtn);
    listEl.appendChild(li);
  });
}

function renderTotals(visible) {
  const overall = visible.reduce((sum, exp) => sum + exp.amount, 0);
  totalEl.textContent = formatUSD(overall);
  countEl.textContent = String(visible.length);

  // Per-category totals via reduce.
  const byCategory = visible.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {});

  categoryTotalsEl.innerHTML = "";
  Object.entries(byCategory).forEach(([category, sum]) => {
    const li = document.createElement("li");
    li.innerHTML = `${category}: <strong>${formatUSD(sum)}</strong>`;
    categoryTotalsEl.appendChild(li);
  });
}

// --- Validation ----------------------------------------------------------
function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function clearFormError() {
  formError.textContent = "";
  formError.hidden = true;
}

// Returns a valid expense object, or null if the input is invalid.
function readFormAsExpense() {
  const description = descriptionInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value;

  if (!description) {
    showFormError("Please enter a description.");
    return null;
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    showFormError("Amount must be a number greater than 0.");
    return null;
  }
  if (!date) {
    showFormError("Please choose a date.");
    return null;
  }

  clearFormError();
  return { id: makeId(), description, amount, category, date };
}

// --- Event handlers ------------------------------------------------------
function handleSubmit(event) {
  event.preventDefault();
  const expense = readFormAsExpense();
  if (!expense) return;

  expenses.push(expense);
  saveExpenses();
  render();

  form.reset();
  dateInput.value = todayISO();
  descriptionInput.focus();
}

function handleListClick(event) {
  const button = event.target.closest(".btn-delete");
  if (!button) return;

  const { id } = button.dataset;
  expenses = expenses.filter((exp) => exp.id !== id);
  saveExpenses();
  render();
}

function handleFilterChange(event) {
  filterCategory = event.target.value;
  render();
}

function handleSortChange(event) {
  sortBy = event.target.value;
  render();
}

// --- Async: currency conversion -----------------------------------------
const EXCHANGE_API = "https://open.er-api.com/v6/latest/USD";
const TARGET_CURRENCY = "EUR";

async function handleConvert() {
  convertError.hidden = true;
  convertError.textContent = "";

  const visible = getVisibleExpenses();
  const totalUSD = visible.reduce((sum, exp) => sum + exp.amount, 0);

  const originalLabel = convertBtn.textContent;
  convertBtn.disabled = true;
  convertBtn.textContent = "Converting…";

  try {
    const response = await fetch(EXCHANGE_API);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const rate = data && data.rates ? data.rates[TARGET_CURRENCY] : undefined;
    if (typeof rate !== "number") {
      throw new Error(`No ${TARGET_CURRENCY} rate in API response`);
    }

    const totalEUR = totalUSD * rate;
    const eurFormatter = new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: TARGET_CURRENCY,
    });

    totalEurEl.textContent = `≈ ${eurFormatter.format(totalEUR)} (rate ${rate.toFixed(4)})`;
    totalEurEl.hidden = false;
  } catch (err) {
    console.error("Currency conversion failed:", err);
    convertError.textContent =
      "Couldn't fetch the exchange rate. Check your connection and try again.";
    convertError.hidden = false;
  } finally {
    convertBtn.disabled = false;
    convertBtn.textContent = originalLabel;
  }
}

// --- Wire up & init ------------------------------------------------------
function init() {
  dateInput.value = todayISO();

  form.addEventListener("submit", handleSubmit);
  listEl.addEventListener("click", handleListClick);
  filterSelect.addEventListener("change", handleFilterChange);
  sortSelect.addEventListener("change", handleSortChange);
  convertBtn.addEventListener("click", handleConvert);

  render();
}

init();
